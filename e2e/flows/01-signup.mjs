// 1. Sign up (email/password + Google), email verification, profile name, countdown before startAt,
//    game open after startAt.
import { adb, BASE, finish, launch, ok, patchConfig, resetServerClock, setServerClock, shot, signUp, startCatch, pinQuestions, Timestamp } from "../lib.mjs";

await pinQuestions();
const { browser, ctx, page, errors } = await launch();

// Email + password: verification screen first, then the profile name, then Home.
await page.goto(BASE);
const email = `su${Date.now()}@e2e.test`;
await page.getByRole("button", { name: /Create an account/ }).click();
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("secret123");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/setup", { timeout: 20000 });
await page.getByText(/verify your email/i).first().waitFor({ timeout: 15000 });
ok(true, "email sign-up → 'Verify your email' before anything else");
ok((await page.getByLabel("Full name").count()) === 0, "no profile form before the email is verified");
await page.getByRole("button", { name: "Open the verification link (emulator)" }).click({ timeout: 8000 });
await page.getByLabel("Full name").waitFor({ timeout: 15000 });
await page.getByLabel("Full name").fill("Asha Verma");
await page.getByRole("button", { name: "Start hunting" }).click();
await page.waitForURL("**/home", { timeout: 20000 });
await page.locator(".home").getByText(/hi asha/i).waitFor({ timeout: 10000 }).then(() => ok(true, "profile name shown on Home after setup"), () => ok(false, "profile name shown on Home after setup"));
await shot(page, "01-home");

// Google sign-in (Auth emulator's popup): Google accounts are verified → straight to the name.
const g = await launch();
await g.page.goto(BASE);
const [popup] = await Promise.all([g.page.waitForEvent("popup"), g.page.getByRole("button", { name: /Continue with Google/ }).click()]);
await popup.getByText(/Add new account/i).click({ timeout: 15000 });
await popup.locator("#email-input").fill(`google${Date.now()}@gmail.com`).catch(() => {});
await popup.getByText(/Auto-generate user information/i).click().catch(() => {});
await popup.getByRole("button", { name: /Sign in with Google\.com/i }).click({ timeout: 10000 });
await g.page.waitForURL("**/setup", { timeout: 20000 });
const nameField = g.page.getByLabel("Full name");
await nameField.waitFor({ timeout: 15000 });
ok(true, "Google sign-in → profile form straight away (no email verification)");
await nameField.fill("Ravi Google");
await g.page.getByRole("button", { name: "Start hunting" }).click();
await g.page.waitForURL("**/home", { timeout: 20000 });
ok(true, "Google account reaches Home");
await g.browser.close();

// Before startAt: countdown on Home, Scan disabled, Start refused by the server.
const cfg = (await adb.doc("config/game").get()).data();
const startAt = cfg.startAt.toMillis();
await setServerClock(startAt - 2 * 3600e3 - 5 * 60e3);
await page.goto(BASE + "/home");
const clock = page.locator("[data-game-clock=before]");
await clock.waitFor({ timeout: 15000 });
const t = await clock.innerText();
ok(/starts in/i.test(t) && /0?2:0[45]:\d\d/.test(t), `countdown before startAt: "${t.replace(/\s+/g, " ")}"`);
ok(await page.locator("button.scan-hero-btn[disabled]").count() === 1, "Scan button disabled before the start");
await shot(page, "01-countdown");
await page.goto(BASE + "/catch/lingo-2018");
await page.getByRole("button", { name: "Start" }).click({ timeout: 25000 });
await page.getByText("The hunt hasn't started yet.").waitFor({ timeout: 15000 }).then(() => ok(true, "Start before startAt → 'hasn't started'"), () => ok(false, "Start before startAt → 'hasn't started'"));

// The countdown reaches 0 → Home switches to the open game without a reload.
await setServerClock(startAt - 4000);
await page.goto(BASE + "/home");
await page.locator("[data-game-clock=before]").waitFor({ timeout: 15000 });
await page.locator("a.scan-hero-btn").waitFor({ timeout: 20000 }).then(() => ok(true, "countdown hits 0 → Scan opens by itself"), () => ok(false, "countdown hits 0 → Scan opens by itself"));
ok((await page.locator("[data-game-clock]").count()) === 0, "countdown card gone once the game is open");

// After startAt: catching works.
await resetServerClock();
await startCatch(page, "lingo-2018");
ok(true, "after startAt: Start → question");

// After the lock: "The hunt is over".
const restore = await patchConfig({ locked: true });
try {
  await page.goto(BASE + "/home");
  await page.locator("[data-game-clock=over]").waitFor({ timeout: 15000 }).then(() => ok(true, "locked → 'The hunt is over' on Home"), () => ok(false, "locked → 'The hunt is over' on Home"));
} finally {
  await restore();
}
void Timestamp;
void ctx;
await finish(browser, errors);
