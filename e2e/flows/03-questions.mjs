// 3. Each question type: Choose the Meaning, Fill in the Blanks, Read Aloud — the right answer WINS,
//    every wrong option FAILS (all 3), a time-out fails, a late answer is rejected.
//    Pins (lib.mjs): 2016/2020 Read Aloud "programme", 2018/2022 meaning "reluctant", 2019/2023 blank.
import { adb, answerChoice, finish, launch, ok, openAttempt, patchConfig, pinQuestions, resultOutcome, resultText, say, shot, signUp, startCatch, Timestamp } from "../lib.mjs";

await pinQuestions();
const { browser, page, errors } = await launch();

/** Two tries per Lingo: wrong, wrong on the first Lingo; wrong, right on the second. */
async function choiceType(label, lingos, wrong, right) {
  await signUp(page, { tag: "q" });
  const plan = [
    [lingos[0], wrong[0], "failed"],
    [lingos[0], wrong[1], "failed"],
    [lingos[1], wrong[2], "failed"],
    [lingos[1], right, "won"],
  ];
  for (const [lingo, option, expected] of plan) {
    await startCatch(page, lingo);
    const task = (await page.locator("[data-task]").innerText()).trim();
    ok(task.toLowerCase() === label.toLowerCase(), `${lingo}: task label "${task}"`);
    if (label === "Fill in the Blanks") ok((await page.locator(".q-blank").count()) === 1, `${lingo}: the blank is drawn`);
    // Submit is disabled until an option is picked.
    ok(await page.getByRole("button", { name: "Submit" }).isDisabled(), `${lingo}: Submit disabled before picking`);
    const outcome = await answerChoice(page, option);
    ok(outcome === expected, `${label}: "${option}" → ${outcome} (expected ${expected})`);
    if (expected === "failed") {
      const t = await resultText(page);
      ok(t.includes(right), `${label}: wrong answer shows the right one ("${right}") after answering`);
    }
  }
  await shot(page, `03-${label.replace(/\s+/g, "-")}-won`);
}

await choiceType("Choose the Meaning", ["lingo-2018", "lingo-2022"], ["excited", "tired", "careful"], "unwilling");
await choiceType("Fill in the Blanks", ["lingo-2019", "lingo-2023"], ["for", "from", "at"], "since");

// Read Aloud: wrong word fails, the word wins, an accepted spelling wins.
await signUp(page, { tag: "ra" });
await startCatch(page, "lingo-2016");
ok((await page.locator("[data-task]").innerText()).trim().toLowerCase() === "read aloud", "Read Aloud task label");
await say(page, "apple");
ok((await resultOutcome(page)) === "failed", "Read Aloud: wrong word → failed");
ok((await resultText(page)).includes("We heard: “apple”"), "Read Aloud: shows what was heard");
await page.locator("[data-retry]").click();
await startCatch(page, "lingo-2016", { goto: false });
await say(page, "programme");
ok((await resultOutcome(page)) === "won", "Read Aloud: the word → won (2nd try)");
await startCatch(page, "lingo-2020");
await say(page, "program");
ok((await resultOutcome(page)) === "won", "Read Aloud: accepted spelling 'program' → won");

// Time-out: nothing picked when the clock runs out → failed.
const restore = await patchConfig({ "rules.meaningSeconds": 3 });
try {
  await signUp(page, { tag: "to" });
  await startCatch(page, "lingo-2018");
  ok((await resultOutcome(page)) === "failed", "time-out with nothing picked → failed");
  // Time-out with an option picked → that answer is sent (the right one wins).
  await page.locator("[data-retry]").click();
  await startCatch(page, "lingo-2018", { goto: false });
  await page.getByRole("radio", { name: /unwilling$/ }).click();
  ok((await resultOutcome(page)) === "won", "time-out with the right option picked → it is sent and wins");
} finally {
  await restore();
}

// Late answer: the server's clock says the attempt expired (beyond the 2 s grace) → rejected.
const { uid } = await signUp(page, { tag: "late" });
await startCatch(page, "lingo-2018");
const open = await openAttempt(uid);
await open.ref.update({ expiresAt: Timestamp.fromMillis(Date.now() - 2500) });
const outcome = await answerChoice(page, "unwilling");
ok(outcome === "late" && (await resultText(page)).includes("Time was up"), `late right answer → "${outcome}" (Time was up)`);
const a = (await open.ref.get()).data();
const u = (await adb.doc(`users/${uid}`).get()).data();
ok(a.status === "forfeit" && u.points === 0, `late: attempt ${a.status}, 0 points (got ${u.points})`);
await finish(browser, errors);
