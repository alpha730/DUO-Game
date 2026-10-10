// 5. Points across IST midnights (fake server clock): first catch, repeat, favourite streak days
//    1→10 (+20 × day), Medium questions on days 1–5 and Hard from day 6, MAX + 1,000 once, the all-10
//    bonus once, a speed bonus on every win. The favourite (Winking Duo) is NOT pinned, so its
//    questions come from the real pool at the right level.
import { adb, addDays, patchConfig, Timestamp, answerChoice, BASE, finish, istDate, istMidnight, launch, ok, openAttempt, pinQuestions, DEFAULT_PINS, resetServerClock, resultOutcome, say, setServerClock, signUp, startCatch } from "../lib.mjs";

const FAV = "lingo-2018";
const FAV2 = "lingo-2019";
const pins = { ...DEFAULT_PINS };
delete pins[FAV];
await pinQuestions(pins);
const { browser, page, errors } = await launch();

/** Answers the open question correctly (reads the server's copy — tests only). */
async function answerRight(uid) {
  const q = (await (await openAttempt(uid)).ref.get()).data().question;
  if (q.type === "meaning" || q.type === "question") return answerChoice(page, q.options[q.correctIndex].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  await say(page, q.type === "pronounce" ? q.word : q.phrase);
  return resultOutcome(page);
}
const user = async (uid) => (await adb.doc(`users/${uid}`).get()).data();
const fav = async (uid) => (await adb.doc(`users/${uid}/catches/${FAV}`).get()).data();

// pointsLog is keyed by attemptId: track it from the open attempt before answering.
async function winTracked(uid, lingo) {
  await startCatch(page, lingo);
  const open = await openAttempt(uid);
  const level = open.data().level ?? null;
  const hardBadge = await page.locator("[data-level=hard]").count();
  const outcome = await answerRight(uid);
  const logs = (await adb.collection("pointsLog").where("attemptId", "==", open.id).get()).docs.map((d) => d.data());
  return { outcome, level, hardBadge, logs: Object.fromEntries(logs.map((l) => [l.reason, l.amount])) };
}

const D0 = addDays(istDate(), 1);
const at = (d) => setServerClock(istMidnight(addDays(D0, d)) + 10 * 3600e3); // 10:00 IST on day d

// The 14 fake days run past the real lock (Oct 22): move the lock out for this flow only.
const restoreConfig = await patchConfig({ lockAt: Timestamp.fromMillis(istMidnight(addDays(D0, 30))) });
try {
  await at(0);
  const { uid } = await signUp(page, { tag: "pts" });

  // Day 0: first catches (+100 each) → pick the 2 favourites.
  let r = await winTracked(uid, FAV);
  ok(r.outcome === "won" && r.logs.firstCatch === 100, `first catch → +100 (${JSON.stringify(r.logs)})`);
  ok(r.logs.speed > 0, `speed bonus on the win (+${r.logs.speed})`);
  r = await winTracked(uid, FAV2);
  ok(r.logs.firstCatch === 100, "2nd first catch → +100");
  await page.locator("[data-needs-favorites]").click({ timeout: 10000 });
  await page.waitForURL("**/favorites");
  await page.getByRole("button", { name: /Winking Duo/ }).click();
  await page.getByRole("button", { name: /Thumbs-Up Duo/ }).click();
  await page.getByRole("button", { name: "Save favourites" }).click();
  await page.waitForURL("**/home", { timeout: 15000 });
  ok((await user(uid)).favorites.sort().join() === [FAV, FAV2].join(), "favourites saved");

  // Days 1–10: catch the favourite every day; the other 8 Lingos over days 1–3 (all-10 on day 3).
  const others = ["lingo-2016", "lingo-2017", "lingo-2020", "lingo-2021", "lingo-2022", "lingo-2023", "lingo-2024", "lingo-2025"];
  let allTenSeen = 0;
  let maxSeen = 0;
  for (let d = 1; d <= 10; d++) {
    await at(d);
    await page.goto(BASE + "/home");
    r = await winTracked(uid, FAV);
    const expectLevel = d >= 6 ? "hard" : "medium";
    ok(r.outcome === "won" && r.logs.favoriteCatch === 20 * d, `day ${d}: favourite → +${r.logs.favoriteCatch} (expected ${20 * d})`);
    ok(r.level === expectLevel && (r.hardBadge === 1) === (d >= 6), `day ${d}: ${r.level} question${r.hardBadge ? " + Hard badge" : ""} (expected ${expectLevel})`);
    const c = await fav(uid);
    const lvl = d >= 10 ? "MAX" : d >= 6 ? 3 : d >= 3 ? 2 : 1;
    ok(c.favStreak === d && c.level === lvl, `day ${d}: streak ${c.favStreak}, level ${c.level} (expected ${d}, ${lvl})`);
    if (r.logs.max) maxSeen++;
    if (r.logs.allTen) allTenSeen++;
    if (d === 10) ok(r.logs.max === 1000, `day 10: MAX bonus +${r.logs.max}`);
    // Other Lingos: 3 a day on days 1–3 (the favourite is the 4th).
    if (d <= 3) {
      for (const l of others.splice(0, 3)) {
        const o = await winTracked(uid, l);
        if (o.logs.allTen) allTenSeen++;
        ok(o.outcome === "won" && o.logs.firstCatch === 100, `day ${d}: first catch of ${l} → +100`);
      }
    }
    if (d === 4) {
      // A repeat catch of a non-favourite → +20.
      const o = await winTracked(uid, "lingo-2016");
      ok(o.logs.repeatCatch === 20 && !o.logs.firstCatch, `day 4: repeat catch (non-favourite) → +${o.logs.repeatCatch}`);
    }
  }
  ok(allTenSeen === 1, `all-10 bonus given exactly once (${allTenSeen})`);
  ok(maxSeen === 1, `MAX bonus given exactly once (${maxSeen})`);
  // Day 11: still MAX, 200 a day (capped), no second MAX bonus.
  await at(11);
  r = await winTracked(uid, FAV);
  ok(r.logs.favoriteCatch === 200 && !r.logs.max, `day 11: capped at +200, no 2nd MAX bonus (${JSON.stringify(r.logs)})`);
  // Points on the user = sum of the log.
  const log = (await adb.collection("pointsLog").where("uid", "==", uid).get()).docs.reduce((s, d) => s + d.data().amount, 0);
  ok((await user(uid)).points === log, `user points ${(await user(uid)).points} = points log total ${log}`);
  // A missed day resets the streak, the level stays.
  await at(13);
  r = await winTracked(uid, FAV);
  const c = await fav(uid);
  ok(c.favStreak === 1 && c.level === "MAX" && r.logs.favoriteCatch === 20, `missed day 12 → streak 1 again, level stays MAX, +${r.logs.favoriteCatch}`);
} finally {
  await resetServerClock();
  await restoreConfig();
}
await finish(browser, errors);
