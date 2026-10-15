import { BRAND } from "../config/brand";
import { ThemedImg } from "./BrandArt";

/**
 * The DET × JECRC co-brand (Login, Home header, splash, About, share card):
 * 1. the official DET × JECRC lockup, when the Duolingo team supplied it;
 * 2. else the DET 10-Year horizontal lockup + "× JECRC";
 * 3. else the text "Duolingo English Test × JECRC".
 */
export default function CoBrand({ className = "" }: { className?: string }) {
  if (BRAND.coBrandLockup) {
    return <img className={`cobrand cobrand-img ${className}`} src={BRAND.coBrandLockup} alt={BRAND.coBrandText} />;
  }
  const [partner, ...rest] = BRAND.coBrandText.split(" × ");
  const host = rest.join(" × ");
  const lockup = BRAND.det10.lockupH;
  return (
    <span className={`cobrand ${className}`}>
      {lockup.light || lockup.dark ? (
        <ThemedImg art={lockup} alt={`${partner} · 10 years`} className="cobrand-img" />
      ) : (
        <span className="cobrand-partner">{partner}</span>
      )}
      {host && (
        <>
          <span className="cobrand-x" aria-hidden="true">
            ×
          </span>
          <span className="cobrand-host">{host}</span>
        </>
      )}
    </span>
  );
}
