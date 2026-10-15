// App icons from the kit's green DET emblem (assets/brand/logos/GreenEmblem-*.svg): PNGs for the
// iPhone home screen (apple-touch-icon, 180 px) and Android (192 / 512 px), on a white square with
// padding. Output: web/public/brand-icons/ (git-ignored, like all brand files). Run after the kit
// changes:   node web/scripts/app-icons.mjs      (uses the E2E suite's Playwright: cd e2e && npm i)
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const logos = resolve(here, "../../assets/brand/logos");
const emblem = readdirSync(logos).find((f) => /^GreenEmblem.*\.svg$/i.test(f));
if (!emblem) {
  console.error("No assets/brand/logos/GreenEmblem-*.svg");
  process.exit(1);
}
const out = resolve(here, "../public/brand-icons");
mkdirSync(out, { recursive: true });
const require = createRequire(resolve(here, "../../e2e/package.json"));
const { chromium } = require("playwright-core");
const svg = readFileSync(join(logos, emblem), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  await page.setViewportSize({ width: size, height: size });
  const pad = Math.round(size * 0.14);
  await page.setContent(
    `<html><body style="margin:0;background:#FFFFFF;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace("<svg", '<svg width="100%" height="100%"')}</div></body></html>`,
  );
  await page.screenshot({ path: join(out, name), omitBackground: false });
  console.log(`  app icon: ${name} (${size} px)`);
}
await browser.close();
