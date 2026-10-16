// 12. Official Duo art: every Lingo is its mapped Duo pose (Dex, Home, Scan card, Catch, Result,
//     Favourites), uncaught = the same pose as a silhouette, the level look (Lv 2 ring, Lv 3 gold +
//     sparkle, MAX scallop + glow), the extra poses (Read Aloud, Rules, Me, streak flame, no Lingos
//     left), the AR standee PNGs (1024 px) and no .glb download. Screenshots: 375 light + dark, 320.
import { adb, BASE, finish, launch, makeUser, ok, pinQuestions, posterFound, shot, signIn, startCatch, Timestamp } from "../lib.mjs";

const POSES = [
  "Duo_Straight_On_Grounded",
  "Duo_Detective",
  "Duo_Skip",
  "Duo_Wave",
  "Duo_Serious",
  "Duo_Heart",
  "Duo_Joyous",
  "duo_v2_books",
  "duo_v2_sunglasses",
  "Duo_Grad_Jump",
];
const id = (i) => `lingo-${2016 + i}`;

await pinQuestions();
// Caught: 2016 Lv 1, 2017 Lv 2, 2018 Lv 3, 2019 MAX (favourite, streak 4). The rest uncaught.
const p = await makeUser({ name: "Art Tester" });
const levels = { 0: 1, 1: 2, 2: 3, 3: "MAX" };
for (const [i, level] of Object.entries(levels)) {
  await adb.doc(`users/${p.uid}/catches/${id(Number(i))}`).set({ firstCaughtAt: Timestamp.now(), timesCaught: 3, lastCaughtDate: "2026-10-09", level, favStreak: i === "3" ? 4 : 0, maxBonusGiven: level === "MAX" });
}
await adb.doc(`users/${p.uid}`).update({ lingosCaught: 4, favorites: [id(3), id(2)], points: 2400, wins: 12, losses: 2, totalAnswerMs: 12 * 4000, dayStreak: 2, lastPlayDate: "2026-10-09" });

const runs = [];
for (const [width, scheme] of [[375, "light"], [375, "dark"], [320, "light"]]) {
  await adb.doc(`users/${p.uid}`).update({ triedToday: [], triesToday: {}, attemptsToday: 0, openAttemptId: null });
  const l = await launch({ colorScheme: scheme, viewport: { width, height: 812 } });
  runs.push(l);
  const { page } = l;
  const tag = `${width} ${scheme}`;
  const glb = [];
  page.on("request", (r) => /\.glb(\?|$)/.test(r.url()) && glb.push(r.url()));
  await signIn(page, p.email);

  // --- Dex: each card shows its pose; uncaught = silhouette of the same pose; the level look.
  await page.goto(BASE + "/dex");
  await page.locator(".dex-card[data-lingo]").first().waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".dex-card[data-caught=true]").length === 4, null, { timeout: 15000 }).catch(() => {});
  const cards = await page.$$eval(".dex-card[data-lingo]", (els) =>
    els.map((e) => {
      const art = e.querySelector(".lingo-pose");
      return { id: e.dataset.lingo, src: art?.querySelector("img")?.getAttribute("src") ?? "", silhouette: art?.classList.contains("is-silhouette") ?? null, level: art?.dataset.level ?? null, critter: !!e.querySelector(".critter") };
    }),
  );
  ok(cards.length === 10 && cards.every((c, i) => c.id === id(i) && c.src.includes(`/mascots/${POSES[i]}.svg`)), `${tag}: Dex — all 10 cards show their mapped Duo pose`);
  ok(cards.every((c, i) => c.silhouette === !(i in levels)), `${tag}: Dex — 6 uncaught are silhouettes of the same pose, 4 caught are not`);
  ok(cards.every((c) => !c.critter), `${tag}: Dex — no placeholder critter`);
  ok(cards[0].level === "1" && cards[1].level === "2" && cards[2].level === "3" && cards[3].level === "MAX", `${tag}: Dex — level look Lv1/Lv2/Lv3/MAX (${cards.slice(0, 4).map((c) => c.level)})`);
  const look = await page.evaluate(() => {
    const ring = (sel) => getComputedStyle(document.querySelector(sel), "::before");
    const lv1 = ring('.dex-card[data-lingo="lingo-2016"] .lingo-pose');
    const lv2 = ring('.dex-card[data-lingo="lingo-2017"] .lingo-pose');
    const lv3 = ring('.dex-card[data-lingo="lingo-2018"] .lingo-pose');
    const max = document.querySelector('.dex-card[data-lingo="lingo-2019"] .lingo-pose');
    const sil = document.querySelector('.dex-card[data-lingo="lingo-2020"] .lingo-pose img');
    const root = getComputedStyle(document.documentElement);
    return {
      lv1: lv1.content,
      lv2: lv2.borderTopColor,
      lv3: lv3.borderTopColor,
      green: root.getPropertyValue("--primary").trim(),
      gold: root.getPropertyValue("--gold").trim(),
      sparkle: !!document.querySelector('.dex-card[data-lingo="lingo-2018"] .lingo-sparkle'),
      maxBadge: !!max.querySelector(".lingo-max[data-shape=scallop]"),
      maxGlow: getComputedStyle(max.querySelector("img")).filter,
      favGlow: max.style.getPropertyValue("--fav-glow"),
      silFilter: getComputedStyle(sil).filter,
    };
  });
  const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
  ok(look.lv1 === "none" || look.lv1 === "normal", `${tag}: Lv 1 plain (no ring)`);
  ok(look.lv2 === rgb(look.green), `${tag}: Lv 2 thin green ring (${look.lv2})`);
  ok(look.lv3 === rgb(look.gold) && look.sparkle, `${tag}: Lv 3 gold ring + sparkle`);
  ok(look.maxBadge && /drop-shadow/.test(look.maxGlow), `${tag}: MAX gold scallop badge + glow`);
  ok(Number(look.favGlow) > 0, `${tag}: favourite streak adds glow (--fav-glow ${look.favGlow})`);
  ok(/brightness\(0\)/.test(look.silFilter), `${tag}: silhouette = the art turned dark (${look.silFilter.slice(0, 40)})`);
  await page.waitForTimeout(900); // entrance animations
  await shot(page, `12-${width}-${scheme}-dex`, { fullPage: true });

  // Dex detail sheet (MAX).
  await page.locator('.dex-card[data-lingo="lingo-2019"]').click();
  await page.locator(".dex-sheet .lingo-pose").waitFor({ timeout: 5000 });
  ok((await page.locator(".dex-sheet .lingo-pose img").getAttribute("src")).includes("Duo_Wave"), `${tag}: Dex detail — Thumbs-Up Duo = Duo_Wave`);
  await page.waitForTimeout(900); // entrance animations
  await shot(page, `12-${width}-${scheme}-dex-sheet`);
  await page.getByRole("button", { name: "Close" }).click();

  // --- Home: favourite cards + Dex strip + streak flame Duo.
  await page.goto(BASE + "/home");
  await page.locator(".fav-card .lingo-pose img").first().waitFor({ timeout: 20000 });
  ok((await page.locator(".fav-card[data-lingo=lingo-2019] .lingo-pose").getAttribute("data-level")) === "MAX", `${tag}: Home favourite card has the MAX look`);
  ok((await page.locator(".lingo-slot .lingo-pose").count()) === 10 && (await page.locator(".critter").count()) === 0, `${tag}: Home Dex strip — 10 poses, no critter`);
  ok((await page.locator(".hud-flame img.streak-duo").getAttribute("src"))?.includes("Duo_streak_04"), `${tag}: HUD streak flame = Duo_streak_04`);
  await page.waitForTimeout(900); // entrance animations
  await shot(page, `12-${width}-${scheme}-home`, { fullPage: true });

  // --- Scan card + standee (fake scanner: the standee is "placed" at once).
  await posterFound(page, 5);
  ok((await page.locator(".scan-card-pose img").getAttribute("src"))?.includes("Duo_Heart"), `${tag}: Scan card shows Lovestruck Duo = Duo_Heart`);
  await page.waitForFunction(() => document.querySelector(".ar-stage")?.dataset.model === "ready", null, { timeout: 10000 }).then(
    () => ok(true, `${tag}: AR standee placed`),
    () => ok(false, `${tag}: AR standee placed`),
  );
  await page.waitForTimeout(900); // entrance animations
  await shot(page, `12-${width}-${scheme}-scan`);

  // --- Catch pre-flight + Read Aloud (Microphone Duo) + Result.
  await page.goto(BASE + "/catch/lingo-2018");
  await page.getByRole("button", { name: "Start" }).waitFor({ timeout: 25000 });
  ok((await page.locator(".catch-spotlight .lingo-pose img").getAttribute("src"))?.includes("Duo_Skip"), `${tag}: Catch pre-flight — Winking Duo = Duo_Skip, Lv 3 look`);
  await page.waitForTimeout(900); // entrance animations
  await shot(page, `12-${width}-${scheme}-catch`);
  await startCatch(page, "lingo-2024");
  const voice = await page.locator(".voice-character img[data-duo=microphone]").count();
  ok(voice === 1, `${tag}: Read Aloud shows Microphone Duo`);
  ok((await page.locator(".q-top .lingo-pose img").getAttribute("src"))?.includes("duo_v2_sunglasses"), `${tag}: question header — Cool Duo = duo_v2_sunglasses`);
  await page.waitForTimeout(900); // entrance animations
  await shot(page, `12-${width}-${scheme}-read-aloud`);

  // --- Rules + Me.
  await page.goto(BASE + "/rules");
  await page.locator("img[data-duo=pointer]").waitFor({ timeout: 15000 }).then(() => ok(true, `${tag}: Rules — Duo_Pointer`), () => ok(false, `${tag}: Rules — Duo_Pointer`));
  await page.goto(BASE + "/me");
  await page.locator("[data-skills] img[data-duo=placementTest]").waitFor({ timeout: 20000 }).then(() => ok(true, `${tag}: Me Your skills — Duo_PlacementTest`), () => ok(false, `${tag}: Me Your skills — Duo_PlacementTest`));
  ok((await page.locator("[data-prep] img[data-duo=det]").count()) === 1, `${tag}: Get ready for the real DET — img-duo-det`);
  await page.waitForTimeout(900); // entrance animations
  await shot(page, `12-${width}-${scheme}-me`, { fullPage: true });

  ok(glb.length === 0, `${tag}: no .glb model downloaded (${glb.length})`);
}

// Standee textures: 1024 × 1024 PNGs for all 10 (made at build).
const sizes = await runs[0].page.evaluate(async (ids) => {
  const out = [];
  for (const i of ids) {
    const r = await fetch(`/brand/standees/${i}.png`);
    const b = await r.blob();
    const bmp = await createImageBitmap(b).catch(() => null);
    out.push({ ok: r.ok && b.type === "image/png", w: bmp?.width, h: bmp?.height });
  }
  return out;
}, Array.from({ length: 10 }, (_, i) => id(i)));
ok(sizes.every((s) => s.ok && s.w === 1024 && s.h === 1024), `standee PNGs: 10 × 1024 px (${sizes.map((s) => s.w).join(",")})`);

const errors = runs.flatMap((l) => l.errors);
for (const l of runs.slice(1)) await l.browser.close();
await finish(runs[0].browser, errors);
