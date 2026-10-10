import { useEffect } from "react";
import { BRAND } from "../config/brand";
import CoBrand from "./CoBrand";
import { CloseIcon } from "./Icons";

/** Me → About: DET's 10 years, the JECRC partnership, how the game works, the final on Oct 22. */
export default function AboutSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet about-sheet" role="dialog" aria-modal="true" aria-label={`About ${BRAND.appName}`} onClick={(e) => e.stopPropagation()} data-about>
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <CoBrand />
        <h2>About {BRAND.appName}</h2>
        <p>
          The {BRAND.partnerName} turns 10 — a decade of making English tests accessible to anyone, anywhere. To celebrate,
          the {BRAND.partnerName} and {BRAND.campusName} hid 10 posters across campus, one for each year from 2016 to 2025.
          Find a poster, scan it to meet its {BRAND.creatureName}, and catch it with a quick English question — Choose the
          Meaning, Fill in the Blanks or Read Aloud. Pick 2 favourites to build streaks, climb the leaderboard, and the top
          players meet in the final round on Oct 22.
        </p>
        <button className="btn" onClick={onClose}>
          Got it
        </button>
      </section>
    </div>
  );
}
