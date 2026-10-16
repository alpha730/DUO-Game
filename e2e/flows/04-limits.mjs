// 4. Daily limits + the one-chance rule: 2 tries per Lingo (rule change Oct 10, was 1), a 5th different
//    Lingo is blocked, forfeit on tab switch / reload / a second tab, auto-forfeit when the app reopens.
import { adb, answerChoice, BASE, callFn, FOUNDATION, finish, launch, ok, openAttempt, pinQuestions, resultOutcome, resultText, signUp, startCatch } from "../lib.mjs";

await pinQuestions();
const { browser, ctx, page, errors } = await launch();
const user = async (uid) => (await adb.doc(`users/${uid}`).get()).data();
const hide = (p) =>
  p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

// --- Tries: miss twice → closed; 4 different Lingos → the 5th is blocked; a 2nd try still works.
let { uid } = await signUp(page, { tag: "lim" });
await startCatch(page, "lingo-2018");
ok((await answerChoice(page, "excited")) === "failed", "Lingo A try 1 wrong → failed");
ok((await resultText(page)).includes("One more try at Winking Duo"), "after the 1st miss → 'One more try'");
await page.locator("[data-retry]").click();
ok((await page.locator("[data-try-number]").innerText()).includes("Try 2 of 2"), "header: Try 2 of 2");
await startCatch(page, "lingo-2018", { goto: false });
ok((await answerChoice(page, "tired")) === "failed", "Lingo A try 2 wrong → failed");
ok((await page.locator("[data-retry]").count()) === 0 && (await resultText(page)).includes("closed for today"), "after 2 misses → closed for today, no retry");
await page.goto(BASE + "/catch/lingo-2018");
await page.getByRole("button", { name: "Start" }).click({ timeout: 25000 });
await page.getByText(/You've used your 2 tries at Winking Duo today/).waitFor({ timeout: 15000 }).then(() => ok(true, "3rd try refused by the server"), () => ok(false, "3rd try refused by the server"));
ok((await page.getByRole("button", { name: "Start" }).count()) === 0, "Start hidden after the refusal");

for (const l of ["lingo-2019", "lingo-2022", "lingo-2023"]) {
  await startCatch(page, l);
  await answerChoice(page, l === "lingo-2022" ? "careful" : "for");
}
ok((await user(uid)).attemptsToday === 4, "4 different Lingos tried → attemptsToday 4");
await page.goto(BASE + "/catch/lingo-2025");
await page.getByRole("button", { name: "Start" }).click({ timeout: 25000 });
await page.getByText(/You've tried 4 Lingos today — come back tomorrow/).waitFor({ timeout: 15000 }).then(() => ok(true, "5th different Lingo blocked"), () => ok(false, "5th different Lingo blocked"));
await startCatch(page, "lingo-2019");
ok((await answerChoice(page, "since")) === "won", "2nd try at one of the 4 still allowed with 0 Lingos left (and wins)");

// --- Tab switch mid-question → forfeit (server + screen).
({ uid } = await signUp(page, { tag: "tab" }));
await startCatch(page, "lingo-2018");
let attempt = await openAttempt(uid);
await hide(page);
ok((await resultOutcome(page)) === "forfeit" && /chance lost/i.test(await resultText(page)), "tab switch → 'Chance lost'");
await page.waitForTimeout(800);
ok((await attempt.ref.get()).data().status === "forfeit", "tab switch → attempt forfeited on the server");
ok((await user(uid)).losses === 1, "forfeit counts as a loss");

// --- Reload mid-question → forfeit, shown after the reload.
await page.goto(BASE + "/home");
await startCatch(page, "lingo-2019");
attempt = await openAttempt(uid);
await page.reload();
await page.locator(".result[data-outcome=forfeit]").waitFor({ timeout: 20000 }).then(() => ok(true, "reload → 'Chance lost' after the reload"), () => ok(false, "reload → 'Chance lost' after the reload"));
await page.waitForTimeout(800);
ok((await attempt.ref.get()).data().status === "forfeit", "reload → attempt forfeited on the server");

// --- A second tab starts another question → the first one is closed as a miss.
await startCatch(page, "lingo-2022");
const first = await openAttempt(uid);
const tab2 = await ctx.newPage();
await startCatch(tab2, "lingo-2023");
ok((await first.ref.get()).data().status === "forfeit", "2nd tab Start → the 1st tab's attempt is forfeited");
const open = await adb.collection("attempts").where("uid", "==", uid).where("status", "==", "open").get();
ok(open.size === 1, `only one open attempt (${open.size})`);
await page.bringToFront();
const outcomeA = await answerChoice(page, "unwilling").catch(() => "none");
ok(outcomeA === "forfeit", `answering in the 1st tab → "${outcomeA}" (no points)`);
await tab2.close();

// --- Auto-forfeit when the app reopens: an attempt left open (app killed) is closed by getMyState.
({ uid } = await signUp(page, { tag: "auto" }));
const email = (await (await import("../lib.mjs")).adminAuth.getUser(uid)).email;
const token = await (await import("../lib.mjs")).idTokenFor(email, "secret123");
const started = await callFn("startAttempt", { lingoId: "lingo-2018", ...FOUNDATION }, token);
ok(started.ok, "attempt started (app then 'killed')");
await page.goto(BASE + "/home");
// Poll (the emulator sometimes takes ~3 s per call) instead of a fixed wait.
let a;
for (let i = 0; i < 30; i++) {
  a = (await adb.doc(`attempts/${started.data.attemptId}`).get()).data();
  if (a.status !== "open") break;
  await page.waitForTimeout(500);
}
ok(a.status === "forfeit", `reopening the app auto-forfeits it (${a.status})`);
ok((await user(uid)).openAttemptId == null, "no open attempt left on the user");
await finish(browser, errors);
