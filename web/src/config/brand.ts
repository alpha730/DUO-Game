// Branding (CLAUDE.md rule 8). Official Duolingo / DET branding is approved, pending the final review
// on Wed Oct 7. EVERYTHING brand-related — names, colours, fonts, logo + mascot paths, Lingo names —
// lives here; components read BRAND / CSS variables only. To revert after Oct 7: set
// ACTIVE_BRAND = "placeholder" (one line).
// Official files come ONLY from the Duolingo team (assets/brand/ → copied to /brand/ at build). An
// official item whose file isn't supplied yet falls back to the placeholder (see BRAND_PENDING).

export const ACTIVE_BRAND: "official" | "placeholder" = "official";

/** Files present in assets/brand/{fonts,logos,mascots,models} (filled in by vite.config.ts). */
declare const __BRAND_FILES__: string[];

export interface BrandColors {
  // Core palette
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryDark: string;
  accent: string;
  warn: string;
  danger: string;
  /** Text/icons on primary-coloured buttons and coloured Lingo slots. */
  onPrimary: string;
  /** Text on the gold (MAX) gradient. */
  onGold: string;
  // Derived surfaces
  dangerSoft: string;
  dangerBorder: string;
  dangerText: string;
  /** Missed-word chips on the result screen. */
  missedBg: string;
  overlay: string;
  shadow: string;
  cardGlass: string;
  errorGlass: string;
  levelTwo: string;
  levelThree: string;
  gold: string;
  goldEnd: string;
  goldGlow: string;
  primaryGlow: string;
  favoriteBg: string;
  streakBg: string;
  slotEmpty: string;
  slotMark: string;
  allTenFrom: string;
  allTenTo: string;
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
  /** The partner / exam brand. */
  partnerName: string;
  /** What the creatures are called. */
  creatureName: string;
  raidName: string;
  campusName: string;
  colors: BrandColors;
  colorScheme: "dark" | "light";
  /** CSS font-family stack. */
  fontFamily: string;
  /** @font-face files loaded at startup. */
  fontFiles: FontFile[];
  logo: {
    /** Logo / wordmark shown on the login screen. */
    full: string;
    /** Square mark used as the favicon. */
    mark: string;
  };
  mascots: {
    /** Login / welcome illustration. */
    hero: string | null;
    /** Win screen illustration. */
    celebrate: string | null;
  };
  /** lingoId → display name (falls back to the name stored in Firestore). */
  lingoNames: Record<string, string>;
}

/** The look before official branding (kept for a one-line revert). */
export const PLACEHOLDER: BrandSet = {
  appName: "Decade Hunt",
  campaignName: "10 years · 10 Lingos · 1 campus",
  partnerName: "the English Test",
  creatureName: "Lingo",
  raidName: "Owl Raid",
  campusName: "JECRC",
  colors: {
    bg: "#0f1a0a",
    surface: "#1b2a14",
    surface2: "#24371b",
    border: "#33492a",
    text: "#f4f8f0",
    muted: "#a3b598",
    primary: "#58cc02",
    primaryDark: "#46a302",
    accent: "#1cb0f6",
    warn: "#ff9600",
    danger: "#ff4b4b",
    onPrimary: "#fff",
    onGold: "#000",
    dangerSoft: "rgb(255 75 75 / 0.12)",
    dangerBorder: "rgb(255 75 75 / 0.4)",
    dangerText: "#ffb3b3",
    missedBg: "rgb(255 75 75 / 0.18)",
    overlay: "rgb(0 0 0 / 0.6)",
    shadow: "rgb(0 0 0 / 0.4)",
    cardGlass: "rgb(15 26 10 / 0.92)",
    errorGlass: "rgb(60 10 10 / 0.85)",
    levelTwo: "#2b4d1b",
    levelThree: "#1b3f5c",
    gold: "#ffc800",
    goldEnd: "#ff9600",
    goldGlow: "rgb(255 200 0 / 0.7)",
    primaryGlow: "rgb(88 204 2 / 0.45)",
    favoriteBg: "#2a2a12",
    streakBg: "#3a2a0c",
    slotEmpty: "#0b1307",
    slotMark: "#26361e",
    allTenFrom: "#7c4dff",
    allTenTo: "#1cb0f6",
    arStage: "#000",
    qrBg: "#fff",
    themeColor: "#0f1a0a",
    confetti: ["#58CC02", "#1CB0F6", "#FF9600", "#CE82FF", "#FF4B4B", "#FFC800"],
  },
  colorScheme: "dark",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  fontFiles: [],
  logo: { full: "/favicon.svg", mark: "/favicon.svg" },
  mascots: { hero: null, celebrate: null },
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
  colors: pending("colours", PLACEHOLDER.colors),
  fontFamily: officialFonts.length ? `BrandFont, ${PLACEHOLDER.fontFamily}` : PLACEHOLDER.fontFamily,
  fontFiles: officialFonts,
  logo: {
    full: supplied("logo", "logos/logo.svg", PLACEHOLDER.logo.full),
    mark: supplied("logo mark / favicon", "logos/mark.svg", PLACEHOLDER.logo.mark),
  },
  mascots: {
    hero: supplied("mascot: welcome", "mascots/hero.png", PLACEHOLDER.mascots.hero),
    celebrate: supplied("mascot: celebrate", "mascots/celebrate.png", PLACEHOLDER.mascots.celebrate),
  },
  lingoNames: pending("Lingo display names", PLACEHOLDER.lingoNames),
};

export const BRAND: BrandSet = ACTIVE_BRAND === "official" ? OFFICIAL : PLACEHOLDER;

/** Display name for a Lingo: the brand's name if set, else the name stored in Firestore. */
export const lingoName = (lingo: { id: string; name: string }) => BRAND.lingoNames[lingo.id] ?? lingo.name;
