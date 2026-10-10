// 2. Scan → poster found → the right Duo name → Catch it → the Catch screen for that Lingo.
import { BASE, finish, launch, ok, posterFound, shot, signUp } from "../lib.mjs";

const NAMES = ["Rookie Duo", "Curious Duo", "Winking Duo", "Thumbs-Up Duo", "Fierce Duo", "Lovestruck Duo", "Joyful Duo", "Bookworm Duo", "Cool Duo", "Champion Duo"];

const { browser, page, errors } = await launch();
await signUp(page, { tag: "scan" });

await page.goto(BASE + "/scan");
for (let i = 0; i < 10; i++) {
  const card = await posterFound(page, i);
  const name = (await card.locator("h2").innerText()).trim();
  ok(name === NAMES[i], `poster ${i + 1} → "${name}" (expected ${NAMES[i]})`);
  ok((await card.innerText()).includes(String(2016 + i)), `poster ${i + 1} card shows its DET year ${2016 + i}`);
  await page.evaluate((n) => window.__posterLost(n), i);
  await card.waitFor({ state: "detached", timeout: 10000 }).then(
    () => ok(true, `poster ${i + 1} lost → card hidden`),
    () => ok(false, `poster ${i + 1} lost → card hidden`),
  );
}

// Catch it → /catch/lingo-2018 with the same name.
const card = await posterFound(page, 2);
await shot(page, "02-scan-card");
await card.getByRole("link", { name: /Catch it/ }).click();
await page.waitForURL("**/catch/lingo-2018", { timeout: 15000 });
await page.getByRole("heading", { name: "Catch Winking Duo" }).waitFor({ timeout: 15000 }).then(
  () => ok(true, "Catch it → Catch Winking Duo"),
  () => ok(false, "Catch it → Catch Winking Duo"),
);
await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 25000 }).then(
  () => ok(true, "pre-flight done (mic + location) → Start shown"),
  () => ok(false, "pre-flight done (mic + location) → Start shown"),
);

// Close (X) leaves the scanner.
await page.goto(BASE + "/scan");
await page.waitForFunction(() => typeof window.__posterFound === "function", null, { timeout: 30000 });
await page.getByRole("link", { name: /close|back/i }).first().click();
await page.waitForURL("**/home", { timeout: 10000 }).then(() => ok(true, "close → Home"), () => ok(false, "close → Home"));
await finish(browser, errors);
