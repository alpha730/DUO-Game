// 16. /stage — the projector screen (admin only, 16:9, light theme, no nav): the DET × JECRC lockup,
//     the round status + a big countdown (round end / next start / "All rounds are over"), the live
//     top 10 with "Fav MAX" badges (qualified first after the lock), "Refresh leaderboard", "Lock
//     game", and the sudden-death question (hard, 4 options; the answer only after "Reveal answer";
//     "Next question" never repeats). config/game, the board and the clock are put back at the end.
import { adb, BASE, callFn, finish, launch, makeUser, ok, resetServerClock, setServerClock, shot, signIn, Timestamp } from "../lib.mjs";

const configRef = adb.doc("config/game");
const boardRef = adb.doc("leaderboard/students");
const configBefore = (await configRef.get()).data();
const boardBefore = (await boardRef.get()).data();
const MIN = 60_000;
const now = Date.now();
// Round 1 running now (ends in 10 min), round 2 in 20–30 min.
const rounds = [
  { startAt: now - 5 * MIN, endAt: now + 10 * MIN },
  { startAt: now + 20 * MIN, endAt: now + 30 * MIN },
];
const row = (uid, name, points, favMax) => ({ uid, name, points, accuracy: 0.9, avgAnswerMs: 4000, favMax });
// Leaderboard order (points first): the qualified players are 3rd and 4th, behind two who aren't.
const BOARD = [
  row("s-a", "Asha Points", 9000, 1),
  row("s-b", "Bilal Points", 8500, 0),
  row("s-c", "Chitra Qualified", 8000, 2),
  ...Array.from({ length: 8 }, (_, i) => row(`s-x${i}`, `Player ${i + 4}`, 7000 - i * 100, 0)),
];
BOARD.splice(3, 0, row("s-d", "Dev Qualified", 7500, 2));

const admin = await makeUser({ name: "Stage Admin", role: "admin" });
const player = await makeUser({ name: "Stage Player" });
// A dark-mode laptop: the stage must still be the light theme.
const { browser, page, errors } = await launch({ colorScheme: "dark", viewport: { width: 1600, height: 900 } });
page.on("dialog", (d) => d.accept());
const nextBodies = [];
page.on("response", async (r) => {
  if (!r.url().includes("/adminStageQuestion")) return;
  const req = JSON.parse(r.request().postData() ?? "{}");
  if (req.data?.action === "next") nextBodies.push(await r.text().catch(() => ""));
});

try {
  await configRef.update({ rounds: rounds.map((r) => ({ startAt: Timestamp.fromMillis(r.startAt), endAt: Timestamp.fromMillis(r.endAt) })), startAt: Timestamp.fromMillis(rounds[0].startAt), lockAt: Timestamp.fromMillis(rounds[1].endAt), locked: false });
  await boardRef.set({ top: BOARD, updatedAt: Timestamp.now() });

  // --- A player is turned away, and can't call the stage question.
  await signIn(page, player.email);
  await page.goto(BASE + "/stage");
  ok(await page.getByText("Staff only").waitFor({ timeout: 15000 }).then(() => true, () => false), "a player can't open /stage");
  const denied = await callFn("adminStageQuestion", { action: "next" }, await player.idToken());
  ok(!denied.ok && denied.status === 403, `a player can't call adminStageQuestion (${denied.status})`);

  // --- The admin's projector screen.
  await signIn(page, admin.email);
  await page.goto(BASE + "/stage");
  const title = page.locator(".stage-round-title");
  await title.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll(".stage-row").length === 10, null, { timeout: 20000 }).catch(() => {});
  const look = await page.evaluate(() => {
    const s = document.querySelector(".stage").getBoundingClientRect();
    const bg = getComputedStyle(document.querySelector(".stage")).backgroundColor.match(/\d+/g).map(Number);
    return {
      ratio: s.width / s.height,
      theme: document.documentElement.getAttribute("data-theme"),
      bgLuma: (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000,
      nav: !!document.querySelector(".bottom-nav, nav.nav, .nav-bar"),
      lockup: !!document.querySelector(".stage-head .cobrand"),
      titlePx: parseFloat(getComputedStyle(document.querySelector(".stage-round-title")).fontSize),
      countdownPx: parseFloat(getComputedStyle(document.querySelector(".stage-countdown-time")).fontSize),
      scrolls: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      // everything inside its card and the 16:9 box
      spills: [...document.querySelectorAll(".stage-row, .stage-head img, .stage-foot .btn")].filter((e) => {
        const r = e.getBoundingClientRect();
        const box = (e.closest(".stage-board") ?? e.closest(".stage")).getBoundingClientRect();
        return r.top < box.top - 1 || r.bottom > box.bottom + 1;
      }).length,
    };
  });
  ok(Math.abs(look.ratio - 16 / 9) < 0.01, `16:9 (${look.ratio.toFixed(3)})`);
  ok(look.theme === "light" && look.bgLuma > 200, `light theme on a dark-mode laptop (data-theme ${look.theme}, background luma ${look.bgLuma})`);
  ok(!look.nav && look.lockup, "no nav; the DET × JECRC lockup in the header");
  ok(look.spills === 0, `nothing spills out of its card (${look.spills})`);
  ok(look.titlePx >= 60 && look.countdownPx >= 100 && !look.scrolls, `large type (title ${look.titlePx}px, countdown ${look.countdownPx}px), no scroll`);

  // Round status + countdown to the end of round 1 (about 10:00, counting down).
  ok((await title.innerText()).trim() === "Round 1 of 2", `round status "${(await title.innerText()).trim()}"`);
  const t1 = (await page.locator("[data-countdown]").innerText()).trim();
  await page.waitForTimeout(2100);
  const t2 = (await page.locator("[data-countdown]").innerText()).trim();
  const secs = (t) => t.split(":").reduce((a, x) => a * 60 + Number(x), 0);
  ok(/^\d\d:\d\d$/.test(t1) && secs(t1) > 9 * 60 && secs(t1) <= 10 * 60 && secs(t2) < secs(t1), `countdown to the round's end: ${t1} → ${t2}`);
  ok((await page.locator(".stage-countdown-label").innerText()).includes("until"), "countdown label says until when");

  // Live top 10, leaderboard order before the lock; Fav MAX badges.
  const names = () => page.$$eval(".stage-row .stage-name", (els) => els.map((e) => e.textContent));
  let order = await names();
  ok(order.length === 10 && order[0] === "Asha Points" && order[2] === "Chitra Qualified" && order[3] === "Dev Qualified", `top 10 in leaderboard order (${order.slice(0, 5).join(", ")})`);
  const badges = await page.$$eval(".stage-row", (els) => els.map((e) => ({ name: e.querySelector(".stage-name").textContent, fav: e.querySelector(".stage-fav")?.textContent?.trim() ?? null, q: e.dataset.qualified, mark: !!e.querySelector(".stage-qualified") })));
  const chitra = badges.find((b) => b.name === "Chitra Qualified");
  const asha = badges.find((b) => b.name === "Asha Points");
  ok(chitra.fav === "★★ Fav MAX" && chitra.q === "true" && chitra.mark, `qualified: "${chitra.fav}" + marked`);
  ok(asha.fav === "★ Fav MAX" && asha.q === "false" && !asha.mark, `one favourite at MAX: "${asha.fav}", not marked`);
  ok(badges.find((b) => b.name === "Bilal Points").fav === null, "no favourite at MAX: no badge");
  await shot(page, "16-stage-round");

  // --- Sudden death: a hard question, 4 options, no answer before "Reveal answer".
  await page.getByRole("button", { name: "Sudden-death question" }).click();
  await page.locator(".stage-question").waitFor({ timeout: 15000 });
  ok((await page.locator(".stage-option").count()) === 4, "sudden death: 4 options");
  ok((await page.locator(".stage-option[data-correct]").count()) === 0, "sudden death: no answer shown before the click");
  ok(nextBodies.length === 1 && !/correctIndex|"answer"|explanation|target/.test(nextBodies[0]), "sudden death: the question response carries no answer");
  const first = JSON.parse(nextBodies[0]).result.question;
  const qdoc = (await adb.doc(`questions/${first.id}`).get()).data();
  ok(qdoc?.level === "hard" && ["meaning", "question"].includes(qdoc.type), `sudden death: a hard ${qdoc?.type} question from the pool (${first.id})`);
  await shot(page, "16-stage-question");
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await page.locator(".stage-option[data-correct=true]").waitFor({ timeout: 15000 });
  const shown = (await page.locator(".stage-option[data-correct=true]").innerText()).replace(/^[A-D]\s*/, "").trim();
  ok(shown === qdoc.options[qdoc.correctIndex] && (await page.locator(".stage-option[data-correct=true]").count()) === 1, `Reveal answer: "${shown}" highlighted`);
  ok((await page.getByRole("button", { name: "Reveal answer" }).count()) === 0, "Reveal answer: the button goes once used");
  await shot(page, "16-stage-revealed");
  const sdSpill = await page.evaluate(() => {
    const box = document.querySelector(".stage-sd").getBoundingClientRect();
    return [...document.querySelectorAll(".stage-sd .stage-option, .stage-sd .btn")].filter((e) => e.getBoundingClientRect().bottom > box.bottom + 1).length;
  });
  ok(sdSpill === 0, `the question, 4 options and buttons fit in their card (${sdSpill} spill)`);
  // Next question × 6: never the same one twice this session.
  for (let i = 0; i < 6; i++) {
    const n = nextBodies.length;
    await page.getByRole("button", { name: "Next question" }).click();
    for (let t = 0; nextBodies.length === n && t < 300; t++) await page.waitForTimeout(50);
    await page.locator("[data-sudden-death=asking]").waitFor({ timeout: 15000 });
  }
  const ids = nextBodies.map((b) => JSON.parse(b).result.question.id);
  ok(ids.length === 7 && new Set(ids).size === 7, `Next question: 7 different questions (${ids.length} asked, ${new Set(ids).size} different)`);
  ok((await page.locator(".stage-option[data-correct]").count()) === 0, "Next question: the new one hides its answer again");

  // --- Between rounds (clock 15 min on): "Round 2 of 2" + the countdown to its start.
  await setServerClock(now + 15 * MIN);
  await page.reload();
  await title.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelector("[data-stage-round]")?.getAttribute("data-stage-round") === "between", null, { timeout: 15000 }).catch(() => {});
  const between = (await page.locator("[data-countdown]").innerText()).trim();
  ok((await title.innerText()).trim() === "Round 2 of 2" && secs(between) > 4 * 60 && secs(between) <= 5 * 60, `between rounds: "Round 2 of 2", ${between} to the start`);
  ok((await page.locator(".stage-countdown-label").innerText()).includes("starts"), "between rounds: counts to the start");
  // After the last round.
  await setServerClock(now + 31 * MIN);
  await page.reload();
  await page.waitForFunction(() => document.querySelector(".stage-round-title")?.textContent === "All rounds are over", null, { timeout: 20000 }).then(
    () => ok(true, 'after the last round: "All rounds are over"'),
    () => ok(false, 'after the last round: "All rounds are over"'),
  );
  ok((await page.locator("[data-countdown]").count()) === 0, "after the last round: no countdown");
  // After the lock, qualified players come first (each group in leaderboard order).
  await page.waitForFunction(() => document.querySelector(".stage-row .stage-name")?.textContent === "Chitra Qualified", null, { timeout: 10000 }).catch(() => {});
  order = await names();
  ok(order[0] === "Chitra Qualified" && order[1] === "Dev Qualified" && order[2] === "Asha Points", `after the lock: qualified first (${order.slice(0, 3).join(", ")})`);
  await shot(page, "16-stage-over");
  await resetServerClock();

  // --- Lock game (and reopen).
  await page.reload();
  await page.getByRole("button", { name: "Lock game" }).click();
  await page.getByText("Game locked.").waitFor({ timeout: 15000 });
  ok((await configRef.get()).data().locked === true, "Lock game: config/game locked");
  const overNow = await page.waitForFunction(() => document.querySelector(".stage-round-title")?.textContent === "All rounds are over", null, { timeout: 15000 }).then(() => true, () => false);
  ok(overNow, "locked: the stage says the rounds are over");
  order = await names();
  ok(order[0] === "Chitra Qualified", "locked: qualified first");
  await page.getByRole("button", { name: "Reopen game" }).click();
  await page.getByText("Game reopened.").waitFor({ timeout: 15000 });
  ok((await configRef.get()).data().locked === false, "Reopen game: unlocked");

  // --- Refresh leaderboard: rebuilt from the players (the planted rows go).
  await page.getByRole("button", { name: "Refresh leaderboard" }).click();
  await page.getByText(/Leaderboard refreshed \(/).waitFor({ timeout: 30000 });
  const rebuilt = (await boardRef.get()).data();
  ok(!rebuilt.top.some((r) => r.uid === "s-a"), "Refresh leaderboard: rebuilt from the players");
  order = await names();
  ok(!order.includes("Asha Points"), "Refresh leaderboard: the stage shows the new board at once");
} finally {
  await resetServerClock();
  if (configBefore) await configRef.set(configBefore);
  if (boardBefore) await boardRef.set(boardBefore);
  else await boardRef.delete();
  await Promise.all([admin, player].map((u) => adb.doc(`users/${u.uid}`).delete()));
}
await finish(browser, errors);
