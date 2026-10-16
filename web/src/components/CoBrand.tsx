import { BRAND, type Themed } from "../config/brand";
import { ThemedImg } from "./BrandArt";

/**
 * The DET × JECRC lockup (DET-DESIGN §4), built from the two official logos side by side:
 *  - horizontal (full: Login, About; the splash + share card draw the same): DET 10 horizontal
 *    lockup | thin divider | × | JECRC logo. Under 360 px wide the JECRC shield replaces the full
 *    logo (CSS, see theme.css "lockup").
 *  - compact (Home / Setup / Rules / leaderboard headers): DET 10 lockup × JECRC shield.
 *  - white: the white artwork of both (on green or dark art).
 * The JECRC logo is never recoloured: colour on the light theme, its supplied white knockout on dark.
 * Without JECRC files: "JECRC" in Feather Bold. Without the DET 10 lockup: the partner's name.
 */
export default function CoBrand({
  variant = "horizontal",
  white = false,
  className = "",
}: {
  variant?: "horizontal" | "compact";
  white?: boolean;
  className?: string;
}) {
  if (BRAND.coBrandLockup) {
    return <img className={`cobrand cobrand-img ${className}`} src={BRAND.coBrandLockup} alt={BRAND.coBrandText} />;
  }
  const whiteOf = (a: Themed): Themed => (white ? { light: a.dark, dark: a.dark } : a);
  const det = whiteOf(BRAND.det10.lockupH);
  const logo = whiteOf(BRAND.jecrcLogo);
  const mark = whiteOf(BRAND.jecrcMark);
  const has = (a: Themed) => Boolean(a.light || a.dark);
  const [partner] = BRAND.coBrandText.split(" × ");
  const compact = variant === "compact";

  let jecrc: React.ReactNode;
  if (compact && has(mark)) {
    jecrc = <ThemedImg art={mark} alt="" className="lockup-jecrc-mark" />;
  } else if (has(logo)) {
    jecrc = (
      <>
        <span className="lockup-jecrc-full">
          <ThemedImg art={logo} alt="" className="lockup-jecrc-logo" lazy />
        </span>
        {has(mark) && (
          <span className="lockup-jecrc-small">
            <ThemedImg art={mark} alt="" className="lockup-jecrc-mark" lazy />
          </span>
        )}
      </>
    );
  } else {
    jecrc = <span className="lockup-jecrc">JECRC</span>;
  }

  return (
    <span
      className={`cobrand lockup ${className}`}
      data-variant={variant}
      data-white={white || undefined}
      data-jecrc={has(logo) || has(mark) ? "logo" : "text"}
      role="img"
      aria-label={`${partner} · 10 years × JECRC University`}
    >
      {has(det) ? <ThemedImg art={det} alt="" className="lockup-det" /> : <span className="cobrand-partner">{partner}</span>}
      <span className="lockup-x" aria-hidden="true">
        {!compact && <span className="lockup-divider" />}×
      </span>
      {jecrc}
    </span>
  );
}
