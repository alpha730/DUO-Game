import { Link } from "react-router-dom";
import type { CatchStatus } from "../lib/catchStatus";
import type { Lingo } from "../lib/lingos";

/** Bottom card shown while a poster is tracked (SPEC §8). */
export default function ScanOverlay({
  lingo,
  status,
  attemptsLeft,
  attemptsPerDay,
}: {
  lingo: Lingo;
  status: CatchStatus;
  attemptsLeft: number | null;
  attemptsPerDay: number | null;
}) {
  const streak = status.favorite && status.favStreak > 0 ? status.favStreak : 0;

  return (
    <section className="scan-card" aria-live="polite" data-kind={status.kind}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="swatch" style={{ background: lingo.color }} aria-hidden="true" />
          <div>
            <h2 style={{ margin: 0 }}>{lingo.name}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {lingo.detYear} · {lingo.rarity}
              {status.favorite && " · ⭐ favourite"}
            </p>
          </div>
        </div>
        {attemptsLeft !== null && attemptsPerDay !== null && (
          <span className="small muted" title="Attempts left today">
            {attemptsLeft}/{attemptsPerDay}
          </span>
        )}
      </div>

      {status.kind === "catch" && (
        <>
          {status.favorite && (
            <p className="streak">{streak > 0 ? `🔥 Day ${streak} — keep it going` : "🔥 Start your streak today"}</p>
          )}
          <Link className="btn" to={`/catch/${lingo.id}`}>
            Catch it
          </Link>
        </>
      )}

      {status.kind === "caughtToday" && (
        <p className="done">
          Caught today ✓ — come back tomorrow
          {streak > 0 && <span className="streak"> · 🔥 Day {streak}</span>}
        </p>
      )}

      {status.kind === "noAttempts" && <p className="done">No attempts left today — come back tomorrow</p>}
    </section>
  );
}
