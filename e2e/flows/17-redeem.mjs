// 17. /redeem — the prize desk (volunteer or admin, phone-sized): the player's Me page shows their
//     prize QR (uid) + the code under it; the desk scans it with the camera (a fake camera that films
//     the real QR image: BarcodeDetector or jsQR), shows name / points / balance and the prizes
//     (cost, stock); Confirm → redeemPrize, its refusals shown clearly (not enough points, out of
//     stock, paused player, unknown code) and a success screen with the new balance. Also: /ar-test is
//     staff only (signed out → sign-in, a player → "Staff only", a volunteer → the test page).
import { createRequire } from "node:module";
import { adb, BASE, callFn, finish, launch, makeUser, ok, shot, signIn } from "../lib.mjs";

const QRCode = createRequire(new URL("../../web/package.json", import.meta.url))("qrcode");
const PRIZES = {
  "e2e-cheap": { name: "E2E Badge", cost: 300, stock: 2 },
  "e2e-dear": { name: "E2E Laptop", cost: 5000, stock: 5 },
  "e2e-gone": { name: "E2E Mug", cost: 100, stock: 0 },
};
const volunteer = await makeUser({ name: "Desk Volunteer", role: "volunteer" });
const player = await makeUser({ name: "Prize Winner" });
const paused = await makeUser({ name: "Paused Player" });
await adb.doc(`users/${player.uid}`).update({ points: 1500, spent: 200 });
await adb.doc(`users/${paused.uid}`).update({ points: 2000, disabled: true });
for (const [id, p] of Object.entries(PRIZES)) await adb.doc(`prizes/${id}`).set(p);

// The desk phone's camera films the player's QR (the same image the Me page draws).
const qr = await QRCode.toDataURL(player.uid, { width: 300, margin: 3, errorCorrectionLevel: "M" });
const CAMERA = `(() => {
  const md = navigator.mediaDevices;
  md.getUserMedia = async (c) => {
    if (!c || !c.video) throw new DOMException("no", "NotAllowedError");
    // Playwright's WebKit on Windows can't film a canvas (no captureStream): no camera there.
    if (!HTMLCanvasElement.prototype.captureStream) throw new DOMException("no camera", "NotFoundError");
    const cv = document.createElement("canvas");
    cv.width = 480; cv.height = 480;
    const g = cv.getContext("2d");
    const img = new Image();
    img.src = ${JSON.stringify(qr)};
    await img.decode();
    const draw = () => { g.fillStyle = "#777"; g.fillRect(0, 0, 480, 480); g.drawImage(img, 90, 90, 300, 300); };
    draw();
    setInterval(draw, 100);
    return cv.captureStream(10);
  };
})();`;

const runs = [];
try {
  // --- The player's Me page: the prize QR is their uid, with the code under it.
  const pl = await launch();
  runs.push(pl);
  await signIn(pl.page, player.email);
  await pl.page.goto(BASE + "/me");
  const canvas = pl.page.locator("canvas.qr");
  await canvas.waitFor({ timeout: 20000 });
  ok((await canvas.getAttribute("data-uid")) === player.uid, "Me: the prize QR is the player's uid");
  ok((await pl.page.locator("[data-prize-code]").innerText()).includes(player.uid), "Me: the code is written under the QR (for typing)");
  // The QR on screen decodes to the uid (jsQR on the canvas pixels, through the desk's own reader).
  const decoded = await pl.page.evaluate(async () => (await import("/src/lib/qrScan.ts")).readQr(document.querySelector("canvas.qr")));
  ok(decoded === player.uid, `Me: the QR on screen reads back as the uid (${decoded === player.uid ? "yes" : decoded})`);
  // A player can't open the desk or look anyone up.
  await pl.page.goto(BASE + "/redeem");
  ok(await pl.page.getByText("Staff only").waitFor({ timeout: 15000 }).then(() => true, () => false), "a player can't open /redeem");
  const denied = await callFn("deskPlayer", { uid: paused.uid }, await player.idToken());
  ok(!denied.ok && denied.status === 403, `a player can't call deskPlayer (${denied.status})`);
  // /ar-test (camera + level-look test page) is staff only too.
  await pl.page.goto(BASE + "/ar-test");
  ok(await pl.page.getByText("Staff only").waitFor({ timeout: 15000 }).then(() => true, () => false), "a player can't open /ar-test");
  {
    const anon = await launch();
    runs.push(anon);
    await anon.page.goto(BASE + "/ar-test");
    await anon.page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15000 }).catch(() => {});
    ok(new URL(anon.page.url()).pathname === "/" && (await anon.page.locator(".ar-test-banner").count()) === 0, "signed out: /ar-test goes to the sign-in page");
  }

  // --- The desk: scan the QR with the camera.
  const desk = await launch({ init: [CAMERA] });
  runs.push(desk);
  const { page } = desk;
  await signIn(page, volunteer.email);
  await page.goto(BASE + "/ar-test");
  ok(await page.locator(".ar-test-banner").waitFor({ timeout: 25000 }).then(() => true, () => false), "a volunteer opens /ar-test (AR test mode)");
  await page.goto(BASE + "/redeem");
  const filmable = await page.evaluate(() => !!HTMLCanvasElement.prototype.captureStream);
  if (filmable) {
    await page.locator("[data-desk=player]").waitFor({ timeout: 25000 });
    ok(true, "camera scan: the QR is read and the player looked up");
  } else {
    // No camera: the desk says so and the code is typed instead (the QR reader itself was checked
    // on the Me page above).
    const note = page.locator("[data-camera=off] .desk-camera-note");
    ok(await note.waitFor({ timeout: 15000 }).then(() => true, () => false), "no camera: the desk says to type the code");
    await page.getByLabel("Prize code").fill(player.uid);
    await page.getByRole("button", { name: "Look up" }).click();
    await page.locator("[data-desk=player]").waitFor({ timeout: 25000 });
    ok(true, "no camera: typed code looks the player up");
  }
  const panel = page.locator(".desk-player");
  ok((await panel.getAttribute("data-uid")) === player.uid && (await page.locator(".desk-name").innerText()) === "Prize Winner", "the player's name");
  ok((await page.locator("[data-points]").getAttribute("data-points")) === "1500" && (await page.locator(".desk-numbers [data-balance]").getAttribute("data-balance")) === "1300", "points 1,500, balance 1,300 (points − spent)");
  await page.locator('[data-prize="e2e-cheap"]').waitFor({ timeout: 15000 });
  const cheap = (await page.locator('[data-prize="e2e-cheap"]').innerText()).replace(/\s+/g, " ");
  ok(cheap.includes("E2E Badge") && cheap.includes("300 pts") && cheap.includes("2 left"), `prize list: name, cost, stock ("${cheap}")`);
  ok((await page.locator('[data-prize="e2e-gone"]').innerText()).includes("Out of stock"), "prize list: out of stock shown");
  await shot(page, "17-desk-player");

  const confirmPrize = async (id) => {
    await page.locator(`[data-prize="${id}"]`).click();
    await page.getByRole("button", { name: /^Confirm/ }).click();
  };
  const errorBox = async () => {
    const box = page.locator(".desk-error");
    await box.waitFor({ timeout: 15000 });
    return { code: await box.getAttribute("data-error-code"), text: (await box.innerText()).replace(/\s+/g, " ") };
  };

  // Not enough points.
  await confirmPrize("e2e-dear");
  let e = await errorBox();
  ok(e.code === "not-enough" && e.text.startsWith("Not enough points") && e.text.includes("1300"), `refused: "${e.text}"`);
  await shot(page, "17-desk-not-enough");
  // Out of stock.
  await confirmPrize("e2e-gone");
  e = await errorBox();
  ok(e.code === "out-of-stock" && e.text.includes("E2E Mug is out of stock"), `refused: "${e.text}"`);
  const u0 = (await adb.doc(`users/${player.uid}`).get()).data();
  ok(u0.spent === 200, "refusals spend nothing");

  // Success.
  await confirmPrize("e2e-cheap");
  await page.locator("[data-desk=done]").waitFor({ timeout: 15000 });
  const doneText = (await page.locator(".desk-done").innerText()).replace(/\s+/g, " ");
  ok(doneText.includes("E2E Badge redeemed") && doneText.includes("Prize Winner") && (await page.locator(".desk-done [data-balance]").getAttribute("data-balance")) === "1000", `success: "${doneText}"`);
  await shot(page, "17-desk-done");
  const u1 = (await adb.doc(`users/${player.uid}`).get()).data();
  const stock = (await adb.doc("prizes/e2e-cheap").get()).data().stock;
  const reds = await adb.collection("redemptions").where("uid", "==", player.uid).get();
  ok(u1.spent === 500 && u1.points === 1500 && stock === 1 && reds.size === 1 && reds.docs[0].data().byUid === volunteer.uid, `server: spent 500, points kept, stock 2 → ${stock}, 1 redemption by the volunteer`);

  // --- Next player: typed code, paused account.
  await page.getByRole("button", { name: "Next player" }).click();
  await page.locator("[data-desk=scan]").waitFor({ timeout: 10000 });
  // (the fake camera keeps filming the first QR — type before it's read again)
  await page.getByLabel("Prize code").fill("not a code!");
  await page.getByRole("button", { name: "Look up" }).click();
  e = await errorBox();
  ok(e.code === "bad-code" && e.text.startsWith("Unknown code"), `typed nonsense: "${e.text}"`);
  await page.getByLabel("Prize code").fill(paused.uid);
  await page.getByRole("button", { name: "Look up" }).click();
  await page.locator(`.desk-player[data-uid="${paused.uid}"]`).waitFor({ timeout: 15000 });
  ok((await page.locator(".desk-paused").count()) === 1, "typed code: paused player looked up, warning shown");
  await confirmPrize("e2e-cheap");
  e = await errorBox();
  ok(e.code === "disabled" && e.text.startsWith("Player paused") && e.text.includes("paused"), `refused: "${e.text}"`);
  await shot(page, "17-desk-paused");
  ok(((await adb.doc(`users/${paused.uid}`).get()).data().spent ?? 0) === 0, "paused player: nothing spent");

  // An unknown uid.
  await page.getByRole("button", { name: /Cancel/ }).click();
  await page.getByLabel("Prize code").fill("nobodyHasThisUid123");
  await page.getByRole("button", { name: "Look up" }).click();
  e = await errorBox();
  ok(e.code === "no-player" && e.text.includes("No player with that QR code"), `unknown code: "${e.text}"`);
} finally {
  await Promise.all(Object.keys(PRIZES).map((id) => adb.doc(`prizes/${id}`).delete()));
  for (const u of [player, paused, volunteer]) {
    const reds = await adb.collection("redemptions").where("uid", "==", u.uid).get();
    await Promise.all([...reds.docs.map((d) => d.ref.delete()), adb.doc(`users/${u.uid}`).delete()]);
  }
}
const errors = runs.flatMap((r) => r.errors);
for (const r of runs.slice(1)) await r.browser.close();
await finish(runs[0].browser, errors);
