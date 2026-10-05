import { BRAND_PENDING, type BrandColors, type BrandSet } from "./brand";

const kebab = (s: string) => s.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);
const vars = (c: BrandColors) =>
  Object.entries(c)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `--${kebab(k)}:${v}`)
    .join(";");

/**
 * The brand as CSS: light theme on :root, dark theme when the phone is in dark mode
 * (prefers-color-scheme). Injected into index.html at build time (vite.config.ts) so the first
 * paint is already on-brand and in the right theme, before any JavaScript runs.
 */
export function brandCss(brand: BrandSet): string {
  const common = `--font-family:${brand.fontFamily};--font-display:${brand.displayFontFamily};color-scheme:light dark`;
  const fonts = brand.fontFiles
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url("${f.src}") format("woff2");font-weight:${f.weight};` +
        `font-style:${f.style ?? "normal"};font-display:swap}`,
    )
    .join("");
  return (
    `${fonts}:root{${common};${vars(brand.themes.light)}}` +
    `@media (prefers-color-scheme:dark){:root{${vars(brand.themes.dark)}}}`
  );
}

/** <meta name="theme-color"> per theme (browser bar colour). */
export function themeColorMetas(brand: BrandSet): Array<{ media: string; content: string }> {
  return [
    { media: "(prefers-color-scheme: light)", content: brand.themes.light.themeColor },
    { media: "(prefers-color-scheme: dark)", content: brand.themes.dark.themeColor },
  ];
}

/**
 * Applies a brand before the first render: colours (both themes) as CSS variables, fonts, page
 * title, favicon and the browser theme colour. theme.css uses only these variables, so nothing
 * brand-specific is hard-coded in styles or components.
 */
export function applyBrand(brand: BrandSet): void {
  // Normally already in index.html (vite.config.ts); (re)written here so dev edits apply too.
  let style = document.getElementById("brand-vars");
  if (!style) {
    style = document.createElement("style");
    style.id = "brand-vars";
    document.head.prepend(style);
  }
  style.textContent = brandCss(brand);

  document.title = brand.appName;
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.append(icon);
  }
  icon.href = brand.logo.mark;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  for (const { media, content } of themeColorMetas(brand)) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.media = media;
    meta.content = content;
    document.head.append(meta);
  }

  if (import.meta.env.DEV && BRAND_PENDING.length) {
    console.info(`[brand] official items still on placeholder:\n- ${BRAND_PENDING.join("\n- ")}`);
  }
}
