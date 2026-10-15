import { useEffect, useState } from "react";
import { BRAND } from "../config/brand";
import { HeroArt } from "./BrandArt";

const SEEN_KEY = "prepCardDay";
const localDay = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, this phone's day (display only)

function seenToday(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === localDay();
  } catch {
    return false; // no storage: just show it
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, localDay());
  } catch {
    // no storage
  }
}

/**
 * "Get ready for the real DET": links to the official free practice test (new tab). Always on Me;
 * after a win at most once a day (`oncePerDay`). Hidden when the brand has no practice link.
 */
export default function PrepCard({ oncePerDay = false }: { oncePerDay?: boolean }) {
  // Decided once on mount (read only), marked as seen afterwards — no side effect while rendering.
  const [show] = useState(() => !!BRAND.practiceUrl && (!oncePerDay || !seenToday()));
  useEffect(() => {
    if (show && oncePerDay) markSeen();
  }, [show, oncePerDay]);
  if (!show || !BRAND.practiceUrl) return null;
  return (
    <section className="prep-card" data-prep>
      <HeroArt name="duoSeal" className="prep-art" />
      <div>
        <h3>Get ready for the real {BRAND.examShortName}</h3>
        <p className="muted">Try the free official practice test — same question types, real timing.</p>
      </div>
      <a className="btn secondary" href={BRAND.practiceUrl} target="_blank" rel="noopener noreferrer">
        {BRAND.uiIcons.practice && <img className="btn-kit-icon" src={BRAND.uiIcons.practice} alt="" aria-hidden="true" loading="lazy" />}
        Practice free ↗
      </a>
    </section>
  );
}
