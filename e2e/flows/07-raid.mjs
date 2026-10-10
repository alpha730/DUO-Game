// 7. Owl Raid: the admin creates it (callable), players join at the poster (sharded counter), it
//    unlocks at minPlayers, the raid's own challenge, +150 + speed, exactly one try, outside the daily 4.
import { adb, answerChoice, BASE, callFn, finish, FOUNDATION, launch, makeUser, ok, posterFound, shot, signUp, startCatch } from "../lib.mjs";

// Close any open raids from earlier runs (one live raid per poster).
const open = await adb.collection("raids").where("status", "in", ["scheduled", "active"]).get();
await Promise.all(open.docs.map((d) => d.ref.update({ status: "ended" })));

const admin = await makeUser({ name: "Raid Admin", role: "admin" });
const created = await callFn(
  "adminCreateRaid",
  {
    posterIndex: 2,
    lingoId: "lingo-2018",
    startAt: Date.now() - 1000,
    minutes: 15,
    minPlayers: 3,
    challenge: { type: "question", prompt: "We ___ ten years!", options: ["celebrates", "are celebrating", "celebrating", "celebrate is"], correctIndex: 1 },
  },
  await admin.idToken(),
);
ok(created.ok, `admin creates the raid ${created.ok ? "" : JSON.stringify(created.error)}`);
const raidId = created.data.raidId;
const raid = await adb.doc(`raids/${raidId}`).get();
ok(raid.exists && (await adb.doc(`challenges/raid_${raidId}`).get()).exists, "raid + its challenge stored together");

const player = await makeUser({ name: "Not Admin" });
const denied = await callFn("adminCreateRaid", { posterIndex: 1, lingoId: "lingo-2017", startAt: Date.now(), challenge: { type: "speak", phrase: "hi there" } }, await player.idToken());
ok(!denied.ok && denied.error?.status === "PERMISSION_DENIED", "a player can't create a raid");

const { browser, page, errors } = await launch();
const { uid } = await signUp(page, { tag: "raid" });

// Scan the raid poster → Join the Owl Raid → waiting room.
const card = await posterFound(page, 2);
const join = card.locator(".raid-join");
await join.waitFor({ timeout: 30000 });
ok((await join.getAttribute("data-raid")) === raidId, "raid poster → 'Join the Owl Raid'");
await join.click();
await page.waitForURL(`**/raid/${raidId}`);
await page.locator("[data-joined-me]").waitFor({ timeout: 15000 });
const joined = () => page.locator("[data-joined]").getAttribute("data-joined");
ok((await joined()) === "1", `waiting room: joined ${await joined()}/3`);

// Two more join (callable) → live count, unlock at 3.
const p2 = await makeUser({ name: "Raider Two" });
const p3 = await makeUser({ name: "Raider Three" });
const j2 = await callFn("joinRaid", { raidId, ...FOUNDATION }, await p2.idToken());
ok(j2.ok && j2.data.joined && !j2.data.unlocked, "2nd player joins (still locked)");
await page.waitForFunction(() => document.querySelector("[data-joined]")?.dataset.joined === "2", null, { timeout: 15000 }).then(() => ok(true, "count updates live → 2"), () => ok(false, "count updates live → 2"));
const again = await callFn("joinRaid", { raidId, ...FOUNDATION }, await p2.idToken());
const shardSum = async () => (await adb.collection(`raids/${raidId}/shards`).get()).docs.reduce((s, d) => s + (d.data().count ?? 0), 0);
ok(again.ok && (await shardSum()) === 2, `joining twice counts once (shards sum ${await shardSum()})`);
const j3 = await callFn("joinRaid", { raidId, ...FOUNDATION }, await p3.idToken());
ok(j3.ok && j3.data.unlocked, "3rd player → unlocked");
await page.locator("[data-raid-unlocked]").waitFor({ timeout: 15000 }).then(() => ok(true, "'Unlocked!' appears live"), () => ok(false, "'Unlocked!' appears live"));
await shot(page, "07-raid-room");

// The raid try: its own challenge, +150 + speed, outside the daily 4.
const before = (await adb.doc(`users/${uid}`).get()).data();
await page.locator("[data-raid-start]").click();
await page.waitForURL(`**/catch/lingo-2018?raid=${raidId}`);
await startCatch(page, "", { goto: false });
ok((await page.locator(".q-prompt").innerText()).replace(/\s+/g, " ").includes("We ten years!"), "the raid's own question is shown");
ok((await answerChoice(page, "are celebrating")) === "won", "raid answer → won");
const breakdown = (await page.locator(".breakdown").innerText()).replace(/\s+/g, " ");
ok(/Owl Raid \+150/.test(breakdown), `breakdown: "${breakdown}"`);
const after = (await adb.doc(`users/${uid}`).get()).data();
const log = (await adb.collection("pointsLog").where("uid", "==", uid).get()).docs.map((d) => d.data());
ok(log.some((l) => l.reason === "raid" && l.amount === 150) && log.some((l) => l.reason === "speed" && l.amount > 0), "points log: raid 150 + speed");
ok(after.points - before.points === 150 + log.find((l) => l.reason === "speed").amount + (log.find((l) => l.reason === "allTen")?.amount ?? 0), `points +${after.points - before.points}`);
ok(after.attemptsToday === before.attemptsToday, "the raid try doesn't use the daily 4");
await shot(page, "07-raid-win");

// Exactly one try.
const second = await callFn("startAttempt", { lingoId: "lingo-2018", raidId, ...FOUNDATION }, await (await import("../lib.mjs")).idTokenFor((await (await import("../lib.mjs")).adminAuth.getUser(uid)).email, "secret123"));
ok(!second.ok && second.error?.details?.code === "raid-tried", "a 2nd raid try is refused (raid-tried)");
await page.goto(`${BASE}/raid/${raidId}`);
await page.locator("[data-joined-me]").waitFor({ timeout: 15000 });
ok((await page.locator("[data-raid-start]").count()) === 0, "waiting room after the try: no Start");

// A normal catch of the same Lingo is still possible the same day.
await startCatch(page, "lingo-2018");
ok(true, "normal catch of the raid's Lingo still allowed the same day");
await adb.doc(`raids/${raidId}`).update({ status: "ended" });
await finish(browser, errors);
