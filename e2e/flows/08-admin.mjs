// 8. Admin: config, question upload validation, raid creation, stats, suspicious players, top-20 CSV
//    export, lock game (locked → every play call is blocked), unlock.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adb, BASE, callFn, finish, FOUNDATION, launch, makeUser, OUT, ok, shot, signIn } from "../lib.mjs";

const cfgBefore = (await adb.doc("config/game").get()).data();
const poolFile = fileURLToPath(new URL("../../scripts/content/question-pool-2026.json", import.meta.url));
const { browser, page, errors } = await launch();
page.on("dialog", (d) => d.accept());
const admin = await makeUser({ name: "QA Admin", role: "admin" });
const player = await makeUser({ name: "Locked Out" });
const cheater = await makeUser({ name: "Speedy Cheater" });
await adb.doc(`users/${cheater.uid}`).update({ points: 8_888_888, flags: 4, wins: 12, losses: 0, totalAnswerMs: 12 * 700, suspect: true });

try {
  // Non-admins can't open /admin.
  await signIn(page, player.email);
  await page.goto(`${BASE}/admin`);
  await page.getByText(/staff only|not allowed|admins only/i).first().waitFor({ timeout: 15000 }).then(() => ok(true, "a player can't open /admin"), () => ok(false, "a player can't open /admin"));

  await signIn(page, admin.email);
  await page.goto(`${BASE}/admin`);
  await page.getByRole("heading", { name: "Admin" }).waitFor({ timeout: 20000 });

  // Stats.
  await page.locator("[data-stat=users] strong").waitFor({ timeout: 20000 });
  const users = Number((await page.locator("[data-stat=users] strong").innerText()).replace(/\D/g, ""));
  ok(users >= 3, `stats: ${users} players`);
  ok((await page.locator("[data-question-total]").first().getAttribute("data-question-total")) === "456", "stats: question pool 456");

  // Config.
  await page.locator("input[name=campus-0-radiusM]").fill("777");
  await page.locator("details summary").first().click();
  await page.locator("input[name=rule-raidCatchPoints]").fill("160");
  await page.getByRole("button", { name: "Save config" }).click();
  await page.getByText("Config saved.").waitFor({ timeout: 15000 });
  const cfg = (await adb.doc("config/game").get()).data();
  ok(cfg.campuses[0].radiusM === 777 && cfg.campuses[1].radiusM === 1000 && cfg.rules.raidCatchPoints === 160 && cfg.rules.triesPerLingoPerDay === 2, "config saved (campus radius, raid points; other rules kept)");
  ok(cfg.startAt.toMillis() === cfgBefore.startAt.toMillis(), "start time unchanged by the round trip");
  const bad = await callFn("adminSetConfig", { rules: { attemptsPerDay: -1 } }, await admin.idToken());
  ok(!bad.ok, "server rejects an invalid rule (attemptsPerDay -1)");

  // Question upload validation.
  const poolCount = async () => (await adb.collection("questions").count().get()).data().count;
  const good = { id: "e2e-1", level: "medium", type: "meaning", word: "keen", options: ["eager", "sad", "slow", "late"], correctIndex: 0, explanation: "eager" };
  const rows = [good, { ...good, id: "e2e-2", options: ["a", "b", "c"] }, { ...good, id: "e2e-3", level: "easy" }, { ...good, id: "e2e-4", correctIndex: 7 }];
  await page.locator("textarea[name=questionsJson]").fill(JSON.stringify(rows));
  await page.getByRole("button", { name: "Validate & upload" }).click();
  await page.locator("[data-row-errors]").waitFor({ timeout: 10000 });
  const rowsText = await page.locator("[data-row-errors]").innerText();
  ok(/Row 2/.test(rowsText) && /Row 3/.test(rowsText) && /Row 4/.test(rowsText) && !/Row 1:/.test(rowsText), "bad rows 2, 3, 4 listed");
  ok((await poolCount()) === 456, "nothing saved when any row is bad");
  await page.locator("textarea[name=questionsJson]").fill("{ not json");
  await page.getByRole("button", { name: "Validate & upload" }).click();
  await page.getByText("That isn't valid JSON.").waitFor({ timeout: 5000 }).then(() => ok(true, "invalid JSON → clear message"), () => ok(false, "invalid JSON → clear message"));
  await page.getByLabel("Question pool JSON file").setInputFiles(poolFile);
  await page.waitForFunction(() => document.querySelector("textarea[name=questionsJson]")?.value.length > 1000);
  await page.getByRole("button", { name: "Validate & upload" }).click();
  await page.getByText("Saved 456 questions.").waitFor({ timeout: 30000 }).then(() => ok(true, "real pool file: 456 saved"), () => ok(false, "real pool file: 456 saved"));

  // Raid creation from the form.
  await page.locator("select[name=posterIndex]").selectOption("4");
  await page.locator("input[name=minPlayers]").fill("5");
  await page.locator("select[name=challengeType]").selectOption("question");
  await page.locator("input[name=challengePrompt]").fill("Ten years ___ we started.");
  for (const [i, o] of ["since", "for", "ago", "from"].entries()) await page.locator(`input[name=challengeOption${i}]`).fill(o);
  await page.getByLabel("Option 3 is correct").check();
  await page.getByRole("button", { name: /^Create Owl Raid$/ }).click();
  await page.getByText(/Owl Raid created/).waitFor({ timeout: 10000 });
  const raidId = (await page.getByText(/Owl Raid created/).innerText()).match(/\((\w+)\)/)[1];
  const raid = (await adb.doc(`raids/${raidId}`).get()).data();
  const ch = (await adb.doc(`challenges/raid_${raidId}`).get()).data();
  ok(raid.lingoId === "lingo-2020" && raid.minPlayers === 5 && ch.correctIndex === 2, "raid created from the form (poster 5, 5 players, answer = option 3)");
  await adb.doc(`raids/${raidId}`).update({ status: "ended" });

  // Suspicious players (on click) + top-20 CSV.
  await page.getByRole("button", { name: "Load suspicious players" }).click();
  const row = page.locator(`.admin-table tr[data-uid="${cheater.uid}"]`).first();
  await row.waitFor({ timeout: 15000 }).then(() => ok(true, "suspicious list includes the flagged player"), () => ok(false, "suspicious list includes the flagged player"));
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.locator("[data-export-top20]").click()]);
  const csvPath = `${OUT}top20.csv`;
  await download.saveAs(csvPath);
  const csv = readFileSync(csvPath, "utf8").replace(/^﻿/, "");
  const [head, first] = csv.split(/\r\n/);
  ok(head.startsWith("rank,name,email,points,fav_max,qualified,accuracy_pct,avg_answer_s,wins,flags,suspect"), `CSV header: ${head}`);
  ok(first.includes('"8888888"') && first.includes('"4"'), `CSV row 1 has the flags: ${first}`);
  ok(csv.trim().split(/\r\n/).length - 1 <= 20, "≤ 20 rows");
  await shot(page, "08-admin", { fullPage: true });

  // Lock game → every play call is blocked; Home says it's over.
  await page.getByRole("button", { name: "Lock game now" }).click();
  await page.locator("[data-locked=true]").waitFor({ timeout: 10000 });
  const t = await player.idToken();
  const calls = {
    startAttempt: await callFn("startAttempt", { lingoId: "lingo-2018", ...FOUNDATION }, t),
    submitAttempt: await callFn("submitAttempt", { attemptId: "x", choice: 0 }, t),
    setFavorites: await callFn("setFavorites", { lingoIds: ["lingo-2018", "lingo-2019"] }, t),
    joinRaid: await callFn("joinRaid", { raidId: "x", ...FOUNDATION }, t),
  };
  for (const [name, r] of Object.entries(calls)) ok(!r.ok && /over|locked/i.test(JSON.stringify(r.error)), `locked → ${name} refused (${r.error?.message})`);
  const p2 = (await launch()).page;
  await signIn(p2, player.email);
  await p2.locator("[data-game-clock=over]").waitFor({ timeout: 15000 }).then(() => ok(true, "locked → player's Home: 'The hunt is over'"), () => ok(false, "locked → player's Home: 'The hunt is over'"));
  await p2.context().browser().close();
  await page.getByRole("button", { name: "Unlock game" }).click();
  await page.locator("[data-locked=false]").waitFor({ timeout: 10000 });
  ok((await callFn("startAttempt", { lingoId: "lingo-2018", ...FOUNDATION }, t)).ok, "unlock → play works again");
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "admin: no horizontal scroll at 375 px");
} finally {
  await adb.doc("config/game").set(cfgBefore);
  await adb.doc(`users/${cheater.uid}`).update({ points: 0, flags: 0, suspect: false });
}
await finish(browser, errors);
