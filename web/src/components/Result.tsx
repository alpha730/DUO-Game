import { Link } from "react-router-dom";
import type { ChallengeType, Level } from "@shared/types";
import { BRAND } from "../config/brand";
import type { Outcome } from "../screens/Catch";
import WinCelebration from "./WinCelebration";

/** End of an attempt (PLAN 3.9): won / failed / forfeit (+ late, error) and attempts left today. */
export default function Result({
  outcome,
  lingoName,
  type,
  heard,
  attemptsLeft,
  attemptsPerDay,
  onRetry,
  prevLevel = null,
  raid = false,
}: {
  outcome: Outcome;
  lingoName: string;
  type: ChallengeType | null;
  /** What speech recognition heard (voice challenges). */
  heard?: string;
  attemptsLeft: number | null;
  attemptsPerDay: number | null;
  onRetry: () => void;
  /** Level of this Lingo before the attempt (null if never caught). */
  prevLevel?: Level | null;
  /** An Owl Raid try: one only, so no retry and no daily-attempts line. */
  raid?: boolean;
}) {
  const left = attemptsLeft ?? 0;
  let icon: string;
  let title: string;
  let body: React.ReactNode = null;

  switch (outcome.kind) {
    case "won":
      icon = "🎉";
      title = `${lingoName} caught!`;
      body = (
        <>
          <WinCelebration data={outcome.data} lingoName={lingoName} prevLevel={prevLevel} />
          {outcome.data.needsFavorites && (
            <Link className="btn" to="/favorites" data-needs-favorites>
              ⭐ Pick your 2 favourites
            </Link>
          )}
          <p className="muted">
            {raid ? `${BRAND.raidName} won — great teamwork!` : "Nice one. Come back tomorrow to catch it again."}
          </p>
        </>
      );
      break;
    case "failed":
      icon = "😕";
      title = "Not this time";
      body = (
        <>
          {outcome.data.missedWords && outcome.data.missedWords.length > 0 && (
            <div className="missed">
              <p className="small muted" style={{ margin: 0 }}>
                Words we didn't catch:
              </p>
              <p style={{ margin: 0 }}>
                {outcome.data.missedWords.map((w) => (
                  <span key={w} className="missed-word">
                    {w}
                  </span>
                ))}
              </p>
            </div>
          )}
          {heard !== undefined && (type === "pronounce" || type === "speak") && (
            <p className="small muted">We heard: “{heard || "nothing"}”</p>
          )}
          {(type === "meaning" || type === "question") && <p className="muted">That wasn't the right answer.</p>}
        </>
      );
      break;
    case "forfeit":
      icon = "💨";
      title = "Chance lost";
      body = (
        <p className="muted">
          You left the app during the challenge, so this {raid ? "raid try" : "attempt"} is gone. One chance only!
        </p>
      );
      break;
    case "late":
      icon = "⏰";
      title = "Time was up";
      body = <p className="muted">The answer arrived too late, so this chance is lost.</p>;
      break;
    case "error":
      icon = "⚠️";
      title = "Something went wrong";
      body = <p className="muted">{outcome.message}</p>;
      break;
  }

  const canRetry = !raid && outcome.kind !== "won" && outcome.kind !== "error" && left > 0;
  return (
    <section className="card stack result" data-outcome={outcome.kind}>
      <div className="result-icon" aria-hidden="true">
        {icon}
      </div>
      <h2 style={{ margin: 0, textAlign: "center" }}>{title}</h2>
      {body}
      {attemptsLeft !== null && attemptsPerDay !== null && (
        <p className="attempts-left" data-left={attemptsLeft}>
          Attempts left today: <strong>{attemptsLeft}/{attemptsPerDay}</strong>
        </p>
      )}
      {canRetry && (
        <button className="btn" onClick={onRetry}>
          Try this {BRAND.creatureName} again
        </button>
      )}
      <Link className={canRetry ? "btn secondary" : "btn"} to="/scan">
        Scan another poster
      </Link>
      <Link className="btn link" to="/home">
        Home
      </Link>
    </section>
  );
}
