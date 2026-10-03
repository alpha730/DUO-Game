import { BRAND_PENDING, type BrandSet } from "./brand";

const kebab = (s: string) => s.replace(/[A-Z0-9]+/g, (m) => `-${m.toLowerCase()}`);

/** The brand as a `:root{…}` rule — injected into index.html at build time (vite.config.ts) so the
 *  first paint is already on-brand, before any JavaScript runs. */
export function brandCss(brand: BrandSet): string {
  const vars = Object.entries(brand.colors)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => `--${kebab(k)}:${v}`);
  vars.push(`--font-family:${brand.fontFamily}`, `color-scheme:${brand.colorScheme}`);
  return `:root{${vars.join(";")}}`;
}

/**
 * Applies a brand before the first render: colours as CSS variables (--primary, --surface-2, …),
 * fonts via @font-face, page title, favicon and the browser theme colour. theme.css uses only these
 * variables, so nothing brand-specific is hard-coded in styles or components.
 */
export function applyBrand(brand: BrandSet): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(brand.colors)) {
    if (typeof value === "string") root.style.setProperty(`--${kebab(key)}`, value);
  }
  root.style.setProperty("--font-family", brand.fontFamily);
  root.style.colorScheme = brand.colorScheme;

  if (brand.fontFiles.length) {
    const css = brand.fontFiles
      .map(
        (f) =>
          `@font-face{font-family:"${f.family}";src:url("${f.src}") format("woff2");font-weight:${f.weight};` +
          `font-style:${f.style ?? "normal"};font-display:swap}`,
      )
      .join("\n");
    const style = document.createElement("style");
    style.dataset.brandFonts = "";
    style.textContent = css;
    document.head.append(style);
  }

  document.title = brand.appName;
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.append(icon);
  }
  icon.href = brand.logo.mark;
  let theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!theme) {
    theme = document.createElement("meta");
    theme.name = "theme-color";
    document.head.append(theme);
  }
  theme.content = brand.colors.themeColor;

  if (import.meta.env.DEV && BRAND_PENDING.length) {
    console.info(`[brand] official items still on placeholder:\n- ${BRAND_PENDING.join("\n- ")}`);
  }
}
