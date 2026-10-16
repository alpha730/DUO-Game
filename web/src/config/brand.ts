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
  /** Brand colour: celebration, wins, the Scan button, progress. */
  primary: string;
  /** The solid "3D" bottom edge under primary buttons. */
  primaryDark: string;
  /** Text/icons on primary-coloured buttons. */
  onPrimary: string;
  /** Primary-green text on bg / surface (the bright green itself is too light for text). */
  primaryText: string;
  primaryGlow: string;
  primarySoft: string;
  /** Primary action (DET "CONTINUE" buttons) + its 3D edge + text on it. */
  action: string;
  actionDark: string;
  onAction: string;
  /** Disabled buttons (DET: Swan fill, Hare label). Disabled controls are exempt from the 4.5:1 rule. */
  disabledBg: string;
  onDisabled: string;
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
  /** Uncaught Lingo silhouette: the art turned black, at this opacity, with this edge glow (dark theme). */
  silhouetteOpacity: string;
  silhouetteEdge: string;
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

/** An asset with a light-theme and a dark-theme version (null = not supplied). */
export interface Themed {
  light: string | null;
  dark: string | null;
}
export type Det10Icon = "backpack" | "books" | "building" | "doorClosed" | "doorOpen" | "globe" | "key";
export type HeroName = "beaComputerDuo" | "duoInstitutions" | "beaCertificateDuo" | "linComputer" | "zariCertified" | "beaDuoSurfing" | "duoSeal";
export type UiIconName = "test" | "practice" | "rules" | "overview" | "testSetup" | "cart" | "search" | "id" | "mail" | "microscope";
export type SoundName = "correct" | "wrong" | "levelup" | "found" | "tick";
/** Duo poses used by the app (assets/brand/mascots/Duo_*.svg). */
export type DuoMood =
  | "wave"
  | "joyous"
  | "heartEyes"
  | "coolGuy"
  | "sad"
  | "flee"
  | "dizzy"
  | "sleep"
  /** Read Aloud question. */
  | "microphone"
  /** Streak flame / streak toast. */
  | "streak"
  /** "No Lingos left today". */
  | "nightOwl"
  /** "Get ready for the real DET" card. */
  | "det"
  /** MAX celebration. */
  | "trophy"
  /** Rules / How to play. */
  | "pointer"
  /** Profile setup welcome. */
  | "welcome"
  /** Me → "Your skills". */
  | "placementTest";

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
  /** Feather Bold — headlines only (lowercase, ≥ 40 px, ≤ 10 words, left-aligned; DET-DESIGN §2). */
  headlineFontFamily: string;
  /** Font files preloaded in index.html (only DIN Regular + Bold, when supplied). */
  preloadFonts: string[];
  /** DET 10-Year visual identity (docs/DET-DESIGN.md §4), each null until supplied. */
  det10: {
    logo: Themed;
    lockupH: Themed;
    lockupV: Themed;
    /** Pattern tile for subtle backgrounds: light tile in the light theme, dark tile in dark. */
    pattern: Themed;
    /** The DET 10 seal (share card, MAX / all-10 celebrations). */
    seal: string | null;
    /** Icons: full style in the light theme, mono in dark. */
    icons: Record<Det10Icon, Themed>;
  };
  /** JECRC's full logo (assets/brand/jecrc/): colour on light, the supplied white knockout on dark /
   *  green / the share card; else "JECRC" set in Feather Bold. Never recoloured. */
  jecrcLogo: Themed;
  /** JECRC shield only (compact lockups and screens under 360 px). */
  jecrcMark: Themed;
  /** App icon / favicon (the green DET emblem). */
  appIcon: string | null;
  /** DET hero illustrations (Login, About, empty states, "Get ready for the real DET"). */
  heroes: Record<HeroName, string | null>;
  /** DET UI icons (nav + info). */
  uiIcons: Record<UiIconName, string | null>;
  /** DET scallop (level-badge shape; MAX = gold) + the India flag emblem (About: "JECRC, Jaipur"). */
  emblems: { scallop: string | null; india: string | null };
  /** Duo emotions & poses (Result, errors, no attempts left, welcome). */
  duo: Record<DuoMood, string | null>;
  /** Official in-app sounds; null → our own placeholder sounds in /sfx. */
  sounds: Record<SoundName, string | null>;
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
  /**
   * How a found Lingo appears on the poster: "standee" = its 2D art as an upright paper cut-out
   * (lingoStandee, else lingoArt), "model" = the 3D .glb from the lingos collection.
   */
  arMode: "standee" | "model";
  /** lingoId → 1024 px PNG of lingoArt for the AR standee (made by web/scripts/sync-assets.mjs). */
  lingoStandee: Record<string, string>;
  /** lingoId → display colour (overrides the colour stored with the Lingo; empty = keep it). */
  lingoColors: Record<string, string>;
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
  action: "#58cc02",
  actionDark: "#46a302",
  onAction: "#0d2600",
  disabledBg: "#eef2f8",
  onDisabled: "#56637d",
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
  silhouetteOpacity: "0.7",
  silhouetteEdge: "transparent",
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

// ---------- DET Juicy palette (official, docs/DET-DESIGN.md §1) ----------
// The ONLY colours in the app: every role below is one of these tokens (or a transparent tint of
// one). They're also CSS variables (--det-owl, --det-macaw, …) for the rare direct use.
// Contrast is checked, not assumed (web/scripts/check-contrast.ts): where the kit's own pairs are
// below 4.5:1 the text uses a darker palette colour — e.g. Manta Ray (not white) on Macaw / Owl / Bee
// buttons, Eel (not Wolf) for secondary text, Narwhal for links, Eel on the correct / wrong / selected
// tints with the coloured border + icon carrying the meaning.
export const DET = {
  // Core
  featherGreen: "#58CC02",
  maskGreen: "#89E219",
  // Neutrals
  eel: "#4B4B4B",
  wolf: "#777777",
  hare: "#AFAFAF",
  swan: "#E5E5E5",
  polar: "#F7F7F7",
  snow: "#FFFFFF",
  // Extended: main · dark (3D edge) · light · lightest (tint)
  owl: "#58CC02",
  treeFrog: "#58A700",
  turtle: "#A5ED6E",
  seaSponge: "#D7FFB8",
  macaw: "#1CB0F6",
  whale: "#1899D6",
  bluejay: "#84D8FF",
  iguana: "#DDF4FF",
  cardinal: "#FF4B4B",
  fireAnt: "#EA2B2B",
  flamingo: "#FFB2B2",
  walkingFish: "#FFDFE0",
  bee: "#FFC800",
  camel: "#E7A601",
  duck: "#FBE56D",
  canary: "#FFF5D3",
  fox: "#FF9600",
  guineaPig: "#CD7900",
  beetle: "#CE82FF",
  betta: "#9069CD",
  humpback: "#2B70C9",
  narwhal: "#1453A3",
  mantaRay: "#042C60",
  // Dark theme — our derivation (§1; the kit has no dark mode)
  night: "#131F24",
  nightSurface: "#1C2B33",
  nightBorder: "#37464F",
  nightText: "#F1F7FB",
} as const;
export type DetToken = keyof typeof DET;

/** A token with transparency (tints in dark mode, overlays, shadows) — still the same colour. */
const tint = (t: DetToken, alpha: number) => {
  const h = DET[t].slice(1);
  return `rgb(${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)} / ${alpha})`;
};

const DET_CONFETTI = [DET.owl, DET.macaw, DET.fox, DET.beetle, DET.cardinal, DET.bee];

const DET_LIGHT: BrandColors = {
  bg: DET.polar, // page behind the cards
  bgAlt: DET.seaSponge,
  surface: DET.snow, // cards
  surface2: DET.polar,
  border: DET.swan,
  text: DET.eel,
  muted: DET.eel, // Wolf is 4.48:1 on Snow / 4.18:1 on Polar — below 4.5, so secondary text is Eel (lighter weight)
  // Brand / celebrate / Scan: Owl with its Tree Frog 3D edge.
  primary: DET.owl,
  primaryDark: DET.treeFrog,
  // BRAND EXCEPTION (user decision, docs/ACCESSIBILITY.md): white uppercase DIN Bold labels on Owl /
  // Macaw buttons like Duolingo / DET, although white on them is 2.1 / 2.4:1. All other text ≥ 4.5:1.
  onPrimary: DET.snow,
  primaryText: DET.eel, // no green in the kit reaches 4.5:1 on white; green stays on fills and icons
  primaryGlow: tint("owl", 0.25),
  primarySoft: DET.seaSponge,
  // Primary action (DET "CONTINUE"): Macaw with its Whale edge.
  action: DET.macaw,
  actionDark: DET.whale,
  onAction: DET.snow, // brand exception, see onPrimary
  disabledBg: DET.swan,
  onDisabled: DET.hare,
  accent: DET.macaw,
  accentDark: DET.whale,
  onAccent: DET.snow, // brand exception (Macaw buttons)
  accentSoft: DET.iguana, // selected option fill (text on it: Eel)
  accentBorder: DET.macaw,
  link: DET.narwhal, // Humpback 4.6:1 on Polar, Narwhal 7.0:1
  // Streak / timer warning
  warn: DET.fox,
  warnDark: DET.guineaPig,
  warnText: DET.eel,
  streakBg: DET.canary,
  flameOff: DET.hare,
  favoriteBg: DET.canary,
  // Wrong / danger: Cardinal fills and borders; text stays Eel (Fire Ant on Walking Fish is 3.5:1).
  danger: DET.cardinal,
  dangerDark: DET.fireAnt,
  onDanger: DET.eel,
  dangerSoft: DET.walkingFish,
  dangerBorder: DET.cardinal,
  dangerText: DET.eel,
  missedBg: DET.walkingFish,
  // Gold / points / raids: Bee with its Camel edge.
  gold: DET.bee,
  goldEnd: DET.fox,
  goldDark: DET.camel,
  onGold: DET.mantaRay,
  goldGlow: tint("bee", 0.4),
  silver: DET.swan,
  bronze: DET.fox,
  levelOne: DET.swan,
  levelTwo: DET.seaSponge,
  levelThree: DET.iguana,
  onLevel: DET.eel,
  allTenFrom: DET.humpback,
  allTenTo: DET.narwhal,
  onAllTen: DET.snow, // ≥ 4.9:1 on both
  ringGood: DET.owl,
  ringMid: DET.fox,
  ringLow: DET.cardinal,
  slotEmpty: DET.polar,
  slotMark: DET.swan,
  silhouetteOpacity: "0.72", // black at .72 ≈ Eel
  silhouetteEdge: "transparent",
  overlay: tint("night", 0.8),
  scrim: tint("night", 0.45),
  shadow: tint("eel", 0.1),
  // Over the live camera: Night glass in both themes.
  cardGlass: tint("night", 0.9),
  onGlass: DET.snow,
  glassMuted: DET.swan,
  errorGlass: tint("night", 0.94),
  navBg: DET.snow,
  arStage: DET.night,
  qrBg: DET.snow,
  themeColor: DET.polar,
  confetti: DET_CONFETTI,
};

// Dark: our derivation (§1) — Night surfaces, the accent hexes unchanged, 15–20 % tints.
const DET_DARK: BrandColors = {
  ...DET_LIGHT,
  bg: DET.night,
  bgAlt: tint("owl", 0.16),
  surface: DET.nightSurface,
  surface2: tint("nightBorder", 0.35),
  border: DET.nightBorder,
  text: DET.nightText,
  muted: DET.hare,
  primaryText: DET.owl,
  disabledBg: DET.nightBorder,
  onDisabled: DET.wolf,
  primaryGlow: tint("owl", 0.2),
  primarySoft: tint("owl", 0.18),
  accentSoft: tint("macaw", 0.18),
  accentBorder: DET.macaw,
  link: DET.bluejay,
  warnText: DET.fox,
  streakBg: tint("fox", 0.16),
  flameOff: DET.nightBorder,
  favoriteBg: tint("bee", 0.12),
  onDanger: DET.nightText,
  dangerSoft: tint("cardinal", 0.16),
  dangerText: DET.flamingo,
  missedBg: tint("cardinal", 0.18),
  goldGlow: tint("bee", 0.35),
  silver: DET.hare,
  levelOne: DET.nightBorder,
  levelTwo: tint("owl", 0.2),
  levelThree: tint("macaw", 0.2),
  onLevel: DET.nightText,
  slotEmpty: DET.nightSurface,
  slotMark: DET.nightBorder,
  silhouetteOpacity: "1", // a dark shape on Night needs its edge to read
  silhouetteEdge: DET.wolf,
  overlay: tint("night", 0.7),
  scrim: tint("night", 0.6),
  shadow: tint("night", 0.5),
  navBg: DET.night,
  themeColor: DET.night,
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
  headlineFontFamily: 'GameDisplay, ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  preloadFonts: [],
  det10: {
    logo: { light: null, dark: null },
    lockupH: { light: null, dark: null },
    lockupV: { light: null, dark: null },
    pattern: { light: null, dark: null },
    seal: null,
    icons: {
      backpack: { light: null, dark: null },
      books: { light: null, dark: null },
      building: { light: null, dark: null },
      doorClosed: { light: null, dark: null },
      doorOpen: { light: null, dark: null },
      globe: { light: null, dark: null },
      key: { light: null, dark: null },
    },
  },
  jecrcLogo: { light: null, dark: null },
  jecrcMark: { light: null, dark: null },
  appIcon: null,
  heroes: { beaComputerDuo: null, duoInstitutions: null, beaCertificateDuo: null, linComputer: null, zariCertified: null, beaDuoSurfing: null, duoSeal: null },
  uiIcons: { test: null, practice: null, rules: null, overview: null, testSetup: null, cart: null, search: null, id: null, mail: null, microscope: null },
  emblems: { scallop: null, india: null },
  duo: {
    wave: null,
    joyous: null,
    heartEyes: null,
    coolGuy: null,
    sad: null,
    flee: null,
    dizzy: null,
    sleep: null,
    microphone: null,
    streak: null,
    nightOwl: null,
    det: null,
    trophy: null,
    pointer: null,
    welcome: null,
    placementTest: null,
  },
  sounds: { correct: null, wrong: null, levelup: null, found: null, tick: null },
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
  // The placeholder critters as 3D models (assets/models/lingo-<year>.glb).
  arMode: "model",
  lingoStandee: {},
  lingoColors: {},
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

/**
 * A kit file under /brand/<dir>/ whose name matches every pattern (case-insensitive), SVG preferred;
 * else null and the item is listed as pending. The kit's exact file names vary, so they're matched
 * by the names in docs/DET-DESIGN.md §4 (e.g. "det_10_lockup_h" + "green").
 */
function kit(item: string, dir: string, ...patterns: RegExp[]): string | null {
  const hit = [...FILES]
    .filter((f) => f.startsWith(`${dir}/`) && patterns.every((p) => p.test(f.slice(dir.length + 1))))
    .sort((x, y) => Number(!x.endsWith(".svg")) - Number(!y.endsWith(".svg")) || x.length - y.length)[0];
  if (hit) return `/brand/${hit}`;
  BRAND_PENDING.push(`${item} (expects assets/brand/${dir}/)`);
  return null;
}
const w = (word: string) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, "i");
const any = (...words: string[]) => new RegExp(words.join("|"), "i");

// Fonts (DET-DESIGN §2): the kit's OTF/TTF converted to WOFF2 by scripts/brand-fonts.py. Missing →
// Nunito (OFL, web/public/fonts), which the kit lists as the web fallback.
const font = (name: string) => (FILES.has(`fonts/${name}.woff2`) ? `/brand/fonts/${name}.woff2` : null);
const DIN = { light: font("din-light"), regular: font("din-regular"), medium: font("din-medium"), bold: font("din-bold") };
const FEATHER = font("feather-bold");
if (!DIN.regular || !DIN.bold) BRAND_PENDING.push("font DIN Next Rounded (expects assets/brand/fonts/*DIN*Regular/Bold*.otf) — Nunito used");
if (!FEATHER) BRAND_PENDING.push("font Feather Bold (expects assets/brand/fonts/*Feather*Bold*.otf) — Nunito ExtraBold used");
const NUNITO: FontFile[] = [
  { family: "Nunito", src: "/fonts/nunito-400.woff2", weight: "400" },
  { family: "Nunito", src: "/fonts/nunito-700.woff2", weight: "700" },
  { family: "Nunito", src: "/fonts/nunito-800.woff2", weight: "800" },
];
const SYSTEM = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const dinFiles: FontFile[] = (["light", "regular", "medium", "bold"] as const).flatMap((k, i) =>
  DIN[k] ? [{ family: "DIN Next Rounded", src: DIN[k]!, weight: String([300, 400, 500, 700][i]) }] : [],
);
const hasDin = Boolean(DIN.regular && DIN.bold);

/** Official Duo pose per Lingo, by posterIndex 0–9 (= lingo-2016 … lingo-2025, names below). */
export const LINGO_POSES = [
  "Duo_Straight_On_Grounded.svg", // 0 Rookie Duo
  "Duo_Detective.svg", // 1 Curious Duo
  "Duo_Skip.svg", // 2 Winking Duo
  "Duo_Wave.svg", // 3 Thumbs-Up Duo
  "Duo_Serious.svg", // 4 Fierce Duo
  "Duo_Heart.svg", // 5 Lovestruck Duo
  "Duo_Joyous.svg", // 6 Joyful Duo
  "duo_v2_books.svg", // 7 Bookworm Duo
  "duo_v2_sunglasses.svg", // 8 Cool Duo
  "Duo_Grad_Jump.svg", // 9 Champion Duo
] as const;

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
  // Each Lingo in a DET palette colour (display only — the stored colours stay as they are).
  lingoColors: {
    "lingo-2016": DET.owl,
    "lingo-2017": DET.macaw,
    "lingo-2018": DET.fox,
    "lingo-2019": DET.beetle,
    "lingo-2020": DET.cardinal,
    "lingo-2021": DET.bee,
    "lingo-2022": DET.humpback,
    "lingo-2023": DET.maskGreen,
    "lingo-2024": DET.betta,
    "lingo-2025": DET.narwhal,
  },
  // DET Juicy palette (docs/DET-DESIGN.md §1): named tokens → light + our dark derivation.
  themes: { light: DET_LIGHT, dark: DET_DARK },
  // DIN Next Rounded for all UI + body; uppercase DIN Bold buttons; Feather Bold headlines only.
  fontFamily: hasDin ? `"DIN Next Rounded", Nunito, ${SYSTEM}` : `Nunito, ${SYSTEM}`,
  displayFontFamily: hasDin ? `"DIN Next Rounded", Nunito, ${SYSTEM}` : `Nunito, ${SYSTEM}`,
  headlineFontFamily: FEATHER ? `"Feather Bold", Nunito, ${SYSTEM}` : `Nunito, ${SYSTEM}`,
  fontFiles: [...dinFiles, ...(FEATHER ? [{ family: "Feather Bold", src: FEATHER, weight: "700" }] : []), ...(hasDin ? [] : NUNITO)],
  // Only DIN Regular + Bold are preloaded (Nunito isn't: preloading delayed the first paint on 3G).
  preloadFonts: hasDin ? [DIN.regular!, DIN.bold!] : [],
  det10: {
    logo: { light: kit("DET 10 logo (green)", "det10", w("det_10_green")), dark: kit("DET 10 logo (white)", "det10", w("det_10_white")) },
    lockupH: { light: kit("DET 10 lockup horizontal (green)", "det10", /lockup_h/i, any("green", "black")), dark: kit("DET 10 lockup horizontal (white)", "det10", /lockup_h/i, /white/i) },
    lockupV: { light: kit("DET 10 lockup vertical (green)", "det10", /lockup_v/i, any("green", "black")), dark: kit("DET 10 lockup vertical (white)", "det10", /lockup_v/i, /white/i) },
    pattern: { light: kit("DET 10 pattern tile (light)", "det10", /pattern_tile_light/i), dark: kit("DET 10 pattern tile (dark)", "det10", /pattern_tile_dark/i) },
    seal: kit("DET 10 seal", "det10", /det_10_seal/i),
    icons: {
      backpack: { light: kit("DET 10 icon backpack (full)", "det10", /icon_full_backpack/i) ?? kit("DET 10 icon backpack (1c)", "det10", /icon_1c_backpack/i), dark: kit("DET 10 icon backpack (mono)", "det10", /icon_mono_backpack/i) },
      books: { light: kit("DET 10 icon books (full)", "det10", /icon_full_books/i) ?? kit("DET 10 icon books (1c)", "det10", /icon_1c_books/i), dark: kit("DET 10 icon books (mono)", "det10", /icon_mono_books/i) },
      building: { light: kit("DET 10 icon building (full)", "det10", /icon_full_building/i) ?? kit("DET 10 icon building (1c)", "det10", /icon_1c_building/i), dark: kit("DET 10 icon building (mono)", "det10", /icon_mono_building/i) },
      doorClosed: { light: kit("DET 10 icon door closed (full)", "det10", /icon_full_door_closed/i) ?? kit("DET 10 icon door closed (1c)", "det10", /icon_1c_door_closed/i), dark: kit("DET 10 icon door closed (mono)", "det10", /icon_mono_door_closed/i) },
      doorOpen: { light: kit("DET 10 icon door open (full)", "det10", /icon_full_door_open/i) ?? kit("DET 10 icon door open (1c)", "det10", /icon_1c_door_open/i), dark: kit("DET 10 icon door open (mono)", "det10", /icon_mono_door_open/i) },
      globe: { light: kit("DET 10 icon globe (full)", "det10", /icon_full_globe/i) ?? kit("DET 10 icon globe (1c)", "det10", /icon_1c_globe/i), dark: kit("DET 10 icon globe (mono)", "det10", /icon_mono_globe/i) },
      key: { light: kit("DET 10 icon key (full)", "det10", /icon_full_key/i) ?? kit("DET 10 icon key (1c)", "det10", /icon_1c_key/i), dark: kit("DET 10 icon key (mono)", "det10", /icon_mono_key/i) },
    },
  },
  jecrcLogo: { light: kit("JECRC logo (colour)", "jecrc", /^jecrc-logo\.(svg|png)$/i), dark: kit("JECRC logo (white)", "jecrc", /^jecrc-logo-white\.(svg|png)$/i) },
  jecrcMark: { light: kit("JECRC mark (colour)", "jecrc", /^jecrc-mark\.(svg|png)$/i), dark: kit("JECRC mark (white)", "jecrc", /^jecrc-mark-white\.(svg|png)$/i) },
  appIcon: kit("app icon (green DET emblem)", "logos", /GreenEmblem/i),
  heroes: {
    beaComputerDuo: kit("hero BeaComputerDuo", "hero", /bea_?computer_?duo/i),
    duoInstitutions: kit("hero DuoInstitutions", "hero", /duo_?institutions/i),
    beaCertificateDuo: kit("hero BeaCertificateDuo", "hero", /bea_?certificate/i),
    linComputer: kit("hero LinComputer", "hero", /lin_?computer/i),
    zariCertified: kit("hero Zari_certified", "hero", /zari/i),
    beaDuoSurfing: kit("hero bea duo surfing", "hero", /surfing/i),
    duoSeal: kit("hero Duo_seal", "hero", /duo_?seal/i),
  },
  uiIcons: {
    test: kit("UI icon Test", "ui-icons", /StatIcon_Test/i),
    practice: kit("UI icon Practice", "ui-icons", /practice/i),
    rules: kit("UI icon Rules", "ui-icons", /Icon_Rules/i),
    overview: kit("UI icon Overview", "ui-icons", /overview/i),
    testSetup: kit("UI icon TestSetup", "ui-icons", /test_?setup/i),
    cart: kit("UI icon Cart", "ui-icons", /StatIcon_Cart/i),
    search: kit("UI icon magnifying glass", "ui-icons", /magnif/i),
    id: kit("UI icon ID", "ui-icons", /^ID\.svg$/i),
    mail: kit("UI icon mail", "ui-icons", /mail/i),
    microscope: kit("UI icon microscope", "ui-icons", /microscope/i),
  },
  emblems: { scallop: kit("DET scallop", "emblems", /scallops\/ScallopTall_2\.svg$/i), india: kit("India flag emblem", "emblems", /FlagEmblem_India/i) },
  duo: {
    wave: kit("Duo_Wave", "mascots", /^Duo_Wave\./i),
    joyous: kit("Duo_Joyous", "mascots", /^Duo_Joyous\./i),
    heartEyes: kit("Duo_HeartEyes", "mascots", /^Duo_HeartEyes\./i),
    coolGuy: kit("Duo_CoolGuy", "mascots", /^Duo_CoolGuy\./i),
    sad: kit("Duo_Sad", "mascots", /^Duo_Sad\./i),
    flee: kit("Duo_Flee", "mascots", /^Duo_Flee\./i),
    dizzy: kit("Duo_dizzy", "mascots", /^Duo_dizzy\./i),
    sleep: kit("Duo_Sleep", "mascots", /^Duo_Sleep\./i),
    microphone: kit("Microphone_Duo", "mascots", /^Microphone_Duo\./i),
    streak: kit("Duo_streak_04", "mascots", /^Duo_streak_04\./i),
    nightOwl: kit("Duo_NightOwl", "mascots", /^Duo_NightOwl\./i),
    det: kit("img-duo-det", "mascots", /^img-duo-det\./i),
    trophy: kit("Duo_Trophy", "mascots", /^Duo_Trophy\./i),
    pointer: kit("Duo_Pointer", "mascots", /^Duo_Pointer\./i),
    welcome: kit("Duo_Welcome", "mascots", /^Duo_Welcome\./i),
    placementTest: kit("Duo_PlacementTest", "mascots", /^Duo_PlacementTest\./i),
  },
  sounds: {
    correct: kit("sound: correct", "sounds", any("correct", "right", "success")),
    wrong: kit("sound: wrong", "sounds", any("wrong", "incorrect", "error")),
    levelup: kit("sound: level up", "sounds", any("level", "complete")),
    found: kit("sound: found", "sounds", any("found", "appear", "pop")),
    tick: kit("sound: timer tick", "sounds", any("tick", "timer", "clock")),
  },
  logo: {
    full: kit("DET horizontal logo", "logos", /HorizontalGreenLogo-JuicyDET-.*Primary/i) ?? PLACEHOLDER.logo.full,
    mark: kit("favicon (green DET emblem)", "logos", /GreenEmblem/i) ?? PLACEHOLDER.logo.mark,
  },
  mascots: {
    // Duo poses from the kit: welcome = Duo_Wave, celebrate = Duo_Joyous, oops = Duo_dizzy.
    hero: kit("mascot: welcome (Duo_Wave)", "mascots", /^Duo_Wave\./i),
    celebrate: kit("mascot: celebrate (Duo_Joyous)", "mascots", /^Duo_Joyous\./i),
    oops: kit("mascot: oops (Duo_dizzy)", "mascots", /^Duo_dizzy\./i),
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
  // Each Lingo is an official Duo pose (assets/brand/mascots/), by posterIndex. A missing file falls
  // back to Duo_Wave, never to the placeholder critter.
  lingoArt: Object.fromEntries(
    LINGO_POSES.flatMap((file, i) => {
      const art = kit(`Lingo ${i} pose (${file})`, "mascots", new RegExp(`^${file.replace(/\./g, "\\.")}$`, "i"));
      const src = art ?? kit("mascot: welcome (Duo_Wave)", "mascots", /^Duo_Wave\./i);
      return src ? [[`lingo-${2016 + i}`, src]] : [];
    }),
  ),
  // AR: the pose as a paper standee on the poster (no 3D models in the official brand).
  arMode: "standee",
  lingoStandee: Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => `lingo-${2016 + i}`)
      .filter((id) => FILES.has(`standees/${id}.png`))
      .map((id) => [id, `/brand/standees/${id}.png`]),
  ),
};

export const BRAND: BrandSet = ACTIVE_BRAND === "official" ? OFFICIAL : PLACEHOLDER;

/** Display name for a Lingo: the brand's name if set, else the name stored in Firestore. */
export const lingoName = (lingo: { id: string; name: string }) => BRAND.lingoNames[lingo.id] ?? lingo.name;
