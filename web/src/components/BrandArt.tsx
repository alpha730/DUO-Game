import { BRAND, type Det10Icon as Det10IconName, type DuoMood, type HeroName, type Themed } from "../config/brand";
import type { Mood } from "./Critter";
import { FlameIcon } from "./Icons";
import Mascot from "./Mascot";

/**
 * DET kit art (docs/DET-DESIGN.md §4), only ever the supplied files (brand.ts finds them in
 * assets/brand/). Illustrations load lazily (separate files, `loading="lazy"`); each helper falls
 * back to our own look if a file is missing.
 */

/** A kit image with light + dark versions: the right one shows for the current theme (CSS). */
export function ThemedImg({ art, alt, className = "", height, lazy = false }: { art: Themed; alt: string; className?: string; height?: number; lazy?: boolean }) {
  if (!art.light && !art.dark) return null;
  const light = art.light ?? art.dark!;
  const dark = art.dark ?? art.light!;
  const loading = lazy ? "lazy" : undefined;
  if (light === dark) return <img className={className} src={light} alt={alt} height={height} loading={loading} decoding="async" />;
  return (
    <>
      <img className={`themed-light ${className}`} src={light} alt={alt} height={height} loading={loading} decoding="async" />
      <img className={`themed-dark ${className}`} src={dark} alt="" aria-hidden="true" height={height} loading={loading} decoding="async" />
    </>
  );
}

/** A hero illustration (Login, About, empty states, practice card); else the mascot slot. */
export function HeroArt({
  name,
  fallback = "hero",
  mood = "happy",
  badge,
  className = "",
}: {
  name: HeroName;
  fallback?: keyof typeof BRAND.mascots;
  mood?: Mood;
  badge?: string;
  className?: string;
}) {
  const src = BRAND.heroes[name];
  if (src) return <img className={`hero-art ${className}`} src={src} alt="" loading="lazy" decoding="async" />;
  return <Mascot slot={fallback} mood={mood} badge={badge} className={className} />;
}

/** A Duo pose from the kit (Result, errors, no attempts left, welcome); else the mascot slot. */
export function DuoArt({ mood, fallback = "oops", className = "" }: { mood: DuoMood; fallback?: keyof typeof BRAND.mascots; className?: string }) {
  const src = BRAND.duo[mood];
  if (src) return <img className={`duo-art ${className}`} src={src} alt="" loading="lazy" decoding="async" data-duo={mood} />;
  return <Mascot slot={fallback} mood={mood === "sad" || mood === "flee" || mood === "dizzy" ? "sad" : "happy"} className={className} />;
}

/** The day-streak flame: the kit's flame Duo (Duo_streak_04), else our flame icon. Grey until today's first win. */
export function StreakFlame({ lit, size = 20, className = "" }: { lit: boolean; size?: number; className?: string }) {
  const src = BRAND.duo.streak;
  if (src) return <img className={`streak-duo ${className}`} src={src} alt="" aria-hidden="true" width={size} height={size} data-lit={lit} decoding="async" />;
  return <FlameIcon size={size} className={className} data-lit={lit} />;
}

/** The DET 10 seal (share card, MAX / all-10 celebrations). */
export function Det10Seal({ className = "" }: { className?: string }) {
  if (!BRAND.det10.seal) return null;
  return <img className={`det10-seal ${className}`} src={BRAND.det10.seal} alt="Duolingo English Test · 10 years" loading="lazy" decoding="async" />;
}

/** A DET 10-Year icon: full style in the light theme, mono in dark; else the given emoji (or nothing). */
export function Det10Icon({ name, fallback, className = "" }: { name: Det10IconName; fallback?: string; className?: string }) {
  const art = BRAND.det10.icons[name];
  if (art.light || art.dark) return <ThemedImg art={art} alt="" className={`det10-icon ${className}`} lazy />;
  if (!fallback) return null;
  return (
    <span className={`det10-icon det10-icon-fallback ${className}`} aria-hidden="true">
      {fallback}
    </span>
  );
}

/** The DET 10 pattern tile as a subtle background layer (light tile / dark tile per theme). */
export function PatternBg({ className = "" }: { className?: string }) {
  const { light, dark } = BRAND.det10.pattern;
  if (!light && !dark) return null;
  return (
    <span
      className={`pattern-bg ${className}`}
      aria-hidden="true"
      style={{ "--pattern-light": `url("${light ?? dark}")`, "--pattern-dark": `url("${dark ?? light}")` } as React.CSSProperties}
    />
  );
}
