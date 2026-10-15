import { BRAND } from "../config/brand";
import { ThemedImg } from "./BrandArt";

/**
 * The DET × JECRC lockup (DET-DESIGN §4; splash, Login, Home header, About, leaderboard, share card):
 * the official DET 10 lockup + a thin divider + "×" + the JECRC logo (assets/brand/jecrc/), or
 * "JECRC" set in Feather Bold when no JECRC logo was supplied.
 *  - horizontal: DET 10 horizontal lockup (green on light, white on dark)
 *  - compact: the same, smaller (Home header)
 *  - stacked: DET 10 stacked lockup above "× JECRC" (Login)
 *  - white: always the white artwork (on green or dark art, e.g. the share card)
 * Falls back to the text "Duolingo English Test × JECRC" if the DET 10 lockups aren't supplied.
 */
export default function CoBrand({
  variant = "horizontal",
  white = false,
  className = "",
}: {
  variant?: "horizontal" | "compact" | "stacked";
  white?: boolean;
  className?: string;
}) {
  if (BRAND.coBrandLockup) {
    return <img className={`cobrand cobrand-img ${className}`} src={BRAND.coBrandLockup} alt={BRAND.coBrandText} />;
  }
  const det = variant === "stacked" ? BRAND.det10.lockupV : BRAND.det10.lockupH;
  const detArt = white ? { light: det.dark, dark: det.dark } : det;
  const jecrcArt = white ? { light: BRAND.jecrcLogo.dark, dark: BRAND.jecrcLogo.dark } : BRAND.jecrcLogo;
  const hasDet = Boolean(det.light || det.dark);
  const [partner] = BRAND.coBrandText.split(" × ");
  const jecrc =
    jecrcArt.light || jecrcArt.dark ? (
      <ThemedImg art={jecrcArt} alt="JECRC" className="lockup-jecrc-img" />
    ) : (
      <span className="lockup-jecrc">JECRC</span>
    );
  return (
    <span
      className={`cobrand lockup ${className}`}
      data-variant={variant}
      data-white={white || undefined}
      role="img"
      aria-label={`${partner} · 10 years × JECRC`}
    >
      {hasDet ? <ThemedImg art={detArt} alt="" className="lockup-det" /> : <span className="cobrand-partner">{partner}</span>}
      <span className="lockup-x" aria-hidden="true">
        <span className="lockup-divider" />×
      </span>
      {jecrc}
    </span>
  );
}
