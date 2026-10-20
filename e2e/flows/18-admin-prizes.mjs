// 18. /admin → Prizes: add, edit and remove prizes (name, cost, stock) through the adminPrizes
//     function (server-side validation: bad values are refused with a clear message), stock and the
//     number redeemed shown. Players and volunteers can't change prizes.
import { adb, BASE, callFn, finish, launch, makeUser, ok, shot, signIn, Timestamp } from "../lib.mjs";

const admin = await makeUser({ name: "Prize Admin", role: "admin" });
const volunteer = await makeUser({ name: "Prize Volunteer", role: "volunteer" });
const { browser, page, errors } = await launch({ viewport: { width: 420, height: 900 } });
page.on("dialog", (d) => d.accept());
const NAME = `E2E Hoodie ${Date.now() % 100000}`;
let prizeId = null;

const findPrize = async () => (await adb.collection("prizes").where("name", "==", NAME).get()).docs[0] ?? null;

try {
  // Only admins: a volunteer (and so a player) is refused by the server.
  const denied = await callFn("adminPrizes", { action: "save", name: "Free laptop", cost: 1, stock: 99 }, await volunteer.idToken());
  ok(!denied.ok && denied.status === 403, `a volunteer can't change prizes (${denied.status})`);

  await signIn(page, admin.email);
  await page.goto(BASE + "/admin");
  const add = page.locator("[data-prize-row=new]");
  await add.waitFor({ timeout: 25000 });

  // Server-side validation: each bad value is refused, nothing written.
  const tryAdd = async (name, cost, stock) => {
    await add.locator("input[name=prize-new-name]").fill(name);
    await add.locator("input[name=prize-new-cost]").fill(cost);
    await add.locator("input[name=prize-new-stock]").fill(stock);
    await add.getByRole("button", { name: "Add prize" }).click();
    const line = add.locator(".error, .done");
    await line.waitFor({ timeout: 15000 });
    return (await line.innerText()).trim();
  };
  let msg = await tryAdd("", "100", "3");
  ok(/needs a name/.test(msg), `empty name refused: "${msg}"`);
  msg = await tryAdd(NAME, "0", "3");
  ok(/Cost must be a whole number/.test(msg), `cost 0 refused: "${msg}"`);
  msg = await tryAdd(NAME, "12.5", "3");
  ok(/Cost must be a whole number/.test(msg), `cost 12.5 refused: "${msg}"`);
  msg = await tryAdd(NAME, "250", "-1");
  ok(/Stock must be a whole number/.test(msg), `stock -1 refused: "${msg}"`);
  msg = await tryAdd(NAME, "250", "");
  ok(/Stock must be a whole number/.test(msg), `empty stock refused: "${msg}"`);
  ok((await findPrize()) === null, "nothing written for bad values");

  // Add.
  msg = await tryAdd(`  ${NAME} `, "250", "3");
  ok(msg === "Prize added.", `added: "${msg}"`);
  const created = await findPrize();
  prizeId = created?.id ?? null;
  ok(created && created.data().cost === 250 && created.data().stock === 3, `server: ${NAME} cost 250, stock 3 (name trimmed)`);
  const row = page.locator(`[data-prize-row="${prizeId}"]`);
  await row.waitFor({ timeout: 15000 });
  ok((await row.locator(".prize-counts").innerText()).trim() === "3 in stock · 0 redeemed", "the new prize shows its stock and 0 redeemed");
  ok((await add.locator("input[name=prize-new-name]").inputValue()) === "", "the add form is cleared");

  // Edit (and a bad edit).
  await row.locator(`input[name="prize-${prizeId}-cost"]`).fill("-5");
  await row.getByRole("button", { name: "Save" }).click();
  await row.locator(".error").waitFor({ timeout: 15000 });
  ok((await created.ref.get()).data().cost === 250, "a bad edit is refused, the prize unchanged");
  await row.locator(`input[name="prize-${prizeId}-cost"]`).fill("300");
  await row.locator(`input[name="prize-${prizeId}-stock"]`).fill("5");
  await row.getByRole("button", { name: "Save" }).click();
  await page.waitForFunction((id) => document.querySelector(`[data-prize-row="${id}"] .prize-counts`)?.dataset.stock === "5", prizeId, { timeout: 15000 });
  const edited = (await created.ref.get()).data();
  ok(edited.cost === 300 && edited.stock === 5 && edited.name === NAME, "edited: cost 300, stock 5");

  // Redeemed count: two redemptions of this prize.
  for (let i = 0; i < 2; i++) await adb.collection("redemptions").add({ uid: `e2e-prize-${i}`, prizeId, cost: 300, byUid: volunteer.uid, createdAt: Timestamp.now() });
  await page.reload();
  await row.waitFor({ timeout: 25000 });
  ok((await row.locator(".prize-counts").innerText()).trim() === "5 in stock · 2 redeemed", `redeemed shown: "${(await row.locator(".prize-counts").innerText()).trim()}"`);
  await shot(page, "18-admin-prizes", { fullPage: true });

  // Remove.
  await row.getByRole("button", { name: "Remove" }).click();
  await row.waitFor({ state: "detached", timeout: 15000 });
  ok(!(await created.ref.get()).exists, "removed from the server and the list");
  const kept = await adb.collection("redemptions").where("prizeId", "==", prizeId).get();
  ok(kept.size === 2, "its redemptions stay as history");
} finally {
  if (prizeId) {
    await adb.doc(`prizes/${prizeId}`).delete();
    const reds = await adb.collection("redemptions").where("prizeId", "==", prizeId).get();
    await Promise.all(reds.docs.map((d) => d.ref.delete()));
  }
  await Promise.all([admin, volunteer].map((u) => adb.doc(`users/${u.uid}`).delete()));
}
await finish(browser, errors);
