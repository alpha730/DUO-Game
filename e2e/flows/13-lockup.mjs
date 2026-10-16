// 13. DET × JECRC lockup with the official JECRC logo: full lockup (splash, Login, About) = DET 10
//     lockup | divider | × | JECRC logo (colour on light, white knockout on dark), the shield alone
//     under 360 px; compact (Home / Setup / Rules / leaderboard headers) = DET 10 lockup × shield;
//     the share card uses the white logo. 375 + 320 px, light + dark; screenshots of each.
import { BASE, finish, launch, makeUser, ok, shot, signIn } from "../lib.mjs";

const p = await makeUser({ name: "Lockup Tester" });

/** What the lockup shows right now: the visible JECRC image's file + size, divider, overflow. */
const LOCKUP = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
  };
  const imgs = [...el.querySelectorAll("img")].filter(visible);
  const jecrc = imgs.filter((i) => /\/jecrc\//.test(i.getAttribute("src")));
  const det = imgs.find((i) => /det_10_lockup_h/.test(i.getAttribute("src")));
  const lr = el.getBoundingClientRect();
  return {
    jecrc: jecrc.map((i) => i.getAttribute("src").split("/").pop()),
    loaded: jecrc.every((i) => i.complete && i.naturalWidth > 0),
    jecrcH: jecrc[0]?.getBoundingClientRect().height ?? 0,
    detH: det?.getBoundingClientRect().height ?? 0,
    detSrc: det?.getAttribute("src").split("/").pop() ?? "",
    divider: [...el.querySelectorAll(".lockup-divider")].some(visible),
    text: [...el.querySelectorAll(".lockup-jecrc")].some(visible),
    inside: lr.left >= 0 && lr.right <= window.innerWidth + 0.5,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
};

const runs = [];
for (const width of [375, 320]) {
  for (const scheme of ["light", "dark"]) {
    const tag = `${width} ${scheme}`;
    const small = width < 360;
    const want = (kind) => `jecrc-${kind}${scheme === "dark" ? "-white" : ""}.png`;
    const full = small ? want("mark") : want("logo");
    const check = (name, a, expect, { divider }) => {
      if (!a) return ok(false, `${tag} ${name}: lockup present`);
      ok(a.jecrc.length === 1 && a.jecrc[0] === expect && a.loaded, `${tag} ${name}: shows ${expect} (${a.jecrc.join(",") || "none"})`);
      ok(!a.text, `${tag} ${name}: no "JECRC" text fallback`);
      ok(a.divider === divider, `${tag} ${name}: divider ${divider ? "shown" : "hidden"}`);
      ok(a.detSrc.includes(scheme === "dark" ? "white" : "green") || a.detSrc.includes("black"), `${tag} ${name}: DET 10 lockup for the ${scheme} theme (${a.detSrc})`);
      const ratio = a.jecrcH / (a.detH || 1);
      ok(ratio > 1.2 && ratio < 1.7, `${tag} ${name}: heights matched (JECRC ${a.jecrcH.toFixed(0)} / DET ${a.detH.toFixed(0)} px)`);
      ok(a.inside && a.overflowX <= 0, `${tag} ${name}: fits the screen (no sideways scroll)`);
    };

    // Splash: the page before any JavaScript runs (the app's entry module blocked).
    const s = await launch({ colorScheme: scheme, viewport: { width, height: 760 } });
    runs.push(s);
    await s.page.route(/\/src\/main\.tsx/, (r) => r.abort());
    await s.page.goto(BASE + "/", { waitUntil: "load" });
    await s.page.waitForTimeout(500);
    check("splash", await s.page.evaluate(LOCKUP, ".boot"), full, { divider: true });
    await shot(s.page, `13-${width}-${scheme}-splash`);
    await s.browser.close();
    runs.pop();

    const l = await launch({ colorScheme: scheme, viewport: { width, height: 760 } });
    runs.push(l);
    const { page } = l;
    await page.goto(BASE + "/");
    await page.locator(".login-lockup .lockup img:visible").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(700);
    check("login", await page.evaluate(LOCKUP, ".login-lockup .lockup"), full, { divider: true });
    await shot(page, `13-${width}-${scheme}-login`);

    await page.goto(BASE + "/rules");
    await page.locator(".topbar .lockup img:visible").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    check("rules header (compact)", await page.evaluate(LOCKUP, ".topbar .lockup"), want("mark"), { divider: false });

    await signIn(page, p.email);
    await page.goto(BASE + "/home");
    await page.locator(".lockup[data-variant=compact] img:visible").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(900);
    check("home header (compact)", await page.evaluate(LOCKUP, ".lockup[data-variant=compact]"), want("mark"), { divider: false });
    await shot(page, `13-${width}-${scheme}-home`);

    await page.goto(BASE + "/leaderboard");
    await page.locator(".lockup[data-variant=compact] img:visible").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(700);
    check("leaderboard header (compact)", await page.evaluate(LOCKUP, ".lockup[data-variant=compact]"), want("mark"), { divider: false });
    await shot(page, `13-${width}-${scheme}-leaderboard`);

    await page.goto(BASE + "/me");
    await page.locator("[data-about-open]").click({ timeout: 20000 });
    await page.locator("[data-about] .lockup img:visible").first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(900);
    check("about", await page.evaluate(LOCKUP, "[data-about] .lockup"), full, { divider: true });
    // Clear space: nothing (e.g. the sheet's close button) overlaps the lockup.
    const overlap = await page.evaluate(() => {
      const a = document.querySelector("[data-about] .lockup").getBoundingClientRect();
      const b = document.querySelector("[data-about] .sheet-close").getBoundingClientRect();
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    });
    ok(!overlap, `${tag} about: the close button doesn't overlap the lockup`);
    await shot(page, `13-${width}-${scheme}-about`);
    await page.getByRole("button", { name: "Close" }).click();

    if (width === 375 && scheme === "light") {
      // Share card: drawn with the white logo (the card is always dark).
      const jecrcReq = [];
      page.on("request", (r) => /\/jecrc\//.test(r.url()) && jecrcReq.push(r.url().split("/").pop()));
      await page.reload();
      const preview = page.locator("img.share-preview");
      await preview.waitFor({ timeout: 30000 });
      ok(jecrcReq.includes("jecrc-logo-white.png"), `share card loads the white JECRC logo (${[...new Set(jecrcReq)]})`);
      const src = await preview.getAttribute("src");
      const png = await page.evaluate(async (u) => {
        const b = await (await fetch(u)).blob();
        const r = new FileReader();
        return new Promise((res) => {
          r.onload = () => res(r.result);
          r.readAsDataURL(b);
        });
      }, src);
      await page.setContent(`<img src="${png}" style="width:540px">`);
      await shot(page, "13-share-card", { fullPage: true });
    }
  }
}

const errors = runs.flatMap((l) => l.errors);
for (const l of runs.slice(1)) await l.browser.close();
await finish(runs[0].browser, errors);
