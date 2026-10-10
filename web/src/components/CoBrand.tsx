import { BRAND } from "../config/brand";

/**
 * The DET × JECRC co-brand (login, Home header, splash): the official lockup when the Duolingo team
 * supplied it (BRAND.coBrandLockup), else the text "Duolingo English Test × JECRC".
 */
export default function CoBrand({ className = "" }: { className?: string }) {
  if (BRAND.coBrandLockup) {
    return <img className={`cobrand cobrand-img ${className}`} src={BRAND.coBrandLockup} alt={BRAND.coBrandText} />;
  }
  const [partner, ...rest] = BRAND.coBrandText.split(" × ");
  return (
    <span className={`cobrand ${className}`}>
      <span className="cobrand-partner">{partner}</span>
      {rest.length > 0 && (
        <>
          <span className="cobrand-x" aria-hidden="true">
            ×
          </span>
          <span className="cobrand-host">{rest.join(" × ")}</span>
        </>
      )}
    </span>
  );
}
