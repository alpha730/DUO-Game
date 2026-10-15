// 10. 320 px and 375 px, light and dark: no sideways scroll, every visible text readable (contrast
//     ≥ 4.5:1, or 3:1 for large text, computed in the page), no text smaller than 11 px, no clipped text.
import { adb, BASE, finish, launch, makeUser, ok, pinQuestions, posterFound, shot, signIn, startCatch, Timestamp } from "../lib.mjs";

await pinQuestions();
// A player with some history so every screen has content.
const p = await makeUser({ name: "Layout Tester With A Long Name" });
for (const [id, level, times] of [["lingo-2018", 3, 7], ["lingo-2019", 2, 3], ["lingo-2022", 1, 1]]) {
  await adb.doc(`users/${p.uid}/catches/${id}`).set({ firstCaughtAt: Timestamp.now(), timesCaught: times, lastCaughtDate: "2026-10-09", level, favStreak: times - 1, maxBonusGiven: false });
}
await adb.doc(`users/${p.uid}`).update({ lingosCaught: 3, favorites: ["lingo-2018", "lingo-2019"], points: 1240, wins: 11, losses: 3, totalAnswerMs: 11 * 4200, dayStreak: 3, lastPlayDate: "2026-10-09" });
const admin = await makeUser({ name: "Layout Admin", role: "admin" });

/** Runs in the page: sideways scroll, low-contrast / tiny / clipped text. */
const AUDIT = () => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  function background(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none" && !cs.backgroundImage.startsWith("url(")) return null; // gradient: can't judge
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) break;
      }
    }
    let c = { r: 255, g: 255, b: 255, a: 1 };
    for (const l of layers.reverse()) c = over(l, c);
    return c;
  }
  const out = { overflowX: document.documentElement.scrollWidth - window.innerWidth, low: [], tiny: [], clipped: [] };
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || cs.visibility === "hidden" || el.closest("[aria-hidden=true], .rotate-notice, svg, canvas")) continue;
    if (el.closest("button:disabled, [disabled]")) continue; // disabled controls are exempt (WCAG 1.4.3)
    // Documented brand exception (docs/ACCESSIBILITY.md): white labels on filled Owl / Macaw buttons.
    if (el.closest(".btn:not(.secondary):not(.link):not(.danger):not(.gold)")) continue;
    let op = 1;
    for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    if (op < 0.99) continue; // mid-animation or intentionally faded decoration
    const text = el.textContent.trim().replace(/\s+/g, " ").slice(0, 40);
    const size = parseFloat(cs.fontSize);
    if (size < 11) out.tiny.push(`${text} (${size}px)`);
    const fg = parse(cs.color);
    const bg = background(el);
    if (fg && bg) {
      const f = over(fg, bg);
      const [hi, lo] = [lum(f), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5) && !/^[\p{Extended_Pictographic}\s]+$/u.test(text)) out.low.push(`"${text}" ${ratio.toFixed(2)}:1`);
    }
    if ((cs.overflow === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1) out.clipped.push(text);
  }
  return out;
};

const screens = [
  ["login", null, async (pg) => pg.goto(BASE + "/")],
  ["rules", null, async (pg) => pg.goto(BASE + "/rules")],
  ["home", p, async (pg) => pg.goto(BASE + "/home")],
  ["scan-card", p, async (pg) => posterFound(pg, 2)],
  ["catch-preflight", p, async (pg) => { await pg.goto(BASE + "/catch/lingo-2023"); await pg.getByRole("button", { name: "Start" }).waitFor({ timeout: 25000 }); }],
  ["question-blank", p, async (pg) => startCatch(pg, "lingo-2023")],
  ["result", p, async (pg) => { await pg.getByRole("radio", { name: /at$/ }).click(); await pg.getByRole("button", { name: "Continue" }).click(); await pg.locator(".result").waitFor({ timeout: 20000 }); }],
  ["question-voice", p, async (pg) => startCatch(pg, "lingo-2024")],
  ["dex", p, async (pg) => { await pg.goto(BASE + "/dex"); await pg.locator(".dex-card[data-lingo]").first().waitFor({ timeout: 30000 }); }],
  ["leaderboard", p, async (pg) => { await pg.goto(BASE + "/leaderboard"); await pg.locator(".board-me, .board-row").first().waitFor({ timeout: 20000 }); }],
  ["me", p, async (pg) => { await pg.goto(BASE + "/me"); await pg.locator("canvas.qr").waitFor({ timeout: 20000 }); }],
  ["favorites", p, async (pg) => { await pg.goto(BASE + "/favorites"); await pg.locator(".fav-option").first().waitFor({ timeout: 20000 }); }],
  ["admin", admin, async (pg) => { await pg.goto(BASE + "/admin"); await pg.locator("[data-stat=users] strong").waitFor({ timeout: 20000 }); }],
];

const all = [];
for (const width of [320, 375]) {
  for (const scheme of ["light", "dark"]) {
    // Fresh tries for this pass (each pass answers one question and leaves another).
    await adb.doc(`users/${p.uid}`).update({ triedToday: [], triesToday: {}, attemptsToday: 0, openAttemptId: null });
    const l = await launch({ colorScheme: scheme, viewport: { width, height: 760 } });
    all.push(l);
    let signedAs = undefined;
    for (const [name, who, open] of screens) {
      if (who !== signedAs) {
        if (who) await signIn(l.page, who.email);
        signedAs = who;
      }
      await open(l.page);
      await l.page.waitForTimeout(900); // entrance animations
      const a = await l.page.evaluate(AUDIT);
      const tag = `${width}px ${scheme} ${name}`;
      ok(a.overflowX <= 0, `${tag}: no sideways scroll (${a.overflowX}px)`);
      ok(a.low.length === 0, `${tag}: text contrast${a.low.length ? " — low: " + a.low.slice(0, 4).join(" · ") : " OK"}`);
      ok(a.tiny.length === 0, `${tag}: no text < 11px${a.tiny.length ? " — " + a.tiny.slice(0, 3).join(" · ") : ""}`);
      ok(a.clipped.length === 0, `${tag}: no clipped text${a.clipped.length ? " — " + a.clipped.slice(0, 3).join(" · ") : ""}`);
      if (width === 320) await shot(l.page, `10-${width}-${scheme}-${name}`, { fullPage: true });
    }
  }
}
const errors = all.flatMap((l) => l.errors);
for (const l of all.slice(1)) await l.browser.close();
await finish(all[0].browser, errors);
