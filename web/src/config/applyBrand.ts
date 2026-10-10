import { BRAND_PENDING, type BrandColors, type BrandSet } from "./brand";

const kebab = (s: string) => s.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);
const vars = (c: BrandColors) =>
  Object.entries(c)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `--${kebab(k)}:${v}`)
    .join(";");

/**
 * The brand as CSS: light theme on :root; dark when <html data-theme="dark"> (chosen on Me), or when
 * the phone is in dark mode and no theme was chosen ("System"). Injected into index.html at build
 * time (vite.config.ts) together with themeBootScript(), so the first paint is already on-brand and
 * in the right theme, before any JavaScript bundle runs.
 */
export function brandCss(brand: BrandSet): string {
  const common = `--font-family:${brand.fontFamily};--font-display:${brand.displayFontFamily};color-scheme:light dark`;
  const dark = vars(brand.themes.dark);
  const fonts = brand.fontFiles
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";src:url("${f.src}") format("woff2");font-weight:${f.weight};` +
        `font-style:${f.style ?? "normal"};font-display:swap}`,
    )
    .join("");
  return (
    `${fonts}:root{${common};${vars(brand.themes.light)}}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}` +
    `:root[data-theme="dark"]{${dark};color-scheme:dark}:root[data-theme="light"]{color-scheme:light}` +
    // Page colour straight from these variables, so even the very first paint is in the right theme.
    `html{background:var(--bg);color:var(--text)}`
  );
}

/** Saved theme choice (Me → Appearance); absent = follow the phone. Same key as lib/theme.ts. */
export const THEME_KEY = "theme";

/**
 * Tiny inline script for <head>: applies a saved Light/Dark choice before the first paint (no flash
 * of the wrong theme) and points the browser-bar colour at it. "System" needs nothing — the CSS and
 * the media-specific theme-color metas follow the phone live.
 */
export function themeBootScript(brand: BrandSet): string {
  const colors = JSON.stringify({ light: brand.themes.light.themeColor, dark: brand.themes.dark.themeColor });
  return (
    `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="light"&&t!=="dark")return;` +
    `document.documentElement.setAttribute("data-theme",t);var c=${colors}[t];` +
    `document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.removeAttribute("media");m.setAttribute("content",c)})}catch(e){}})()`
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
  syncThemeColor(brand);

  if (import.meta.env.DEV && BRAND_PENDING.length) {
    console.info(`[brand] official items still on placeholder:\n- ${BRAND_PENDING.join("\n- ")}`);
  }
}

/**
 * Browser-bar colour for the current choice: one fixed colour for Light/Dark, or the two
 * media-specific metas for System (they follow the phone by themselves).
 */
export function syncThemeColor(brand: BrandSet): void {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const chosen = document.documentElement.getAttribute("data-theme");
  const metas =
    chosen === "light" || chosen === "dark"
      ? [{ media: "", content: brand.themes[chosen].themeColor }]
      : themeColorMetas(brand);
  for (const { media, content } of metas) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    if (media) meta.media = media;
    meta.content = content;
    document.head.append(meta);
  }
}
