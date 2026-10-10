import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { ChallengeType, Level } from "@shared/types";
import { BRAND } from "../config/brand";
import { haptic, play } from "../lib/feedback";
import type { Lingo } from "../lib/lingos";
import type { Outcome } from "../screens/Catch";
import LingoArt from "./LingoArt";
import LingoPips from "./LingoPips";
import Mascot from "./Mascot";
import PrepCard from "./PrepCard";
import WinCelebration, { Confetti } from "./WinCelebration";

/** After a meaning / question try: the right answer and what it means (SPEC §9 — only after answering). */
function AnswerCard({ answer, won }: { answer: { text: string; explanation?: string }; won: boolean }) {
  return (
    <div className="answer-card" data-answer data-won={won}>
      <span className="answer-label">{won ? "✓ Correct answer" : "Correct answer"}</span>
      <strong className="answer-text">{answer.text}</strong>
      {answer.explanation && answer.explanation.toLowerCase() !== answer.text.toLowerCase() && (
        <span className="answer-explain">{answer.explanation}</span>
      )}
    </div>
  );
}

/** End of a try (PLAN 3.9): won / failed / forfeit (+ late, error) and Lingos left today. */
export default function Result({
  outcome,
  lingoName,
  lingo = null,
  type,
  heard,
  attemptsLeft,
  attemptsPerDay,
  prevLevel = null,
  raid = false,
  triesLeft = null,
  onRetry,
}: {
  outcome: Outcome;
  lingoName: string;
  lingo?: Lingo | null;
  type: ChallengeType | null;
  /** What speech recognition heard (voice challenges). */
  heard?: string;
  attemptsLeft: number | null;
  attemptsPerDay: number | null;
  /** Level of this Lingo before the try (null if never caught). */
  prevLevel?: Level | null;
  /** An Owl Raid try: one only, so no daily-Lingos line. */
  raid?: boolean;
  /** Tries left on this Lingo today (2 a day; null = unknown or raid). */
  triesLeft?: number | null;
  /** Start the second try at this Lingo. */
  onRetry?: () => void;
}) {
  const left = attemptsLeft ?? 0;
  const won = outcome.kind === "won";
  // A miss (wrong, forfeit, too late) with a try left on this Lingo → offer the second try.
  const canRetry = !raid && !won && outcome.kind !== "error" && (triesLeft ?? 0) > 0 && !!onRetry;

  // Sound + haptics once per result.
  useEffect(() => {
    if (outcome.kind === "won") {
      play("correct");
      haptic.win();
    } else if (outcome.kind !== "error") {
      if (outcome.kind !== "forfeit") play("wrong");
      haptic.fail();
    }
  }, [outcome.kind]);

  let title: string;
  let body: React.ReactNode = null;
  switch (outcome.kind) {
    case "won":
      title = `${lingoName} caught!`;
      body = (
        <>
          <WinCelebration data={outcome.data} lingoName={lingoName} lingo={lingo} prevLevel={prevLevel} />
          {outcome.data.answer && <AnswerCard answer={outcome.data.answer} won />}
          {!raid && <PrepCard oncePerDay />}
          {outcome.data.needsFavorites && (
            <Link className="btn accent" to="/favorites" data-needs-favorites>
              ⭐ Pick your 2 favourites
            </Link>
          )}
          <p className="muted result-note">
            {raid ? `${BRAND.raidName} won — great teamwork!` : "Nice one. Come back tomorrow to catch it again."}
          </p>
        </>
      );
      break;
    case "failed":
      title = "Not this time";
      body = (
        <>
          <p className="muted result-note">{lingoName} slipped away.</p>
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
            <p className="small muted result-note">We heard: “{heard || "nothing"}”</p>
          )}
          {(type === "meaning" || type === "question") && <p className="muted result-note">That wasn't the right answer.</p>}
          {outcome.data.answer && <AnswerCard answer={outcome.data.answer} won={false} />}
        </>
      );
      break;
    case "forfeit":
      title = "Chance lost";
      body = (
        <p className="muted result-note">
          You left the app during the challenge, so this {raid ? "raid try" : "try"} is gone — stay in the app until you answer!
        </p>
      );
      break;
    case "late":
      title = "Time was up";
      body = <p className="muted result-note">The answer arrived too late, so this chance is lost.</p>;
      break;
    case "error":
      title = "Something went wrong";
      body = <p className="muted result-note">{outcome.message}</p>;
      break;
  }

  // DET feedback bar: "Great job!" (green) / "Not quite" (red) / neutral for lost chances.
  const banner =
    outcome.kind === "won"
      ? "✓ Great job!"
      : outcome.kind === "failed"
        ? "✗ Not quite"
        : outcome.kind === "error"
          ? "Something went wrong"
          : "This try is closed";

  return (
    <section className="card stack result" data-outcome={outcome.kind} style={{ "--lingo": lingo?.color } as React.CSSProperties}>
      <p className="result-banner" data-kind={outcome.kind} role="status">
        {banner}
      </p>
      <div className="result-hero" aria-hidden="true">
        {won && <Confetti />}
        {lingo && outcome.kind !== "error" ? (
          <LingoArt lingo={lingo} mood={won ? "happy" : "sad"} className={won ? "react-win" : "react-fail"} />
        ) : (
          <Mascot slot={won ? "celebrate" : "oops"} mood={won ? "happy" : "sad"} />
        )}
      </div>
      <h2 className="result-title">{title}</h2>
      {body}
      {attemptsLeft !== null && attemptsPerDay !== null && (
        <div className="result-left">
          <LingoPips left={attemptsLeft} total={attemptsPerDay} className="attempts-left" />
        </div>
      )}
      {canRetry ? (
        // SPEC §2: 2 tries per Lingo per day — the second one is a new question and the same Lingo.
        <>
          <p className="next-step" data-retry-offer>
            <strong>
              {triesLeft === 1 ? "One more try" : `${triesLeft} more tries`} at {lingoName}
            </strong>
            <span>You'll get a new question. It doesn't use another {BRAND.creatureName} from today's {attemptsPerDay ?? 4}.</span>
          </p>
          <button className="btn big" onClick={onRetry} data-retry>
            Try again
          </button>
          <Link className="btn secondary" to="/scan">
            Scan another poster
          </Link>
        </>
      ) : (
        <>
          {!raid && !won && outcome.kind !== "error" && (
            // Both tries used: this Lingo is closed until tomorrow.
            <p className="next-step" data-closed-today>
              {left > 0 ? (
                <>
                  <strong>
                    Try another {BRAND.creatureName} — {left} left today
                  </strong>
                  <span>{lingoName} is closed for today.</span>
                </>
              ) : (
                <>
                  <strong>No {BRAND.creatureName}s left today</strong>
                  <span>{lingoName} is closed for today — come back tomorrow.</span>
                </>
              )}
            </p>
          )}
          <Link className="btn big" to="/scan">
            {won || left > 0 || raid ? "Scan another poster" : "Back to scanning"}
          </Link>
        </>
      )}
      <Link className="btn link" to="/home">
        Home
      </Link>
    </section>
  );
}
