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
  /** Selected answer / active tab (DET light-blue tile) + its border; text on it uses `link`. */
  accentSoft: string;
  accentBorder: string;
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
  /** Co-brand line (login, Home header, splash) when no lockup image is supplied. */
  coBrandText: string;
  /** Short co-brand for the share card + leaderboard header. */
  coBrandShort: string;
  /** Official co-brand lockup image (e.g. DET × JECRC), or null → coBrandText. */
  coBrandLockup: string | null;
  /** Free official practice test ("Get ready for the real DET"), or null → card hidden. */
  practiceUrl: string | null;
  /** Short name of the real test, used in copy ("Get ready for the real DET"). */
  examShortName: string;
  /** What the creatures are called. */
  creatureName: string;
  raidName: string;
  campusName: string;
  /** Scan screen hint while looking for a poster (aim at the art, not the shared header/footer). */
  scanHint: string;
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
  accentSoft: "rgb(28 176 246 / 0.12)",
  accentBorder: "#84d8ff",
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
  accentSoft: "rgb(28 176 246 / 0.16)",
  accentBorder: "#1d6f99",
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

// ---------- DET palette (official) ----------
// Taken from the Duolingo English Test site + practice test (reference screenshots): white pages,
// light-grey card borders with a thicker bottom edge, DET blue for selection/links, Duolingo green
// for the main action, dark-grey text. Text colours are darkened where the site's own pairs are
// below 4.5:1 (e.g. white on green/blue buttons → dark text; blue link text → deeper blue).
const DET_CONFETTI = ["#58CC02", "#1CB0F6", "#FF9600", "#CE82FF", "#FF4B4B", "#FFC800"];

const DET_LIGHT: BrandColors = {
  bg: "#ffffff",
  bgAlt: "#d7ffb8",
  surface: "#ffffff",
  surface2: "#f7f7f7",
  border: "#e5e5e5",
  text: "#3c3c3c",
  muted: "#6b6b6b",
  primary: "#58cc02",
  primaryDark: "#58a700",
  onPrimary: "#173300", // dark: white on #58cc02 is only 2.1:1
  primaryText: "#3d7a00",
  primaryGlow: "rgb(88 204 2 / 0.25)",
  primarySoft: "#d7ffb8",
  accent: "#1cb0f6",
  accentDark: "#1899d6",
  onAccent: "#04223a", // dark: white on #1cb0f6 is only 2.4:1
  accentSoft: "#ddf4ff",
  accentBorder: "#84d8ff",
  link: "#0b6aa2",
  warn: "#ff9600",
  warnDark: "#cd7900",
  warnText: "#a65800",
  streakBg: "#fff3e0",
  flameOff: "#afafaf",
  favoriteBg: "#fff8e6",
  danger: "#ff4b4b",
  dangerDark: "#ea2b2b",
  onDanger: "#2a0000",
  dangerSoft: "#ffdfe0",
  dangerBorder: "#ffb2b2",
  dangerText: "#b31d1d",
  missedBg: "#ffdfe0",
  gold: "#ffc800",
  goldEnd: "#ff9600",
  goldDark: "#cd9900",
  onGold: "#3c2a00",
  goldGlow: "rgb(255 200 0 / 0.4)",
  silver: "#d6dde3",
  bronze: "#f0b080",
  levelOne: "#f0f0f0",
  levelTwo: "#d7ffb8",
  levelThree: "#ddf4ff",
  onLevel: "#3c3c3c",
  allTenFrom: "#7c4dff",
  allTenTo: "#2563eb",
  onAllTen: "#ffffff",
  ringGood: "#58cc02",
  ringMid: "#ffc800",
  ringLow: "#ff4b4b",
  slotEmpty: "#f7f7f7",
  slotMark: "#cfcfcf",
  overlay: "rgb(30 30 30 / 0.66)",
  scrim: "rgb(30 30 30 / 0.45)",
  shadow: "rgb(0 0 0 / 0.08)",
  // Over the live camera: dark glass in both themes (also used on the dark camera dimmer).
  cardGlass: "rgb(19 31 36 / 0.9)",
  onGlass: "#ffffff",
  glassMuted: "#c2d0d7",
  errorGlass: "rgb(70 12 18 / 0.92)",
  navBg: "#ffffff",
  arStage: "#000",
  qrBg: "#fff",
  themeColor: "#ffffff",
  confetti: DET_CONFETTI,
};

// Dark: DET has no dark mode; built from the same family (Duolingo's dark greys + the DET accents).
const DET_DARK: BrandColors = {
  ...DET_LIGHT,
  bg: "#131f24",
  bgAlt: "#1f3a0f",
  surface: "#1a2a31",
  surface2: "#22343c",
  border: "#37464f",
  text: "#f1f7fb",
  muted: "#a5b6bf",
  onPrimary: "#0f2a00",
  primaryText: "#8ee32a",
  primaryGlow: "rgb(88 204 2 / 0.2)",
  primarySoft: "rgb(88 204 2 / 0.16)",
  onAccent: "#04223a",
  accentSoft: "rgb(28 176 246 / 0.16)",
  accentBorder: "#1f7fae",
  link: "#6cc9ff",
  warnText: "#ffb347",
  streakBg: "rgb(255 150 0 / 0.16)",
  flameOff: "#52656e",
  favoriteBg: "rgb(255 200 0 / 0.1)",
  dangerSoft: "rgb(255 75 75 / 0.14)",
  dangerBorder: "rgb(255 75 75 / 0.45)",
  dangerText: "#ffa3a3",
  missedBg: "rgb(255 75 75 / 0.18)",
  goldGlow: "rgb(255 200 0 / 0.35)",
  silver: "#c7d0d6",
  levelOne: "#2b3d46",
  levelTwo: "#25521a",
  levelThree: "#164a6b",
  onLevel: "#ffffff",
  slotEmpty: "#1a2a31",
  slotMark: "#37464f",
  overlay: "rgb(0 0 0 / 0.6)",
  scrim: "rgb(0 0 0 / 0.6)",
  shadow: "rgb(0 0 0 / 0.4)",
  navBg: "#131f24",
  themeColor: "#131f24",
};

/** The look before official branding (kept for a one-line revert). */
export const PLACEHOLDER: BrandSet = {
  appName: "Decade Hunt",
  campaignName: "10 years · 10 Lingos · 2 campuses",
  tagline: "Ten posters are hiding Lingos. Find them, catch them, top the board!",
  partnerName: "the English Test",
  coBrandText: "Decade Hunt × JECRC",
  coBrandShort: "JECRC · 10 Years",
  coBrandLockup: null,
  practiceUrl: null,
  examShortName: "the English Test",
  creatureName: "Lingo",
  raidName: "Owl Raid",
  campusName: "JECRC",
  scanHint: "Point at the Lingo in the middle of the poster",
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
  coBrandText: "Duolingo English Test × JECRC",
  coBrandShort: "DET × JECRC · 10 Years",
  // Official DET × JECRC lockup from the Duolingo team, when supplied; else the text above.
  coBrandLockup: supplied("DET × JECRC lockup", "logos/det-jecrc-lockup.svg", null),
  practiceUrl: "https://englishtest.duolingo.com",
  examShortName: "DET",
  scanHint: "Point at Duo in the middle of the poster", // every final poster shows Duo
  // DET palette from the reference screenshots (user, Oct 10); swap in guideline values if supplied.
  themes: { light: DET_LIGHT, dark: DET_DARK },
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
  // Duo's moods on the final posters (assets/posters/final), posterIndex 0–9 = 2016–2025. Same names
  // as the lingos collection (scripts/lingos.ts), so server messages match what the app shows.
  lingoNames: {
    "lingo-2016": "Rookie Duo",
    "lingo-2017": "Curious Duo",
    "lingo-2018": "Winking Duo",
    "lingo-2019": "Thumbs-Up Duo",
    "lingo-2020": "Fierce Duo",
    "lingo-2021": "Lovestruck Duo",
    "lingo-2022": "Joyful Duo",
    "lingo-2023": "Bookworm Duo",
    "lingo-2024": "Cool Duo",
    "lingo-2025": "Champion Duo",
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
