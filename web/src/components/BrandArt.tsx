import { BRAND, type Det10Icon as Det10IconName, type HeroName, type Themed } from "../config/brand";
import type { Mood } from "./Critter";
import Mascot from "./Mascot";

/**
 * DET kit art (docs/DET-DESIGN.md §4), only ever the supplied files (brand.ts finds them in
 * assets/brand/). Each helper falls back to our own look while a file is missing.
 */

/** A kit image with light + dark versions: the right one shows for the current theme (CSS). */
export function ThemedImg({ art, alt, className = "", height }: { art: Themed; alt: string; className?: string; height?: number }) {
  if (!art.light && !art.dark) return null;
  const light = art.light ?? art.dark!;
  const dark = art.dark ?? art.light!;
  return (
    <>
      <img className={`themed-light ${className}`} src={light} alt={alt} height={height} />
      <img className={`themed-dark ${className}`} src={dark} alt="" aria-hidden="true" height={height} />
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
  if (src) return <img className={`hero-art ${className}`} src={src} alt="" />;
  return <Mascot slot={fallback} mood={mood} badge={badge} className={className} />;
}

/** A DET 10-Year icon (Dex, Me, empty states); else the given emoji. */
export function Det10Icon({ name, fallback, className = "" }: { name: Det10IconName; fallback?: string; className?: string }) {
  const src = BRAND.det10.icons[name];
  if (src) return <img className={`det10-icon ${className}`} src={src} alt="" />;
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
