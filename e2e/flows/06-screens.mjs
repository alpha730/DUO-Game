// 6. Favourites pick + one change; Dex; Home; Leaderboard (podium, my row, refresh); Me (stats, QR,
//    share card, Light/Dark/System theme that survives a reload).
import jsQR from "jsqr";
import { adb, answerChoice, BASE, finish, launch, makeUser, ok, pinQuestions, shot, signUp, startCatch, Timestamp } from "../lib.mjs";

await pinQuestions();
const { browser, page, errors } = await launch();
const { uid } = await signUp(page, { tag: "scr", name: "Meera Screens" });

// Two catches (+1 fail for accuracy) through the UI.
await startCatch(page, "lingo-2018");
await answerChoice(page, "unwilling");
await startCatch(page, "lingo-2019");
await answerChoice(page, "since");
ok((await page.locator("[data-needs-favorites]").count()) === 1, "2nd catch → 'Pick your 2 favourites'");
await startCatch(page, "lingo-2022");
await answerChoice(page, "tired");

// --- Favourites: pick 2, then one change, then locked.
await page.goto(BASE + "/favorites");
await page.getByRole("button", { name: /Winking Duo/ }).click();
await page.getByRole("button", { name: /Thumbs-Up Duo/ }).click();
await page.getByRole("button", { name: "Save favourites" }).click();
await page.waitForURL("**/home", { timeout: 15000 });
await page.waitForFunction(() => document.querySelectorAll(".fav-card").length === 2, null, { timeout: 15000 }).then(() => ok(true, "Home shows the 2 favourite cards"), () => ok(false, "Home shows the 2 favourite cards"));
ok((await page.locator(".fav-card[data-lingo=lingo-2018]").getAttribute("data-state")) === "caught", "favourite card: caught today ✓");
// One change: give a catch of Joyful Duo first (server data) so there's a 3rd caught Lingo to pick.
await adb.doc(`users/${uid}/catches/lingo-2022`).set({ firstCaughtAt: Timestamp.now(), timesCaught: 1, lastCaughtDate: "2026-10-01", level: 1, favStreak: 0, maxBonusGiven: false });
await adb.doc(`users/${uid}`).update({ lingosCaught: 3 });
await page.goto(BASE + "/me");
await page.getByRole("link", { name: /Change favourites \(1 left\)/ }).click({ timeout: 15000 });
await page.locator("[data-warning]").waitFor();
ok((await page.locator("[data-warning]").innerText()).includes("resets the streak"), "change warns that streaks reset");
await page.getByRole("button", { name: /Thumbs-Up Duo/ }).click();
await page.getByRole("button", { name: /Joyful Duo/ }).click();
await page.getByRole("button", { name: "Save change" }).click();
await page.waitForURL("**/home", { timeout: 15000 });
const u = (await adb.doc(`users/${uid}`).get()).data();
ok(u.favorites.sort().join() === "lingo-2018,lingo-2022" && u.favoriteChangesLeft === 0, `one change saved (${u.favorites}, left ${u.favoriteChangesLeft})`);
await page.goto(BASE + "/favorites");
await page.locator("[data-warning]").waitFor();
ok((await page.locator("[data-warning]").innerText()).includes("used your one change") && (await page.getByRole("button", { name: /Save/ }).count()) === 0, "after the change: locked, no Save");

// --- Dex: 3 caught (levels), 7 silhouettes; detail sheet.
await page.goto(BASE + "/dex");
await page.locator(".dex-card[data-lingo]").first().waitFor({ timeout: 40000 });
await page.waitForFunction(() => document.querySelectorAll(".dex-card[data-caught=true]").length === 3, null, { timeout: 15000 }).catch(() => {});
ok((await page.locator(".dex-card[data-caught=true]").count()) === 3 && (await page.locator(".dex-card[data-caught=false]").count()) === 7, "Dex: 3 caught, 7 to find");
ok((await page.locator(".dex-progress, .dex-count").first().innerText()).includes("3"), "Dex progress shows 3/10");
await page.locator(".dex-card[data-lingo=lingo-2018]").click();
await page.locator(".dex-sheet").waitFor({ timeout: 5000 });
ok((await page.locator(".dex-sheet").innerText()).includes("Winking Duo"), "Dex detail sheet opens for Winking Duo");
await shot(page, "06-dex-sheet");
await page.getByRole("button", { name: "Close" }).click();

// --- Home HUD.
await page.goto(BASE + "/home");
await page.locator(".hud-points").waitFor();
const pts = Number((await page.locator(".hud-points").getAttribute("data-points")) ?? -1);
ok(pts === u.points, `Home HUD points ${pts} = server ${u.points}`);
ok((await page.locator(".hud-left").getAttribute("data-left")) === "1", "Home: 1 Lingo left today (3 tried)");

// --- Leaderboard: 3 others above/below, refresh, podium, my row.
const others = [];
for (const [name, points] of [["Top One", 9000], ["Top Two", 8000], ["Top Three", 7000]]) {
  const o = await makeUser({ name });
  await adb.doc(`users/${o.uid}`).update({ points, wins: 5, losses: 0, totalAnswerMs: 10000, pointsReachedAt: Timestamp.now() });
  others.push(o);
}
await page.goto(BASE + "/leaderboard");
await page.getByRole("button", { name: /Refresh now/ }).click({ timeout: 15000 });
await page.locator(".podium-spot").first().waitFor({ timeout: 20000 });
await page.waitForFunction(() => document.querySelector(".podium-spot[data-rank='1']")?.textContent.includes("Top One"), null, { timeout: 20000 }).catch(() => {});
const podium = await page.locator(".podium-spot").allInnerTexts();
ok(podium.length === 3 && podium.some((t) => t.includes("Top One")), `podium of 3 incl. Top One (${podium.map((t) => t.replace(/\s+/g, " ")).join(" | ")})`);
const me = page.locator(".board-me");
await me.waitFor({ timeout: 10000 }).catch(() => {});
ok((await me.count()) === 1 && /Meera Screens \(you\)/.test(await me.innerText()), `my row pinned: "${(await me.innerText().catch(() => "")).replace(/\s+/g, " ")}"`);
await shot(page, "06-leaderboard");

// --- Me: stats, QR = uid, share card, theme.
await page.goto(BASE + "/me");
await page.locator("canvas.qr").waitFor({ timeout: 15000 });
await page.waitForTimeout(400);
const img = await page.evaluate(() => {
  const c = document.querySelector("canvas.qr");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, data: Array.from(d.data) };
});
const code = jsQR(Uint8ClampedArray.from(img.data), img.w, img.h);
ok(code?.data === uid, `QR decodes to the uid (${code?.data ?? "unreadable"})`);
const stat = (k) => page.locator(`[data-stat=${k}] strong`).innerText();
ok((await stat("caught")) === "3/10" && (await stat("wins")) === "2" && (await stat("accuracy")) === "67%", `stats: caught ${await stat("caught")}, wins ${await stat("wins")}, accuracy ${await stat("accuracy")}`);
ok((await page.locator("[data-skills]").innerText()).includes("not an official DET score"), "skills panel: 'not an official DET score'");
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }).catch(() => null), page.locator("[data-share]").click()]);
ok(!!download && /\.png$/.test(download.suggestedFilename()), `share card → ${download?.suggestedFilename() ?? "no download"}`);

const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
await page.locator("[data-theme-option=dark]").click();
ok((await theme()) === "dark", "Dark → data-theme=dark");
await page.reload();
await page.locator("canvas.qr").waitFor({ timeout: 15000 });
ok((await theme()) === "dark" && (await bg()) !== "rgb(255, 255, 255)", `Dark survives a reload (bg ${await bg()})`);
await page.locator("[data-theme-option=light]").click();
await page.reload();
await page.locator("canvas.qr").waitFor({ timeout: 15000 });
ok((await theme()) === "light" && (await bg()) === "rgb(255, 255, 255)", "Light survives a reload");
await page.locator("[data-theme-option=system]").click();
await page.emulateMedia({ colorScheme: "dark" });
await page.reload();
await page.locator("canvas.qr").waitFor({ timeout: 15000 });
ok((await theme()) === null && (await bg()) !== "rgb(255, 255, 255)", "System + phone in dark → dark page");
await page.emulateMedia({ colorScheme: "light" });
await page.waitForTimeout(300);
ok((await bg()) === "rgb(255, 255, 255)", "System follows the phone live (back to light)");

await page.getByRole("button", { name: "Log out" }).click();
await page.waitForURL(BASE + "/", { timeout: 10000 }).then(() => ok(true, "Log out → Login"), () => ok(false, "Log out → Login"));
for (const o of others) await adb.doc(`users/${o.uid}`).update({ points: 0 });
await finish(browser, errors);
