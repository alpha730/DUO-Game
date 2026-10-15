// 11. Anti-cheat in the browser (docs/SECURITY.md):
//  A. answers never reach the phone — the built bundle + source maps, the deployed hosting files and
//     every network response during play contain no answer data or question pool;
//  D. the app sends an App Check token with every function call (and the forfeit request);
//  K. changing the phone's clock changes nothing (timer + today come from the server).
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { adb, BASE, BROWSER, finish, launch, ok, openAttempt, pinQuestions, say, signUp, startCatch } from "../lib.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const pool = JSON.parse(readFileSync(join(ROOT, "scripts/content/question-pool-2026.json"), "utf8"));
// Distinctive strings of the pool: prompts, options and explanations (≥ 12 characters, so ordinary
// words in the app's own text don't count).
const secrets = [...new Set(pool.flatMap((q) => [q.prompt, q.explanation, ...(q.options ?? [])]).filter((t) => typeof t === "string" && t.length >= 12))];
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

if (BROWSER === "chromium") {
  // --- A1: the production build.
  execSync("npm run build", { cwd: join(ROOT, "web"), stdio: "ignore" });
  const dist = join(ROOT, "web/dist");
  const text = files(dist).filter((f) => /\.(js|css|html|json|map|txt|svg)$/.test(f));
  const maps = text.filter((f) => f.endsWith(".map"));
  ok(maps.length === 0, `no source maps shipped (${maps.length})`);
  let poolHits = [];
  let keyHits = [];
  for (const f of text) {
    const body = readFileSync(f, "utf8");
    for (const s of secrets) if (body.includes(s)) poolHits.push(`${f.replace(dist, "")}: "${s}"`);
    if (/correctIndex/.test(body)) keyHits.push(f.replace(dist, "").replace(/\\/g, "/"));
    const ids = pool.map((q) => q.id).filter((id) => body.includes(`"${id}"`));
    if (ids.length) poolHits.push(`${f.replace(dist, "")}: pool ids ${ids.slice(0, 3).join(", ")}`);
  }
  ok(poolHits.length === 0, `built bundle has no question text, options, explanations or pool ids (${secrets.length} strings checked)${poolHits.length ? " — " + poolHits.slice(0, 3).join(" · ") : ""}`);
  // "correctIndex" may appear only as a field NAME in the staff-only Admin chunk (the raid form and
  // pool upload send it TO the server); never in the code a player's phone loads.
  ok(keyHits.every((f) => /\/assets\/Admin-[\w-]+\.js$/.test(f)), `"correctIndex" only in the Admin chunk (field name of the upload form): ${keyHits.join(", ") || "nowhere"}`);
  const playerChunks = text.filter((f) => /\/assets\/(index|Home|Catch|Scan|Raid|Dex|Me|Leaderboard)-/.test(f.replace(/\\/g, "/")));
  ok(playerChunks.every((f) => !/correctIndex|explanation"?:/.test(readFileSync(f, "utf8"))), `player chunks (${playerChunks.length}) never mention correctIndex`);

  // --- A2: no question files in the public folder or hosting output.
  const publicFiles = files(join(ROOT, "web/public")).map((f) => f.replace(/\\/g, "/"));
  ok(!publicFiles.some((f) => /question|pool|challenge/i.test(f)), "web/public has no question/pool files");
  ok(!files(dist).some((f) => /question|pool|challenges-2026/i.test(f)), "web/dist (Hosting) has no question/pool files");

  // --- A3: the deployed Hosting files (live + preview), if reachable.
  for (const site of ["https://decade-hunt-66f6e.web.app", "https://decade-hunt-66f6e--det-ui-agd4jp3j.web.app"]) {
    const index = await fetch(site).then((r) => r.text()).catch(() => null);
    if (!index) {
      ok(true, `${site}: not reachable from here — skipped`);
      continue;
    }
    const assets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
    const lazy = new Set();
    let hits = 0;
    for (const a of assets) {
      const body = await fetch(site + a).then((r) => r.text());
      for (const m of body.matchAll(/"\.?\/?(?:assets\/)?([\w-]+-[\w-]{8}\.js)"/g)) lazy.add(`/assets/${m[1]}`);
      hits += secrets.filter((s) => body.includes(s)).length;
    }
    for (const a of lazy) {
      const body = await fetch(site + a).then((r) => r.text()).catch(() => "");
      hits += secrets.filter((s) => body.includes(s)).length;
    }
    const poolUrl = await fetch(`${site}/question-pool-2026.json`).then((r) => r.text());
    ok(!poolUrl.trim().startsWith("["), `${site}: /question-pool-2026.json is not served`);
    ok(hits === 0, `${site}: ${assets.length + lazy.size} deployed files carry no question data${hits ? ` — ${hits} pool strings found (the old Admin example; fixed in the code, needs a Hosting redeploy)` : ""}`);
  }
}

// --- A4 + D: every network response during play; App Check header on every function call.
await pinQuestions();
const { browser, page, errors } = await launch();
const responses = [];
const fnRequests = [];
page.on("request", (r) => {
  if (r.url().includes(":5001/") || r.url().includes("/api/forfeit")) fnRequests.push({ url: r.url(), appCheck: r.headers()["x-firebase-appcheck"] ?? null });
});
page.on("response", async (r) => {
  if (!/:5001\/|:8085\/|\/api\/forfeit/.test(r.url())) return;
  const body = await r.text().catch(() => "");
  responses.push({ url: r.url(), body, at: Date.now() });
});
const { uid } = await signUp(page, { tag: "sec" });
// Real pool questions too (not just the pinned samples): unpin 2023.
await adb.doc("_emulator/pins").update({ "byLingo.lingo-2023": null }).catch(() => {});
for (const lingo of ["lingo-2018", "lingo-2023", "lingo-2016"]) {
  await startCatch(page, lingo);
  const attempt = (await openAttempt(uid)).data();
  const q = attempt.question;
  const beforeAnswer = responses.filter((r) => r.url.includes("startAttempt"));
  const startBody = beforeAnswer.at(-1)?.body ?? "";
  const leaks = [/correctIndex/, /"order"/, /"accept"/, /explanation/].filter((re) => re.test(startBody));
  ok(leaks.length === 0, `${lingo} (${q.type}): startAttempt response has no answer data${leaks.length ? " — " + leaks.join(" ") : ""}`);
  if (q.explanation && !(q.options ?? []).includes(q.explanation)) ok(!startBody.includes(q.explanation), `${lingo}: explanation not sent before answering`);
  if (q.type === "meaning" || q.type === "question") {
    // Tap a wrong option (the right one is only known server-side).
    await page.getByRole("radio").nth(attempt.order.indexOf((q.correctIndex + 1) % 4)).click();
    await page.getByRole("button", { name: "Continue" }).click();
  } else {
    await say(page, "zzz");
  }
  await page.locator(".result").waitFor({ timeout: 20000 });
}
const firestoreBodies = responses.filter((r) => r.url.includes(":8085/")).map((r) => r.body).join("\n");
ok(!secrets.some((s) => firestoreBodies.includes(s)) && !/correctIndex/.test(firestoreBodies), `Firestore traffic (${responses.filter((r) => r.url.includes(":8085/")).length} responses) never carries question data`);
const fnCalls = fnRequests.filter((r) => !r.url.includes("OPTIONS"));
ok(fnCalls.length > 0 && fnCalls.every((r) => r.appCheck && r.appCheck.split(".").length === 3), `every function call carries an App Check token (${fnCalls.length} calls)`);

// Forfeit request carries App Check too (tab switch mid-question).
await startCatch(page, "lingo-2019");
const forfeitedId = (await openAttempt(uid)).id;
const before = fnRequests.length;
await page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForTimeout(1500);
const forfeit = fnRequests.slice(before).find((r) => r.url.includes("forfeit"));
// The server refuses a forfeit without a valid App Check token, so "forfeit" on the server proves it
// (WebKit doesn't show keepalive requests to the test, Chromium does: then the header is checked too).
const status = (await adb.doc(`attempts/${forfeitedId}`).get()).data().status;
ok(status === "forfeit" && (!forfeit || !!forfeit.appCheck), `the forfeit request is accepted with its App Check token (server: ${status}${forfeit ? ", header seen" : ""})`);

// --- K: the phone clock set 3 days ahead changes nothing.
const k = await launch({ init: ["(() => { const off = 3 * 86400e3; const D = Date; class FakeDate extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } } window.Date = FakeDate; })();"] });
const { uid: kUid } = await signUp(k.page, { tag: "clock" });
ok((await k.page.locator("[data-game-clock]").count()) === 0, "phone 3 days ahead: Home still open (no 'over'/'starts in')");
await startCatch(k.page, "lingo-2018");
const shown = await k.page.locator(".timer-seconds").getAttribute("data-seconds");
ok(Number(shown) >= 12 && Number(shown) <= 15, `phone 3 days ahead: timer shows ${shown} s (server time)`);
const kAttempt = (await openAttempt(kUid)).data();
ok(kAttempt.date === new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), `attempt dated by the server (${kAttempt.date})`);
await k.browser.close();
await finish(browser, [...errors, ...k.errors]);
