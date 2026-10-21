// 15. One-day event (docs/ONE-DAY-EVENT.md) on the emulator: scripts/oneDayEvent.ts sets 3 short
//     rounds (10:00–10:20, 10:30–10:50, 11:00–11:20 IST today) and the fake server clock walks
//     through them. Checks: the round line under the HUD, "Round N starts at…" between rounds (HUD
//     + a refused Start that uses no try), both favourites going Lv 1 → Lv 2 → MAX over the 3 rounds
//     (+1000, favMaxCount 2 = qualified), "All rounds are over", Rules showing the rounds, and the
//     round line switching by itself at a round's end and the next start (no reload), --off, and the
//     admin "Test window" demo (one press → 3 rounds → Lv 1 → Lv 2 → MAX, Close, the event-day
//     refusal, restore).
//     config/game and the clock are put back at the end, so the other flows are unaffected.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { addDays, adb, answerChoice, BASE, finish, istDate, launch, makeUser, ok, pinQuestions, resetServerClock, setServerClock, shot, signIn, startCatch } from "../lib.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DATE = istDate();
const at = (hhmm) => Date.parse(`${DATE}T${hhmm}:00+05:30`);
const FAV = [
  { id: "lingo-2018", name: "Winking Duo", answer: "unwilling" },
  { id: "lingo-2019", name: "Thumbs-Up Duo", answer: "since" },
];

const configRef = adb.doc("config/game");
const configBefore = (await configRef.get()).data();
const publicRef = adb.doc("public/event");
const publicBefore = (await publicRef.get()).data();
const { browser, page, errors } = await launch();
let p = null; // the player — removed at the end (a qualified player would top other flows' Top 20)
let p2 = null; // the test-window player
let twAdmin = null;

try {
  // --- Turn the event on with the real script (3 short rounds today).
  const out = execFileSync("npx", ["tsx", "scripts/oneDayEvent.ts", "--date", DATE, "--rounds", "10:00-10:20,10:30-10:50,11:00-11:20"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085" },
  });
  ok(/Round 3: 11:00–11:20/.test(out) && /Written/.test(out), `oneDayEvent.ts wrote 3 rounds (${out.split("\n").filter(Boolean).slice(1, 4).join(" / ")})`);
  const cfg = (await configRef.get()).data();
  ok(cfg.rounds?.length === 3 && cfg.rules.favoritesCount === 2 && cfg.rules.favoriteChanges === 0 && cfg.rules.favMaxStreak === 3, "config/game: 3 rounds + one-day rules (2 favourites, no changes, MAX at 3)");
  const pub = (await publicRef.get()).data();
  ok(pub?.date === DATE && pub.rounds?.length === 3 && pub.rounds[0].startAt.toMillis() === at("10:00") && Object.keys(pub).sort().join() === "date,rounds", "public/event: { date, rounds } only (no rules or other game data)");

  // --- Signed out: the login screen and Rules show the round times (public/event).
  {
    const anon = await launch();
    await anon.page.goto(BASE + "/");
    const list = anon.page.locator("[data-login-rounds]");
    const shown = await list.waitFor({ timeout: 20000 }).then(() => true, () => false);
    const text = shown ? (await list.innerText()).replace(/\s+/g, " ") : "";
    ok(/Round 1 10:00–10:20/.test(text) && /Round 2 10:30–10:50/.test(text) && /Round 3 11:00–11:20/.test(text), `signed out: login shows the rounds ("${text}")`);
    ok((await anon.page.locator(".ticks").innerText()).includes("3 rounds on"), "signed out: login says 3 rounds on the day");
    await shot(anon.page, "15-login-rounds");
    await anon.page.goto(BASE + "/rules");
    const sec = anon.page.locator("[data-rules-section=rounds]");
    const rt = (await sec.waitFor({ timeout: 20000 }).then(() => sec.innerText(), () => "")).replace(/\s+/g, " ");
    ok(/Round 1 10:00 – 10:20/.test(rt) && /Round 3 11:00 – 11:20/.test(rt), `signed out: Rules shows the rounds (${rt.slice(0, 60)}…)`);
    ok((await anon.page.locator("[data-rules-section=daily]").count()) === 0 && (await anon.page.locator("[data-rules-section=favourites]").innerText()).includes("MAX"), "signed out: Rules uses the one-day tables");
    await shot(anon.page, "15-rules-signed-out", { fullPage: true });
    errors.push(...anon.errors);
    await anon.browser.close();
  }

  await pinQuestions();
  p = await makeUser({ name: "Round Runner" });
  await signIn(page, p.email);
  const roundLine = async () => {
    await page.goto(BASE + "/home");
    const line = page.locator(".hud-round");
    await line.waitFor({ timeout: 20000 });
    return { text: (await line.innerText()).trim(), active: await line.getAttribute("data-active") };
  };
  const catchDoc = async (id) => (await adb.doc(`users/${p.uid}/catches/${id}`).get()).data();
  const favBadge = async (id) => {
    await page.goto(BASE + "/home");
    const badge = page.locator(`.fav-card[data-lingo=${id}] .level-badge`);
    await badge.waitFor({ timeout: 20000 });
    return (await badge.innerText()).trim();
  };
  const win = async (f) => {
    await startCatch(page, f.id);
    return answerChoice(page, f.answer);
  };

  // --- Round 1 (10:05): the round line, first catches, pick both as favourites → Lv 1, streak 1.
  await setServerClock(at("10:05"));
  let r = await roundLine();
  ok(r.text === "Round 1 of 3 · until 10:20" && r.active === "true", `round 1: HUD line "${r.text}"`);
  const pill = (await page.locator(".attempts-pill .pips-label").innerText()).trim();
  ok(pill === "Lingos left this round:", `wording: Home pill "${pill}"`);
  await shot(page, "15-round1-home");
  for (const f of FAV) ok((await win(f)) === "won", `round 1: caught ${f.name}`);
  await page.goto(BASE + "/favorites");
  for (const f of FAV) await page.getByRole("button", { name: new RegExp(f.name) }).click();
  await page.getByRole("button", { name: "Save favourites" }).click();
  await page.waitForURL("**/home", { timeout: 15000 });
  const u1 = (await adb.doc(`users/${p.uid}`).get()).data();
  ok(u1.favorites.sort().join() === FAV.map((f) => f.id).join(), `round 1: both picked as favourites (${u1.favorites})`);
  for (const f of FAV) {
    const c = await catchDoc(f.id);
    ok(c.level === 1 && c.favStreak === 1 && c.lastCaughtDate === `${DATE}#R1`, `round 1: ${f.name} Lv 1, streak 1 kept after picking (level ${c.level}, streak ${c.favStreak}, ${c.lastCaughtDate})`);
  }
  ok((await favBadge(FAV[0].id)) === "Lv 1", "round 1: Home favourite card shows Lv 1");
  ok((await page.locator(`.fav-card[data-lingo=${FAV[0].id}] .fav-streak`).innerText()).includes("Round 1/3"), "round 1: favourite streak reads Round 1/3");
  const favHead = (await page.locator(".section-title", { hasText: "Favourites" }).innerText()).replace(/\s+/g, " ");
  ok(favHead.includes("3 rounds in a row = MAX"), `wording: Home favourites header "${favHead}"`);
  await page.goto(BASE + "/me");
  const meStreak = page.locator("[data-stat=streak] span").last();
  await meStreak.waitFor({ timeout: 20000 });
  // The wording follows getMyState.round, which may land just after the first paint.
  await page.waitForFunction(() => document.querySelector("[data-stat=streak] span:last-child")?.textContent?.trim() === "rounds in a row", null, { timeout: 15000 }).catch(() => {});
  ok((await meStreak.innerText()).trim() === "rounds in a row", `wording: Me streak stat "${(await meStreak.innerText()).trim()}"`);
  await page.goto(BASE + "/scan");
  const chip = page.locator(".scan-chip[data-left]");
  await chip.waitFor({ timeout: 20000 });
  ok((await chip.getAttribute("title")) === "Lingos left this round", `wording: Scan chip tooltip "${await chip.getAttribute("title")}"`);
  await shot(page, "15-round1-favourites");

  // --- Between rounds (10:25): "Round 2 starts at 10:30" — HUD + a refused Start that uses no try.
  await setServerClock(at("10:25"));
  r = await roundLine();
  ok(r.text === "Round 2 starts at 10:30" && r.active === "false", `between rounds: HUD line "${r.text}"`);
  ok((await page.locator(".hud-left strong").innerText()).trim() === "5/5", "between rounds: the next round's 5 Lingos are shown full");
  await shot(page, "15-between-rounds");
  const before = (await adb.doc(`users/${p.uid}`).get()).data();
  await page.goto(BASE + `/catch/${FAV[0].id}`);
  await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 25000 });
  await page.waitForFunction(() => /Lingos left/.test(document.querySelector(".catch-head")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
  const head = (await page.locator(".catch-head").innerText()).replace(/\s+/g, " ");
  ok(head.includes("Lingos left this round: 5/5"), `wording: Catch header "${head}"`);
  await page.getByRole("button", { name: "Start" }).click();
  const err = page.locator(".catch .error[role=alert]");
  await err.waitFor({ timeout: 15000 });
  const msg = (await err.innerText()).trim();
  ok(msg.startsWith("Round 2 starts at 10:30"), `between rounds: Start refused — "${msg}"`);
  await shot(page, "15-between-rounds-catch");
  const after = (await adb.doc(`users/${p.uid}`).get()).data();
  const openNow = await adb.collection("attempts").where("uid", "==", p.uid).where("status", "==", "open").get();
  ok(after.attemptsToday === before.attemptsToday && JSON.stringify(after.triesToday ?? {}) === JSON.stringify(before.triesToday ?? {}) && openNow.size === 0, "between rounds: no try used, no attempt opened");

  // Admin dashboard counts the round: "attempts this round / wins this round".
  {
    const admin = await makeUser({ name: "Round Admin", role: "admin" });
    const a = await launch();
    await signIn(a.page, admin.email);
    await a.page.goto(BASE + "/admin");
    const label = a.page.locator("[data-stat=attempts] .small");
    await label.waitFor({ timeout: 20000 });
    const wins = (await a.page.locator("[data-stat=wins] .small").innerText()).trim();
    ok((await label.innerText()).trim() === "attempts this round" && wins === "wins this round", `wording: admin "${(await label.innerText()).trim()}" / "${wins}"`);
    await a.browser.close();
    await adb.doc(`users/${admin.uid}`).delete();
  }

  // --- Round 2 (10:35): both favourites again → Lv 2 (streak 2, hard questions from now).
  await setServerClock(at("10:35"));
  r = await roundLine();
  ok(r.text === "Round 2 of 3 · until 10:50" && r.active === "true", `round 2: HUD line "${r.text}"`);
  for (const f of FAV) {
    ok((await win(f)) === "won", `round 2: caught ${f.name}`);
    const bd = (await page.locator(".breakdown").innerText()).replace(/\s+/g, " ");
    ok(bd.includes("Favourite · round 2"), `wording: win breakdown "${bd.slice(0, 60)}"`);
    const c = await catchDoc(f.id);
    ok(c.level === 2 && c.favStreak === 2 && c.lastCaughtDate === `${DATE}#R2`, `round 2: ${f.name} → Lv 2 (level ${c.level}, streak ${c.favStreak})`);
  }
  ok((await favBadge(FAV[0].id)) === "Lv 2", "round 2: Home favourite card shows Lv 2");
  await shot(page, "15-round2-favourites");

  // --- Round 3 (11:05): both again → MAX (+1000 each), favMaxCount 2 = qualified.
  await setServerClock(at("11:05"));
  r = await roundLine();
  ok(r.text === "Round 3 of 3 · until 11:20", `round 3: HUD line "${r.text}"`);
  for (const [k, f] of FAV.entries()) {
    await startCatch(page, f.id);
    await page.getByRole("radio", { name: new RegExp(`${f.answer}$`) }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator(".result[data-outcome=won]").waitFor({ timeout: 25000 });
    const card = page.locator(".celebration-card[data-big=max]");
    const shown = await card.waitFor({ timeout: 10000 }).then(() => true, () => false);
    ok(shown && (await card.innerText()).includes("3 rounds in a row"), `round 3: ${f.name} — MAX card "3 rounds in a row"`);
    if (k === 0) await shot(page, "15-round3-max");
    if (shown) await page.getByRole("button", { name: "Awesome!" }).click();
    const c = await catchDoc(f.id);
    ok(c.level === "MAX" && c.favStreak === 3 && c.maxBonusGiven === true, `round 3: ${f.name} → MAX (streak ${c.favStreak})`);
  }
  const u3 = (await adb.doc(`users/${p.uid}`).get()).data();
  ok(u3.favMaxCount === 2, `both favourites at MAX → favMaxCount ${u3.favMaxCount} (qualified)`);
  // 2 × (100 first catch + 50 × 2 in round 2 + 50 × 3 in round 3 + 1000 MAX), plus speed bonuses.
  ok(u3.points >= 2 * (100 + 100 + 150 + 1000), `points: ≥ 2 × (100 + 100 + 150 + 1000) = 2,700 (got ${u3.points} incl. speed)`);
  ok((await favBadge(FAV[0].id)) === "MAX", "round 3: Home favourite card shows MAX");
  await shot(page, "15-round3-favourites");

  // --- After the last round (11:25).
  await setServerClock(at("11:25"));
  r = await roundLine().catch(() => ({ text: "(no line)" }));
  ok(r.text === "All rounds are over", `after round 3: HUD line "${r.text}"`);

  // --- Rules: the rounds (IST), favourites + levels, winning; not the multi-day "Every day" table.
  await page.goto(BASE + "/rules");
  const rounds = page.locator("[data-rules-section=rounds]");
  await rounds.waitFor({ timeout: 20000 });
  const rt = (await rounds.innerText()).replace(/\s+/g, " ");
  ok(/Round 1 10:00 – 10:20/.test(rt) && /Round 2 10:30 – 10:50/.test(rt) && /Round 3 11:00 – 11:20/.test(rt), `Rules: the 3 rounds (${rt.slice(0, 90)}…)`);
  ok((await page.locator("[data-rules-section=winning]").innerText()).includes("both favourites to MAX"), "Rules: winning = both favourites at MAX");
  ok((await page.locator("[data-rules-section=favourites]").innerText()).includes("MAX"), "Rules: favourites and levels (Lv 1 → Lv 2 → MAX)");
  ok((await page.locator("[data-rules-section=daily]").count()) === 0, "Rules: no multi-day 'Every day' table");
  await shot(page, "15-rules", { fullPage: true });

  // --- Live round line: no reload. Rounds 11:30–11:31 and 11:32–11:40 (a 1-minute gap); the clock at
  //     11:30:55. Home switches to "Round 2 starts at 11:32" when round 1 ends, then (on Dex) to
  //     "Round 2 of 2 · until 11:40" when round 2 starts — the screen re-fetches getMyState itself.
  execFileSync("npx", ["tsx", "scripts/oneDayEvent.ts", "--date", DATE, "--rounds", "11:30-11:31,11:32-11:40"], {
    cwd: ROOT,
    shell: true,
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085" },
  });
  await setServerClock(at("11:30") + 55_000);
  r = await roundLine();
  ok(r.text === "Round 1 of 2 · until 11:31", `live: round 1 "${r.text}"`);
  const liveLine = (text, timeout) =>
    page.waitForFunction((t) => document.querySelector(".hud-round")?.textContent?.trim() === t, text, { timeout }).then(() => true, () => false);
  ok(await liveLine("Round 2 starts at 11:32", 20000), "live: Home switches to \"Round 2 starts at 11:32\" when round 1 ends (no reload)");
  await page.goto(BASE + "/dex");
  await page.locator(".hud-round").waitFor({ timeout: 20000 });
  ok((await page.locator(".hud-round").innerText()).trim() === "Round 2 starts at 11:32", "live: Dex shows the gap too");
  ok(await liveLine("Round 2 of 2 · until 11:40", 80000), "live: Dex switches to \"Round 2 of 2 · until 11:40\" when round 2 starts (no reload)");
  ok((await page.locator(".hud-round").getAttribute("data-active")) === "true", "live: the line is active again");

  // --- --off: rounds removed from config/game, public/event deleted → the multi-day game again.
  const dryOff = execFileSync("npx", ["tsx", "scripts/oneDayEvent.ts", "--off", "--dry-run"], { cwd: ROOT, encoding: "utf8", shell: true, env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085" } });
  ok(/remove 2 rounds/.test(dryOff) && /delete public\/event/.test(dryOff) && (await configRef.get()).data().rounds?.length === 2 && (await publicRef.get()).exists, "--off --dry-run: says what it would do, writes nothing");
  const lockBefore = (await configRef.get()).data().lockAt.toMillis();
  const off = execFileSync("npx", ["tsx", "scripts/oneDayEvent.ts", "--off"], { cwd: ROOT, encoding: "utf8", shell: true, env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085" } });
  const cfgOff = (await configRef.get()).data();
  ok(/Done/.test(off) && cfgOff.rounds === undefined && cfgOff.lockAt.toMillis() === lockBefore, "--off: rounds removed from config/game (times kept)");
  ok(!(await publicRef.get()).exists, "--off: public/event deleted");
  await resetServerClock();
  r = await roundLine().catch(() => ({ text: "(no line)" }));
  ok(r.text === "(no line)", `--off: no round line in the HUD (${r.text})`);
  {
    const anon = await launch();
    await anon.page.goto(BASE + "/");
    await anon.page.locator(".ticks").waitFor({ timeout: 20000 });
    await anon.page.waitForTimeout(1500); // the public/event read
    ok((await anon.page.locator("[data-login-rounds]").count()) === 0 && (await anon.page.locator(".ticks").innerText()).includes("final on Oct 22"), "--off: login shows no rounds (multi-day wording)");
    errors.push(...anon.errors);
    await anon.browser.close();
  }

  // --- Admin "Test window" → a 3-round demo (before the event). The real rounds are TOMORROW (like prod
  //     the day before). One press = 3 rounds of 5 min, 1 minute apart; the fake clock walks through
  //     them: a favourite caught in each goes Lv 1 → Lv 2 → MAX. Then Close (the rounds not started
  //     go), the event-day refusal and "Back to event times".
  const TOMORROW = addDays(istDate(), 1);
  execFileSync("npx", ["tsx", "scripts/oneDayEvent.ts", "--date", TOMORROW, "--rounds", "11:30-12:30,13:00-14:00,14:30-15:30"], { cwd: ROOT, shell: true, env: { ...process.env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085" } });
  await adb.doc("config/game").update({ locked: true }); // the event's times; play closed until a demo opens
  await resetServerClock();
  twAdmin = await makeUser({ name: "Demo Admin", role: "admin" });
  const adm = await launch({ viewport: { width: 420, height: 900 } });
  adm.page.on("dialog", (d) => d.accept());
  await signIn(adm.page, twAdmin.email);
  const card = adm.page.locator("[data-test-window]");
  const twState = (v) => adm.page.waitForFunction((x) => document.querySelector("[data-test-window]")?.getAttribute("data-test-window") === x, v, { timeout: 25000 }).then(() => true, () => false);
  const twButton = (name) => adm.page.getByRole("button", { name });
  const adminAt = async (state) => {
    await adm.page.goto(BASE + "/admin");
    const shown = await twState(state);
    return { shown, text: (await card.innerText()).trim() };
  };
  let a = await adminAt("event");
  ok(a.shown && a.text === "📅 Event times active", `demo card: "${a.text}"`);

  // One press → 3 rounds.
  await twButton("Open demo (3 rounds)").click();
  ok(await twState("open"), "demo: opened");
  a = { text: (await card.innerText()).trim() };
  ok(/^🧪 Demo round 1 of 3 · [45]:\d\d left$/.test(a.text), `demo: live countdown "${a.text}"`);
  const c1 = (await configRef.get()).data();
  const demo = c1.rounds.map((x) => ({ startAt: x.startAt.toMillis(), endAt: x.endAt.toMillis() })).filter((x) => !c1.eventBackup.rounds.some((y) => y.startAt.toMillis() === x.startAt)).sort((x, y) => x.startAt - y.startAt);
  const T = demo[0]?.startAt;
  ok(
    c1.eventBackup?.rounds?.length === 3 && c1.rounds.length === 6 && c1.locked === false && demo.length === 3 &&
      demo.every((x, i) => x.startAt === T + i * 6 * 60_000 && x.endAt === x.startAt + 5 * 60_000),
    "one press: the real rounds saved in eventBackup, 3 rounds appended ([now,+5] [+6,+11] [+12,+17]), unlocked",
  );
  await shot(adm.page, "15-demo-open");

  // Round 1: catch both, pick them as favourites → Lv 1.
  p2 = await makeUser({ name: "Demo Player" });
  await signIn(page, p2.email);
  await setServerClock(T + 30_000);
  r = await roundLine();
  ok(/^Round 1 of 6 · until \d\d:\d\d$/.test(r.text) && r.active === "true", `demo round 1: HUD "${r.text}"`);
  for (const f of FAV) ok((await win(f)) === "won", `demo round 1: caught ${f.name}`);
  await page.goto(BASE + "/favorites");
  for (const f of FAV) await page.getByRole("button", { name: new RegExp(f.name) }).click();
  await page.getByRole("button", { name: "Save favourites" }).click();
  await page.waitForURL("**/home", { timeout: 15000 });
  const wcOf = async () => (await adb.doc(`users/${p2.uid}/catches/${FAV[0].id}`).get()).data();
  let wc = await wcOf();
  ok(wc.level === 1 && wc.favStreak === 1 && wc.lastCaughtDate.endsWith("#R1"), `demo round 1: ${FAV[0].name} Lv 1, streak 1`);

  // The 1-minute gap.
  await setServerClock(T + 5 * 60_000 + 30_000);
  a = await adminAt("next");
  ok(/^Next demo round in 0:[0-3]\d$/.test(a.text), `demo gap: card "${a.text}"`);
  r = await roundLine();
  ok(/^Round 2 starts at \d\d:\d\d$/.test(r.text) && r.active === "false", `demo gap: HUD "${r.text}"`);

  // Round 2 → Lv 2.
  await setServerClock(T + 6 * 60_000 + 30_000);
  a = await adminAt("open");
  ok(/^🧪 Demo round 2 of 3 · [45]:\d\d left$/.test(a.text), `demo round 2: card "${a.text}"`);
  ok((await win(FAV[0])) === "won", `demo round 2: caught ${FAV[0].name}`);
  wc = await wcOf();
  ok(wc.level === 2 && wc.favStreak === 2, `demo round 2: ${FAV[0].name} → Lv 2 (streak ${wc.favStreak})`);

  // Round 3 → MAX.
  await setServerClock(T + 12 * 60_000 + 30_000);
  a = await adminAt("open");
  ok(/^🧪 Demo round 3 of 3 · [45]:\d\d left$/.test(a.text), `demo round 3: card "${a.text}"`);
  ok((await win(FAV[0])) === "won", `demo round 3: caught ${FAV[0].name}`);
  wc = await wcOf();
  ok(wc.level === "MAX" && wc.favStreak === 3 && wc.maxBonusGiven === true, `demo round 3: ${FAV[0].name} → MAX (streak ${wc.favStreak})`);
  ok((await favBadge(FAV[0].id)) === "MAX", "demo round 3: Home favourite card shows MAX");
  await shot(page, "15-demo-max");

  // After the demo: Closed.
  await setServerClock(T + 18 * 60_000);
  a = await adminAt("closed");
  ok(a.shown && a.text === "⏸ Closed", `after the demo: card "${a.text}"`);

  // Close: a new demo, closed in its round 1 → that round ends now, rounds 2 and 3 are removed.
  await twButton("Open demo (3 rounds)").click();
  ok(await twState("open"), "second demo: opened");
  ok((await configRef.get()).data().rounds.length === 9, "second demo: 3 more rounds (9)");
  await setServerClock(T + 19 * 60_000);
  await adminAt("open");
  await twButton("Close now").click();
  ok(await twState("closed"), "close: the card says Closed");
  const cc = (await configRef.get()).data();
  const closedAt = cc.rounds.map((x) => x.endAt.toMillis()).sort((x, y) => x - y);
  // (the click lands a few seconds after the clock was set: "now" = 19:00 + a little)
  const endedNow = closedAt.some((t) => t >= T + 19 * 60_000 && t < T + 20 * 60_000);
  ok(cc.rounds.length === 7 && endedNow, `close: round ended now, the 2 not started removed (${cc.rounds.length} rounds)`);
  r = await roundLine();
  ok(/^Round \d starts at 11:30$/.test(r.text), `closed: HUD "${r.text}" (tomorrow's round 1 comes next)`);

  // Refused on the event day: at 10:20 tomorrow the demo's 3 rounds would end at 10:37, past 10:30
  // (1 h before round 1 at 11:30).
  await setServerClock(Date.parse(`${TOMORROW}T10:20:00+05:30`));
  await adminAt("closed");
  await twButton("Open demo (3 rounds)").click();
  const refusal = adm.page.locator("section", { has: card }).locator(".error");
  await refusal.waitFor({ timeout: 15000 });
  const rtext = (await refusal.innerText()).trim();
  ok(/No demo on the event day: demos end at 10:30 IST \(1 h before round 1\).*after 15:30 IST/.test(rtext), `event day: refused — "${rtext}"`);
  ok((await configRef.get()).data().rounds.length === 7, "event day: nothing written");
  await resetServerClock();

  // Back to event times (confirmed): the real rounds, no backup, public/event rewritten.
  await adminAt("closed");
  await twButton("Back to event times").click();
  ok(await twState("event"), "restore: the card says Event times active");
  const cr = (await configRef.get()).data();
  ok(cr.rounds.length === 3 && cr.eventBackup === undefined && cr.startAt.toMillis() === Date.parse(`${TOMORROW}T11:30:00+05:30`) && cr.lockAt.toMillis() === Date.parse(`${TOMORROW}T15:30:00+05:30`), "restore: rounds, startAt, lockAt back; eventBackup gone");
  const pubR = (await publicRef.get()).data();
  ok(pubR?.date === TOMORROW && pubR.rounds.length === 3, "restore: public/event rewritten with the real rounds");
  r = await roundLine();
  ok(r.text === "Round 1 starts at 11:30", `restore: HUD "${r.text}"`);
  errors.push(...adm.errors);
  await adm.browser.close();
} finally {
  await resetServerClock();
  if (configBefore) await configRef.set(configBefore); // back to the multi-day game for the other flows
  if (publicBefore) await publicRef.set(publicBefore);
  else await publicRef.delete();
  for (const u of [p, p2]) {
    if (!u) continue;
    const catches = await adb.collection(`users/${u.uid}/catches`).get();
    await Promise.all([...catches.docs.map((d) => d.ref.delete()), adb.doc(`users/${u.uid}`).delete()]);
  }
  if (twAdmin) await adb.doc(`users/${twAdmin.uid}`).delete();
}
ok(!(await configRef.get()).data().rounds, "config/game restored (no rounds)");
ok(!(await publicRef.get()).exists || !!publicBefore, "public/event removed again (the multi-day game shows no rounds)");
ok(!p || !(await adb.doc(`users/${p.uid}`).get()).exists, "the flow's player is removed (no leftover for other flows)");
await finish(browser, errors);
