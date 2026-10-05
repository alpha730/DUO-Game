import { BRAND } from "../config/brand";
import Critter, { type Mood } from "./Critter";

/**
 * A Lingo's 2D art: the supplied brand illustration (BRAND.lingoArt) or the placeholder critter in
 * the Lingo's colour. `silhouette` = not caught yet (flat dark shape, no face).
 */
export default function LingoArt({
  lingo,
  mood = "happy",
  silhouette = false,
  className = "",
}: {
  lingo: { id: string; color: string; posterIndex: number };
  mood?: Mood;
  silhouette?: boolean;
  className?: string;
}) {
  const src = BRAND.lingoArt[lingo.id];
  if (src) {
    return <img className={`lingo-art ${silhouette ? "is-silhouette" : ""} ${className}`} src={src} alt="" draggable={false} />;
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
