// Branding (CLAUDE.md rule 8). Official Duolingo / DET branding is approved, pending the final review
// on Wed Oct 7. EVERYTHING brand-related — names, colours, fonts, logo + mascot paths, Lingo names —
// lives here; components read BRAND / CSS variables only. To revert after Oct 7: set
// ACTIVE_BRAND = "placeholder" (one line).
// Official files come ONLY from the Duolingo team (assets/brand/ → copied to /brand/ at build). An
// official item whose file isn't supplied yet falls back to the placeholder (see BRAND_PENDING).

export const ACTIVE_BRAND: "official" | "placeholder" = "official";

/** Files present in assets/brand/{fonts,logos,mascots,models} (filled in by vite.config.ts). */
declare const __BRAND_FILES__: string[];

/**
 * One colour theme. The app follows the phone (prefers-color-scheme): `themes.light` / `themes.dark`
 * become CSS variables (--primary, --surface-2, …) — see applyBrand.ts. Every text/background pair
 * used by theme.css is ≥ 4.5:1 (checked by web/scripts/check-contrast.mjs).
 */
export interface BrandColors {
  // Core palette
  bg: string;
  /** Second backdrop colour (hero glow / gradients behind the big Scan button). */
  bgAlt: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  /** Main action colour (3D buttons, Scan button, progress). */
  primary: string;
  /** The solid "3D" bottom edge under primary buttons. */
  primaryDark: string;
  /** Text/icons on primary-coloured buttons. */
  onPrimary: string;
  /** Primary-green text on bg / surface (the bright green itself is too light for text). */
  primaryText: string;
  primaryGlow: string;
  primarySoft: string;
  /** Secondary action colour (selected answers, info). */
  accent: string;
  accentDark: string;
  onAccent: string;
  /** Text links. */
  link: string;
  /** Streak / flame / favourite fills. */
  warn: string;
  warnDark: string;
  /** Streak text on bg / surface. */
  warnText: string;
  streakBg: string;
  /** The streak flame before today's first win. */
  flameOff: string;
  favoriteBg: string;
  danger: string;
  dangerDark: string;
  onDanger: string;
  dangerSoft: string;
  dangerBorder: string;
  dangerText: string;
  /** Missed-word chips on the result screen. */
  missedBg: string;
  // Rewards
  gold: string;
  goldEnd: string;
  goldDark: string;
  /** Text on the gold (MAX) gradient and on medals. */
  onGold: string;
  goldGlow: string;
  silver: string;
  bronze: string;
  /** Level badge backgrounds (Lv 1 / Lv 2 / Lv 3; MAX is gold) and their text. */
  levelOne: string;
  levelTwo: string;
  levelThree: string;
  onLevel: string;
  allTenFrom: string;
  allTenTo: string;
  /** Text on the all-ten / raid gradient. */
  onAllTen: string;
  // Catch timer ring: plenty of time → half → last seconds.
  ringGood: string;
  ringMid: string;
  ringLow: string;
  // Dex
  slotEmpty: string;
  slotMark: string;
  // Overlays and camera glass (the camera is always dark, in both themes)
  overlay: string;
  scrim: string;
  shadow: string;
  cardGlass: string;
  onGlass: string;
  glassMuted: string;
  errorGlass: string;
  navBg: string;
  /** Camera stage behind the video (functional, normally black). */
  arStage: string;
  /** QR background (must stay light for scanners). */
  qrBg: string;
  /** Browser UI colour (meta theme-color). */
  themeColor: string;
  confetti: string[];
}

export interface FontFile {
  family: string;
  /** Path under /brand/fonts/ (e.g. "/brand/fonts/xyz-bold.woff2"). */
  src: string;
  weight: string;
  style?: string;
}

export interface BrandSet {
  /** The game's name. */
  appName: string;
  /** Campaign line under the name (e.g. on the login screen). */
  campaignName: string;
  /** Playful one-liner on the login hero. */
  tagline: string;
  /** The partner / exam brand. */
  partnerName: string;
  /** What the creatures are called. */
  creatureName: string;
  raidName: string;
  campusName: string;
  themes: { light: BrandColors; dark: BrandColors };
  /** CSS font-family stack for body text. */
  fontFamily: string;
  /** Chunky rounded display face: headings, buttons, numbers. */
  displayFontFamily: string;
  /** @font-face files loaded at startup. */
  fontFiles: FontFile[];
  logo: {
    /** Logo / wordmark shown on the login screen. */
    full: string;
    /** Square mark used as the favicon. */
    mark: string;
  };
  /** Mascot illustrations; null → the built-in placeholder critter (components/Mascot.tsx). */
  mascots: {
    /** Login / welcome illustration. */
    hero: string | null;
    /** Win screen illustration. */
    celebrate: string | null;
    /** Empty / error states (offline, off campus, camera blocked, in-app browser). */
    oops: string | null;
  };
  /** lingoId → display name (falls back to the name stored in Firestore). */
  lingoNames: Record<string, string>;
  /** lingoId → 2D art for the Dex / Catch screens; missing → placeholder critter in the Lingo's colour. */
  lingoArt: Record<string, string>;
}

const CONFETTI = ["#58CC02", "#1CB0F6", "#FF9600", "#CE82FF", "#FF4B4B", "#FFC800"];

const LIGHT: BrandColors = {
  bg: "#f6f8fc",
  bgAlt: "#e2f5d3",
  surface: "#ffffff",
  surface2: "#eef2f8",
  border: "#d5ddea",
  text: "#14213d",
  muted: "#56637d",
  primary: "#58cc02",
  primaryDark: "#46a302",
  onPrimary: "#0d2600",
  primaryText: "#2b7a00",
  primaryGlow: "rgb(88 204 2 / 0.4)",
  primarySoft: "rgb(88 204 2 / 0.14)",
  accent: "#1cb0f6",
  accentDark: "#1690cc",
  onAccent: "#04223a",
  link: "#0a66a3",
  warn: "#ff9600",
  warnDark: "#cc6f00",
  warnText: "#ad5200",
  streakBg: "rgb(255 150 0 / 0.14)",
  flameOff: "#aab4c6",
  favoriteBg: "rgb(255 150 0 / 0.1)",
  danger: "#d93636",
  dangerDark: "#a82424",
  onDanger: "#ffffff",
  dangerSoft: "rgb(217 54 54 / 0.08)",
  dangerBorder: "rgb(217 54 54 / 0.35)",
  dangerText: "#b02222",
  missedBg: "rgb(217 54 54 / 0.12)",
  gold: "#ffc800",
  goldEnd: "#ff9600",
  goldDark: "#c48a00",
  onGold: "#2a1a00",
  goldGlow: "rgb(255 180 0 / 0.55)",
  silver: "#c3ccdb",
  bronze: "#e39a62",
  levelOne: "#e3e9f3",
  levelTwo: "#d4f5c2",
  levelThree: "#d3e6ff",
  onLevel: "#14213d",
  allTenFrom: "#7c4dff",
  allTenTo: "#2563eb",
  onAllTen: "#ffffff",
  ringGood: "#58cc02",
  ringMid: "#ffb800",
  ringLow: "#ff4b4b",
  slotEmpty: "#e3e8f1",
  slotMark: "#b3bfd2",
  overlay: "rgb(10 20 40 / 0.66)",
  scrim: "rgb(10 20 40 / 0.5)",
  shadow: "rgb(20 33 61 / 0.14)",
  cardGlass: "rgb(14 22 42 / 0.9)",
  onGlass: "#ffffff",
  glassMuted: "#c4cee3",
  errorGlass: "rgb(70 12 18 / 0.92)",
  navBg: "#ffffff",
  arStage: "#000",
  qrBg: "#fff",
  themeColor: "#f6f8fc",
  confetti: CONFETTI,
};

const DARK: BrandColors = {
  ...LIGHT,
  bg: "#0b1426",
  bgAlt: "#13264a",
  surface: "#16223d",
  surface2: "#1f2e50",
  border: "#2e4170",
  text: "#f2f6ff",
  muted: "#a8b5d1",
  primaryDark: "#3e8f00",
  primaryText: "#7ddc3a",
  primarySoft: "rgb(88 204 2 / 0.16)",
  link: "#6cc9ff",
  warnText: "#ffb347",
  streakBg: "rgb(255 150 0 / 0.16)",
  flameOff: "#56658a",
  favoriteBg: "rgb(255 150 0 / 0.12)",
  dangerSoft: "rgb(255 75 75 / 0.14)",
  dangerBorder: "rgb(255 75 75 / 0.45)",
  dangerText: "#ffa3a3",
  missedBg: "rgb(255 75 75 / 0.2)",
  goldGlow: "rgb(255 200 0 / 0.6)",
  levelOne: "#2a3a5e",
  levelTwo: "#1f6b3a",
  levelThree: "#1d5fa8",
  onLevel: "#ffffff",
  slotEmpty: "#0f1a33",
  slotMark: "#33466e",
  overlay: "rgb(5 10 25 / 0.6)",
  scrim: "rgb(5 10 25 / 0.72)",
  shadow: "rgb(0 0 0 / 0.45)",
  navBg: "#111b33",
  themeColor: "#0b1426",
};

/** The look before official branding (kept for a one-line revert). */
export const PLACEHOLDER: BrandSet = {
  appName: "Decade Hunt",
  campaignName: "10 years · 10 Lingos · 2 campuses",
  tagline: "Ten posters are hiding Lingos. Find them, catch them, top the board!",
  partnerName: "the English Test",
  creatureName: "Lingo",
  raidName: "Owl Raid",
  campusName: "JECRC",
  themes: { light: LIGHT, dark: DARK },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  // Nunito (SIL Open Font License, web/public/fonts/OFL-Nunito.txt) — not a brand font.
  displayFontFamily: 'GameDisplay, ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFiles: [{ family: "GameDisplay", src: "/fonts/nunito-800.woff2", weight: "800" }],
  logo: { full: "/favicon.svg", mark: "/favicon.svg" },
  mascots: { hero: null, celebrate: null, oops: null },
  lingoNames: {
    "lingo-2016": "Pip",
    "lingo-2017": "Ziggy",
    "lingo-2018": "Bloop",
    "lingo-2019": "Echo",
    "lingo-2020": "Nova",
    "lingo-2021": "Remy",
    "lingo-2022": "Quill",
    "lingo-2023": "Sage",
    "lingo-2024": "Lumo",
    "lingo-2025": "Decka",
  },
  lingoArt: {},
};

// ---------- Official (Duolingo-supplied) ----------

const FILES = new Set(typeof __BRAND_FILES__ === "undefined" ? [] : __BRAND_FILES__);
/** Brand items still on placeholder values, for the build log / report. */
export const BRAND_PENDING: string[] = [];

/** `/brand/<path>` if the Duolingo team supplied that file, else the placeholder (and note it). */
function supplied<T>(item: string, path: string, fallback: T): string | T {
  if (FILES.has(path)) return `/brand/${path}`;
  BRAND_PENDING.push(`${item} (expects assets/brand/${path})`);
  return fallback;
}
/** A value that must come from the brand guidelines; until then keep the placeholder. */
function pending<T>(item: string, fallback: T): T {
  BRAND_PENDING.push(`${item} (needs assets/brand/guidelines)`);
  return fallback;
}

// Expected file names are listed in assets/brand/README.md.
const officialFonts: FontFile[] = (
  [
    ["fonts/brand-regular.woff2", "400"],
    ["fonts/brand-bold.woff2", "700"],
  ] as const
)
  .filter(([p]) => FILES.has(p))
  .map(([p, weight]) => ({ family: "BrandFont", src: `/brand/${p}`, weight }));
if (!officialFonts.length) BRAND_PENDING.push("font (expects assets/brand/fonts/brand-regular.woff2 + brand-bold.woff2)");

export const OFFICIAL: BrandSet = {
  ...PLACEHOLDER,
  appName: PLACEHOLDER.appName, // the game's own name — not a Duolingo mark
  campaignName: pending("campaign name", PLACEHOLDER.campaignName),
  partnerName: "Duolingo English Test", // approved (rule 8)
  themes: pending("colours", PLACEHOLDER.themes),
  fontFamily: officialFonts.length ? `BrandFont, ${PLACEHOLDER.fontFamily}` : PLACEHOLDER.fontFamily,
  displayFontFamily: officialFonts.length ? `BrandFont, ${PLACEHOLDER.displayFontFamily}` : PLACEHOLDER.displayFontFamily,
  fontFiles: officialFonts.length ? officialFonts : PLACEHOLDER.fontFiles,
  logo: {
    full: supplied("logo", "logos/logo.svg", PLACEHOLDER.logo.full),
    mark: supplied("logo mark / favicon", "logos/mark.svg", PLACEHOLDER.logo.mark),
  },
  mascots: {
    hero: supplied("mascot: welcome", "mascots/hero.png", PLACEHOLDER.mascots.hero),
    celebrate: supplied("mascot: celebrate", "mascots/celebrate.png", PLACEHOLDER.mascots.celebrate),
    oops: supplied("mascot: oops (error states)", "mascots/oops.png", PLACEHOLDER.mascots.oops),
  },
  // The characters on the official posters (assets/posters/official), posterIndex 0–9 = 2016–2025.
  lingoNames: {
    "lingo-2016": "Duo",
    "lingo-2017": "Lily",
    "lingo-2018": "Zari",
    "lingo-2019": "Bea",
    "lingo-2020": "Vikram",
    "lingo-2021": "Junior",
    "lingo-2022": "Oscar",
    "lingo-2023": "Eddy",
    "lingo-2024": "Lin",
    "lingo-2025": "Lucy",
  },
  // Character art per Lingo (assets/brand/mascots/lingo-<year>.png), only where supplied.
  lingoArt: Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => `lingo-${2016 + i}`)
      .filter((id) => FILES.has(`mascots/${id}.png`))
      .map((id) => [id, `/brand/mascots/${id}.png`]),
  ),
};

export const BRAND: BrandSet = ACTIVE_BRAND === "official" ? OFFICIAL : PLACEHOLDER;

/** Display name for a Lingo: the brand's name if set, else the name stored in Firestore. */
export const lingoName = (lingo: { id: string; name: string }) => BRAND.lingoNames[lingo.id] ?? lingo.name;
