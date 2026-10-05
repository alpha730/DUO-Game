import { BRAND } from "../config/brand";
import Critter, { type Mood } from "./Critter";

/**
 * The mascot slot: the brand illustration when the Duolingo team supplied it (BRAND.mascots),
 * otherwise the placeholder critter in the primary colour with a mood (and a small badge icon).
 */
export default function Mascot({
  slot,
  mood = "happy",
  badge,
  className = "",
}: {
  slot: keyof typeof BRAND.mascots;
  mood?: Mood;
  /** Small emoji badge on the placeholder (e.g. 📶 for offline). */
  badge?: string;
  className?: string;
}) {
  const src = BRAND.mascots[slot];
  if (src) return <img className={`mascot ${className}`} src={src} alt="" />;
  return (
    <span className={`mascot mascot-placeholder ${className}`} data-mood={mood}>
      <Critter color="var(--primary)" variant={3} mood={mood} />
      {badge && (
        <span className="mascot-badge" aria-hidden="true">
          {badge}
        </span>
      )}
    </span>
  );
}
