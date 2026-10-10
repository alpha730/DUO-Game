// Shared helpers for the E2E flows. Runs against the emulators + Vite dev server (see e2e/README in
// the root README). Browser from E2E_BROWSER=chromium|webkit (run.mjs sets it). Mobile 375×812.
//
// Mocks (the same in both browsers, so tests are deterministic and headless):
//  - camera / AR: window.__FAKE_SCANNER → web/src/ar/fakeScanner.ts; `posterFound(page, i)` fires the
//    scanner's "poster found" event for poster i (emulator builds only).
//  - microphone: getUserMedia resolves a stub stream (window.__MIC = "deny" → NotAllowedError).
//  - location: navigator.geolocation returns window.__GEO ({lat,lng}, default JECRC Foundation) or
//    window.__GEO = "deny" → PERMISSION_DENIED.
//  - speech: a fake SpeechRecognition driven by `say(page, text)`.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright-core";

export const BASE = process.env.E2E_BASE ?? "http://localhost:5173";
export const BROWSER = process.env.E2E_BROWSER ?? "chromium";
export const OUT = fileURLToPath(new URL(`./out/${BROWSER}/`, import.meta.url));
mkdirSync(OUT, { recursive: true });
export const PROJECT = "demo-decade-hunt";
export const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;
export const FOUNDATION = { lat: 26.7838, lng: 75.8301 };
export const UNIVERSITY = { lat: 26.7759236, lng: 75.8745013 };
export const FAR_AWAY = { lat: 28.6139, lng: 77.209 }; // Delhi
// App Check is enforced on the emulator too (unsigned debug token, see web/src/lib/firebase.ts).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const APP_CHECK_TOKEN = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "demo-app", iss: "emulator", exp: 4102444800 })}.emulator`;

let failures = 0;
export const ok = (c, m) => {
  if (!c) failures++;
  console.log(`${c ? "PASS" : "FAIL"} [${BROWSER}] ${m}`);
};
export const failed = () => failures;

const require = createRequire(new URL("../functions/package.json", import.meta.url));
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8085";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const adminApp = initializeApp({ projectId: PROJECT }, `e2e-${process.pid}`);
export const adb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export { Timestamp, FieldValue };

export const istDate = (ms = Date.now()) => new Date(ms + 5.5 * 3600e3).toISOString().slice(0, 10);
export const istMidnight = (date) => Date.parse(`${date}T00:00:00+05:30`);
export const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

// ---------- Emulator test switches ----------
/** Fake server clock (emulator only): the functions add this offset to Date.now(). */
export const setServerClock = (ms) => adb.doc("_emulator/clock").set({ offsetMs: ms - Date.now() });
export const resetServerClock = () => adb.doc("_emulator/clock").delete();
/** Emulator only: enforce the campus check like production (default: off-campus is let through). */
export const strictCampus = (on = true) => (on ? adb.doc("_emulator/campus").set({ strict: true }) : adb.doc("_emulator/campus").delete());

// Known questions per Lingo (emulator-only pins; else the real pool): 2016 Read Aloud, 2017 speak,
// 2018 Choose the Meaning, 2019 Fill in the Blanks, then repeating.
export const SAMPLE = {
  pronounce: { type: "pronounce", word: "programme", accept: ["program"] },
  speak: { type: "speak", phrase: "Practice every day and you will see the difference." },
  meaning: { type: "meaning", word: "reluctant", options: ["unwilling", "excited", "tired", "careful"], correctIndex: 0, explanation: "not wanting to do something" },
  question: { type: "question", prompt: "She has been working here ___ 2022.", options: ["since", "for", "from", "at"], correctIndex: 0 },
};
const ORDER = ["pronounce", "speak", "meaning", "question"];
export const DEFAULT_PINS = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`lingo-${2016 + i}`, SAMPLE[ORDER[i % 4]]]));
export const pinQuestions = (byLingo = DEFAULT_PINS) => adb.doc("_emulator/pins").set({ until: Date.now() + 30 * 60_000, byLingo });
export const unpinQuestions = () => adb.doc("_emulator/pins").delete();

/** Patch config/game; returns a restore function. */
export async function patchConfig(patch) {
  const ref = adb.doc("config/game");
  const before = (await ref.get()).data();
  await ref.update(patch);
  return () => ref.set(before);
}

// ---------- Browser ----------
const MOCKS = `
(() => {
  window.__FAKE_SCANNER = true;
  // Microphone
  const md = navigator.mediaDevices || {};
  if (!navigator.mediaDevices) Object.defineProperty(navigator, "mediaDevices", { value: md, configurable: true });
  md.getUserMedia = async (c) => {
    if (window.__MIC === "deny" || (c && c.video && window.__CAM === "deny")) throw new DOMException("denied", "NotAllowedError");
    return { getTracks: () => [{ stop() {} }], getAudioTracks: () => [], getVideoTracks: () => [] };
  };
  // Location
  const geo = {
    getCurrentPosition(ok, err) {
      setTimeout(() => {
        const g = window.__GEO ?? ${JSON.stringify(FOUNDATION)};
        if (g === "deny") return err && err({ code: 1, PERMISSION_DENIED: 1, message: "denied" });
        ok({ coords: { latitude: g.lat, longitude: g.lng, accuracy: 20 }, timestamp: Date.now() });
      }, 20);
    },
    watchPosition(ok, err) { this.getCurrentPosition(ok, err); return 1; },
    clearWatch() {},
  };
  Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true });
  // Speech recognition
  class FakeRec {
    constructor() { this.lang = ""; this.interimResults = false; this.continuous = false; this.maxAlternatives = 1; window.__rec = this; }
    start() { this.__running = true; setTimeout(() => { this.onstart && this.onstart(); this.onaudiostart && this.onaudiostart(); }, 10); }
    stop() { if (!this.__running) return; this.__running = false; setTimeout(() => this.onend && this.onend(), 10); }
    abort() { this.stop(); }
  }
  if (window.__NO_SPEECH !== true) {
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = FakeRec;
  }
  window.__say = (text, final = true) => {
    const r = window.__rec;
    if (!r || !r.__running) return false;
    const alt = { transcript: text, confidence: 0.9 };
    const result = Object.assign([alt], { isFinal: final, length: 1 });
    const results = Object.assign([result], { length: 1 });
    r.onresult && r.onresult({ resultIndex: 0, results });
    if (final) r.stop();
    return true;
  };
})();
`;

/**
 * A mobile browser page with the mocks. `init` adds scripts (e.g. "window.__GEO='deny'"), `ua` a
 * user agent, `colorScheme` light|dark, `viewport` {width,height}.
 */
export async function launch({ init = [], ua, colorScheme = "light", viewport = { width: 375, height: 812 } } = {}) {
  const type = BROWSER === "webkit" ? webkit : chromium;
  const browser = await type.launch(BROWSER === "chromium" ? { args: ["--enable-unsafe-swiftshader"] } : {});
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: BROWSER === "chromium", // WebKit on Windows has no isMobile
    hasTouch: true,
    colorScheme,
    ...(ua ? { userAgent: ua } : {}),
  });
  await ctx.addInitScript(MOCKS);
  for (const s of init) await ctx.addInitScript(s);
  const page = await ctx.newPage();
  if (BROWSER === "webkit") {
    // WebKit keeps the cancelled Firestore long-polls of the previous page holding sockets for a
    // while; against the HTTP/1.1 emulator (6 connections per host) a quick page.goto() can then
    // stall. Production Firestore is HTTP/2. Going through about:blank releases them.
    const goto = page.goto.bind(page);
    page.goto = async (url, opts) => {
      if (page.url() !== "about:blank") await goto("about:blank");
      return goto(url, opts);
    };
  }
  const errors = [];
  // WebKit reports Firestore's long-poll request, cancelled by a full page.goto(), as an "access
  // control" error. Test-only noise (players navigate inside the app), so it isn't counted.
  page.on("pageerror", (e) => /Firestore\/(Listen|Write)\/channel.*access control checks/.test(e.message) || errors.push(e.message));
  return { browser, ctx, page, errors };
}

// A screenshot is evidence, not a check: a failed capture (e.g. WebKit on a very long page) never fails a flow.
export const shot = (page, name, opts = {}) =>
  page.screenshot({ path: `${OUT}${name}.png`, ...opts }).catch((e) => console.log(`(screenshot ${name} skipped: ${String(e.message).split("\n")[0]})`));

// ---------- Accounts ----------
let seq = 0;
const uniqueEmail = (tag) => `${tag}${Date.now()}${seq++}${Math.random().toString(36).slice(2, 5)}@e2e.test`;

/** uid for an email (Auth emulator). */
export async function uidOf(email) {
  return (await adminAuth.getUserByEmail(email.toLowerCase())).uid;
}

/** Sign up through the UI (email + password), verify via the emulator link, finish the profile. */
export async function signUp(page, { tag = "p", name = "E2E Player" } = {}) {
  const email = uniqueEmail(tag);
  await clearRateLimits();
  await signOut(page);
  await page.getByRole("button", { name: /Create an account/ }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/setup", { timeout: 20000 });
  await page.getByRole("button", { name: "Open the verification link (emulator)" }).click({ timeout: 8000 }).catch(() => {});
  await page.getByLabel("Full name").waitFor({ timeout: 15000 });
  await page.getByLabel("Full name").fill(name);
  await page.getByRole("button", { name: "Start hunting" }).click();
  await page.waitForURL("**/home", { timeout: 20000 });
  return { email, uid: await uidOf(email) };
}

/** Forget the signed-in account (Firebase keeps it in IndexedDB) and open the Login screen. */
export async function signOut(page) {
  await page.goto(BASE + "/favicon.svg"); // same origin, no app running → nothing holds the database open
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.deleteDatabase("firebaseLocalStorageDb");
        r.onsuccess = r.onerror = r.onblocked = () => resolve();
      }),
  );
  await page.goto(BASE);
  await page.getByRole("button", { name: /Create an account|Already have an account/ }).waitFor({ timeout: 20000 });
}

/** Sign in an existing account through the UI. */
export async function signIn(page, email, password = "test1234") {
  await signOut(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(home|admin|redeem|setup)/, { timeout: 20000 });
}

/** A finished, verified account made with the Admin SDK (fast; for setups the UI test doesn't cover). */
export async function makeUser({ name = "E2E Helper", role } = {}) {
  const email = uniqueEmail("h");
  const u = await adminAuth.createUser({ email, password: "test1234", emailVerified: true, displayName: name });
  if (role) await adminAuth.setCustomUserClaims(u.uid, { role });
  const idToken = await idTokenFor(email);
  await callFn("completeProfile", { name }, idToken);
  return { email, uid: u.uid, idToken: () => idTokenFor(email) };
}

export async function idTokenFor(email, password = "test1234") {
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return (await res.json()).idToken;
}

/** Calls a callable over HTTP (like the client SDK). Returns {ok, data} or {ok:false, error}. */
export async function callFn(name, data, idToken, headers = {}) {
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Firebase-AppCheck": APP_CHECK_TOKEN, ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}), ...headers },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, data: body.result } : { ok: false, status: res.status, error: body.error };
}

// ---------- Game steps ----------
/** Open /scan and fire "poster found" for poster i; returns the scan card. */
export async function posterFound(page, posterIndex) {
  await clearRateLimits();
  if (!new URL(page.url()).pathname.startsWith("/scan")) await page.goto(BASE + "/scan");
  await page.waitForFunction(() => typeof window.__posterFound === "function", null, { timeout: 30000 });
  await page.evaluate((i) => window.__posterFound(i), posterIndex);
  const card = page.locator(".scan-card");
  await card.waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelector(".scan-card")?.getAttribute("data-kind")?.startsWith("server-loading") === false, null, { timeout: 15000 }).catch(() => {});
  return card;
}

/**
 * E2E plays far faster than a person (a dozen questions a minute), so before each step the per-user
 * rate-limit counters (limits/*) are cleared. The limits themselves are tested in
 * functions/test/security.test.ts ("E. rate limits").
 */
export async function clearRateLimits() {
  const snap = await adb.collection("limits").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/** /catch/<lingo> → wait for Start → Start → question on screen. */
export async function startCatch(page, lingoId, { goto = true } = {}) {
  await clearRateLimits();
  if (goto) await page.goto(BASE + `/catch/${lingoId}`);
  await page.getByRole("button", { name: "Start" }).click({ timeout: 25000 });
  await page.locator("[data-phase=active]").waitFor({ timeout: 20000 });
}

/** Choice question: tap the option with this text, then SUBMIT; returns the result card's outcome. */
export async function answerChoice(page, text) {
  await clearRateLimits();
  await page.getByRole("radio", { name: new RegExp(`${text}$`) }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  return resultOutcome(page);
}

export async function say(page, text) {
  await page.waitForFunction(() => window.__rec?.__running, null, { timeout: 10000 });
  await page.evaluate((t) => window.__say(t), text);
}

export async function resultOutcome(page) {
  const card = page.locator(".result");
  await card.waitFor({ timeout: 25000 });
  return card.getAttribute("data-outcome");
}

export const resultText = async (page) => (await page.locator(".result").innerText()).replace(/\s+/g, " ");

/** The open attempt of a user (server data, admin SDK). */
export async function openAttempt(uid) {
  const q = await adb.collection("attempts").where("uid", "==", uid).where("status", "==", "open").get();
  return q.docs[0] ?? null;
}

export async function finish(browser, errors) {
  ok(errors.length === 0, `no page errors ${errors.slice(0, 3).join(" | ")}`);
  await browser.close();
}
