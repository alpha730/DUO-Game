// 9. Off campus refused (no try used), both campuses accepted, permission-denied states, no internet,
//    the in-app browser card, the landscape warning.
import { adb, BASE, FAR_AWAY, finish, FOUNDATION, launch, makeUser, ok, pinQuestions, shot, signIn, strictCampus, UNIVERSITY } from "../lib.mjs";

await pinQuestions();
await strictCampus(true); // the emulator enforces the campus check like production for this flow
const all = [];
async function as(user, init = [], opts = {}) {
  const l = await launch({ init, ...opts });
  all.push(l);
  await signIn(l.page, user.email);
  return l;
}
const userDoc = async (uid) => (await adb.doc(`users/${uid}`).get()).data();

try {
  // --- Off campus: refused, no try used.
  const p = await makeUser({ name: "Off Campus" });
  const far = await as(p, [`window.__GEO = ${JSON.stringify(FAR_AWAY)};`]);
  await far.page.goto(BASE + "/catch/lingo-2018");
  await far.page.getByRole("button", { name: "Start" }).click({ timeout: 25000 });
  await far.page.locator("[data-empty=off-campus]").waitFor({ timeout: 15000 }).then(() => ok(true, "off campus → 'You're off campus'"), () => ok(false, "off campus → 'You're off campus'"));
  await shot(far.page, "09-off-campus");
  const u = await userDoc(p.uid);
  ok((u.attemptsToday ?? 0) === 0 && (u.triedToday ?? []).length === 0, "off campus used no try and no Lingo");
  ok((await adb.collection("attempts").where("uid", "==", p.uid).get()).size === 0, "off campus: no attempt created");

  // --- Both campuses accepted.
  for (const [name, at] of [["JECRC Foundation", FOUNDATION], ["JECRC University", UNIVERSITY]]) {
    const q = await makeUser({ name: `On ${name}` });
    const l = await as(q, [`window.__GEO = ${JSON.stringify(at)};`]);
    await l.page.goto(BASE + "/catch/lingo-2018");
    await l.page.getByRole("button", { name: "Start" }).click({ timeout: 25000 });
    await l.page.locator("[data-phase=active]").waitFor({ timeout: 20000 }).then(() => ok(true, `${name} → accepted`), () => ok(false, `${name} → accepted`));
  }

  // --- Permission denied (mic / location) → no Start, a clear message.
  for (const [what, init] of [["microphone", "window.__MIC = 'deny';"], ["location", "window.__GEO = 'deny';"]]) {
    const q = await makeUser({ name: `No ${what}` });
    const l = await as(q, [init]);
    await l.page.goto(BASE + "/catch/lingo-2018");
    await l.page.locator(".check-row[data-state=denied]").waitFor({ timeout: 20000 }).then(() => ok(true, `${what} denied → ✕ with help`), () => ok(false, `${what} denied → ✕ with help`));
    ok((await l.page.getByRole("button", { name: "Start" }).count()) === 0, `${what} denied → no Start button`);
    await shot(l.page, `09-denied-${what}`);
  }

  // --- Camera denied on Scan (the real scanner, its camera request refused).
  const cam = await makeUser({ name: "No Camera" });
  const c = await as(cam, ["window.__FAKE_SCANNER = false; window.__CAM = 'deny';"]);
  await c.page.goto(BASE + "/scan");
  await c.page.locator(".camera-help").waitFor({ timeout: 60000 }).then(() => ok(true, `camera denied → help card (${"camera"})`), () => ok(false, "camera denied → help card"));
  await shot(c.page, "09-camera-denied");

  // --- No internet: the offline pill, and Start says you're offline.
  const off = await makeUser({ name: "Offline" });
  const o = await as(off);
  await o.page.goto(BASE + "/catch/lingo-2018");
  await o.page.getByRole("button", { name: "Start" }).waitFor({ timeout: 25000 });
  await o.ctx.setOffline(true);
  await o.page.locator("[data-offline]").waitFor({ timeout: 10000 }).then(() => ok(true, "offline → 'You're offline' pill"), () => ok(false, "offline → 'You're offline' pill"));
  await o.page.getByRole("button", { name: "Start" }).click();
  await o.page.locator("[data-empty=offline]").waitFor({ timeout: 30000 }).then(() => ok(true, "Start while offline → offline message"), () => ok(false, "Start while offline → offline message"));
  await shot(o.page, "09-offline");
  await o.ctx.setOffline(false);
  await o.page.locator("[data-offline]").waitFor({ state: "detached", timeout: 10000 }).then(() => ok(true, "back online → pill gone"), () => ok(false, "back online → pill gone"));
  ok((await userDoc(off.uid)).attemptsToday === 0, "offline Start used no try");

  // --- In-app browser (Instagram) → "Open in Chrome/Safari" card on Scan.
  const ia = await makeUser({ name: "In App" });
  const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Instagram 300.0.0.0";
  const i = await as(ia, [], { ua });
  await i.page.goto(BASE + "/scan");
  await i.page.locator(".camera-help[data-problem=inApp]").waitFor({ timeout: 20000 }).then(() => ok(true, "Instagram browser → 'open in Chrome/Safari' card"), () => ok(false, "Instagram browser → 'open in Chrome/Safari' card"));
  await shot(i.page, "09-in-app");

  // --- Landscape → "turn your phone upright".
  const ls = await launch({ viewport: { width: 812, height: 375 } });
  all.push(ls);
  await ls.page.goto(BASE + "/rules");
  await ls.page.locator(".rotate-notice").waitFor({ state: "visible", timeout: 10000 }).then(() => ok(true, "landscape → 'Please turn your phone upright'"), () => ok(false, "landscape → 'Please turn your phone upright'"));
  await ls.page.setViewportSize({ width: 375, height: 812 });
  await ls.page.locator(".rotate-notice").waitFor({ state: "hidden", timeout: 10000 }).then(() => ok(true, "portrait → notice gone"), () => ok(false, "portrait → notice gone"));
} finally {
  await strictCampus(false);
}
const errors = all.flatMap((l) => l.errors).filter((e) => !/camera|NotAllowed|Failed to fetch|offline|network/i.test(e));
for (const l of all.slice(1)) await l.browser.close();
await finish(all[0].browser, errors);
