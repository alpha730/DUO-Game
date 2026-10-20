// 15. One-day event (docs/ONE-DAY-EVENT.md) on the emulator: scripts/oneDayEvent.ts sets 3 short
//     rounds (10:00–10:20, 10:30–10:50, 11:00–11:20 IST today) and the fake server clock walks
//     through them. Checks: the round line under the HUD, "Round N starts at…" between rounds (HUD
//     + a refused Start that uses no try), both favourites going Lv 1 → Lv 2 → MAX over the 3 rounds
//     (+1000, favMaxCount 2 = qualified), "All rounds are over", and Rules showing the rounds.
//     config/game and the clock are put back at the end, so the other flows are unaffected.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { adb, answerChoice, BASE, finish, istDate, launch, makeUser, ok, pinQuestions, resetServerClock, setServerClock, shot, signIn, startCatch } from "../lib.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DATE = istDate();
const at = (hhmm) => Date.parse(`${DATE}T${hhmm}:00+05:30`);
const FAV = [
  { id: "lingo-2018", name: "Winking Duo", answer: "unwilling" },
  { id: "lingo-2019", name: "Thumbs-Up Duo", answer: "since" },
];

const configRef = adb.doc("config/game");
const configBefore = (await configRef.get()).data();
const { browser, page, errors } = await launch();
let p = null; // the player — removed at the end (a qualified player would top other flows' Top 20)

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
  ok((await meStreak.innerText()).trim() === "rounds in a row", `wording: Me streak stat "${(await meStreak.innerText()).trim()}"`);
  await page.goto(BASE + "/scan");
  const chip = page.locator(".scan-chip[data-left]");
  await chip.waitFor({ timeout: 20000 });
  ok((await chip.getAttribute("title")) === "Lingos left this round", `wording: Scan chip tooltip "${await chip.getAttribute("title")}"`);
  await shot(page, "15-round1-favourites");

  // --- Between rounds (10:25): "Round 2 starts at 10:30" — HUD + a refused Start that uses no try.
  await setServerClock(at("10:25"));
  r = await roundLine();
  ok(r.text === "Round 2 of 3 starts at 10:30" && r.active === "false", `between rounds: HUD line "${r.text}"`);
  ok((await page.locator(".hud-left strong").innerText()).trim() === "4/4", "between rounds: the next round's 4 Lingos are shown full");
  await shot(page, "15-between-rounds");
  const before = (await adb.doc(`users/${p.uid}`).get()).data();
  await page.goto(BASE + `/catch/${FAV[0].id}`);
  await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 25000 });
  const head = (await page.locator(".catch-head").innerText()).replace(/\s+/g, " ");
  ok(head.includes("Lingos left this round: 4/4"), `wording: Catch header "${head}"`);
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
} finally {
  await resetServerClock();
  if (configBefore) await configRef.set(configBefore); // back to the multi-day game for the other flows
  if (p) {
    const catches = await adb.collection(`users/${p.uid}/catches`).get();
    await Promise.all([...catches.docs.map((d) => d.ref.delete()), adb.doc(`users/${p.uid}`).delete()]);
  }
}
ok(!(await configRef.get()).data().rounds, "config/game restored (no rounds)");
ok(!p || !(await adb.doc(`users/${p.uid}`).get()).exists, "the flow's player is removed (no leftover for other flows)");
await finish(browser, errors);
