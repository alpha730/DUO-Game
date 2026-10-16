import type { Level } from "@shared/types";
import { BRAND } from "../config/brand";
import Critter, { type Mood } from "./Critter";

/**
 * A Lingo's 2D art: its official Duo pose (BRAND.lingoArt) or, in the placeholder brand only, the
 * critter in the Lingo's colour. `silhouette` = not caught yet (the same art as a dark shape).
 * `level` adds the level look on top of the art (no new art): Lv 1 plain, Lv 2 a thin green ring,
 * Lv 3 a gold ring + sparkle, MAX a gold scallop badge + glow. `favStreak` (days in a row as a
 * favourite) adds a little glow.
 */
export default function LingoArt({
  lingo,
  mood = "happy",
  silhouette = false,
  level = null,
  favStreak = 0,
  className = "",
}: {
  lingo: { id: string; color: string; posterIndex: number };
  mood?: Mood;
  silhouette?: boolean;
  level?: Level | null;
  favStreak?: number;
  className?: string;
}) {
  const src = BRAND.lingoArt[lingo.id];
  if (src) {
    const look = silhouette ? undefined : level ? String(level) : undefined;
    const glow = silhouette ? 0 : Math.min(Math.max(favStreak, 0), 5);
    const scallop = BRAND.emblems.scallop;
    return (
      <span
        className={`lingo-art lingo-pose ${silhouette ? "is-silhouette" : ""} ${className}`}
        data-level={look}
        data-glow={glow || undefined}
        style={{ "--fav-glow": glow / 5, ...(look === "MAX" && scallop ? { "--scallop": `url("${scallop}")` } : {}) } as React.CSSProperties}
      >
        <img src={src} alt="" draggable={false} loading="lazy" decoding="async" />
        {look === "3" && <i className="lingo-sparkle" aria-hidden="true" />}
        {look === "MAX" && (
          <i className="lingo-max" aria-hidden="true" data-shape={scallop ? "scallop" : undefined}>
            MAX
          </i>
        )}
      </span>
    );
  }
  return (
    <Critter
      className={`lingo-art ${className}`}
      color={silhouette ? "var(--slot-mark)" : lingo.color}
      variant={lingo.posterIndex}
      mood={mood}
      silhouette={silhouette}
    />
  );
}
