// Placeholder character art — an original round critter drawn in SVG. Used only while a brand
// illustration isn't supplied (BRAND.mascots / BRAND.lingoArt); it is not a brand character.

export type Mood = "happy" | "sad" | "wow" | "lost" | "camera" | "link" | "calm";

const FEATURES = [
  // round ears
  <g key="ears">
    <circle cx="33" cy="30" r="12" />
    <circle cx="87" cy="30" r="12" />
  </g>,
  // pointy ears
  <path key="pointy" d="M26 44 30 10l22 22zM94 44 90 10 68 32z" />,
  // antennae
  <g key="antennae" strokeWidth="5" strokeLinecap="round">
    <path d="M48 26 40 8M72 26l8-18" stroke="currentColor" fill="none" />
    <circle cx="39" cy="7" r="6" />
    <circle cx="81" cy="7" r="6" />
  </g>,
  // sprout
  <path key="sprout" d="M60 22c-2-8-10-14-20-13 1 9 9 15 20 13Zm0 0c2-8 10-14 20-13-1 9-9 15-20 13Z" />,
  // little horns
  <path key="horns" d="M38 28 34 10l14 12zM82 28l4-18-14 12z" />,
];

/**
 * @param color body colour (a Lingo's colour or a CSS var); `silhouette` draws a flat unknown shape.
 * @param variant 0–4 picks the head feature, so the ten placeholder Lingos don't look identical.
 */
export default function Critter({
  color,
  variant = 0,
  mood = "happy",
  silhouette = false,
  className,
}: {
  color: string;
  variant?: number;
  mood?: Mood;
  silhouette?: boolean;
  className?: string;
}) {
  const feature = FEATURES[((variant % FEATURES.length) + FEATURES.length) % FEATURES.length];
  const eyesClosed = mood === "calm";
  return (
    <svg className={className ? `critter ${className}` : "critter"} viewBox="0 0 120 124" aria-hidden="true" focusable="false">
      <ellipse className="critter-shadow" cx="60" cy="117" rx="32" ry="5" />
      <g style={{ color, fill: color }}>
        {feature}
        {/* feet + arms */}
        <ellipse cx="43" cy="108" rx="11" ry="7" />
        <ellipse cx="77" cy="108" rx="11" ry="7" />
        <ellipse cx="19" cy="72" rx="8" ry="12" transform="rotate(20 19 72)" />
        <ellipse cx="101" cy="72" rx="8" ry="12" transform="rotate(-20 101 72)" />
        <path d="M60 20c27 0 43 21 43 49s-16 43-43 43-43-15-43-43 16-49 43-49Z" />
      </g>
      {!silhouette && (
        <>
          <ellipse className="critter-belly" cx="60" cy="84" rx="25" ry="20" />
          <path className="critter-shine" d="M34 46c4-10 12-16 22-18" />
          <ellipse className="critter-cheek" cx="35" cy="72" rx="7" ry="4.5" />
          <ellipse className="critter-cheek" cx="85" cy="72" rx="7" ry="4.5" />
          {eyesClosed ? (
            <path className="critter-line" d="M40 60q7 6 14 0M66 60q7 6 14 0" />
          ) : (
            <>
              <ellipse className="critter-eye" cx="47" cy="58" rx="9.5" ry="11" />
              <ellipse className="critter-eye" cx="73" cy="58" rx="9.5" ry="11" />
              <circle className="critter-pupil" cx={mood === "lost" ? 45 : 49} cy={mood === "sad" ? 62 : 59} r="5.5" />
              <circle className="critter-pupil" cx={mood === "lost" ? 71 : 75} cy={mood === "sad" ? 62 : 59} r="5.5" />
              <circle className="critter-glint" cx={mood === "lost" ? 47 : 51} cy="56" r="2" />
              <circle className="critter-glint" cx={mood === "lost" ? 73 : 77} cy="56" r="2" />
            </>
          )}
          {mood === "wow" || mood === "camera" ? (
            <ellipse className="critter-mouth" cx="60" cy="78" rx="5" ry="6" />
          ) : mood === "sad" || mood === "lost" ? (
            <path className="critter-line" d="M52 81q8-7 16 0" />
          ) : (
            <path className="critter-mouth" d="M51 74q9 11 18 0z" />
          )}
        </>
      )}
    </svg>
  );
}
