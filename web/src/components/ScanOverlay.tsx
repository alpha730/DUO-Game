import { BRAND, lingoName } from "../config/brand";
import type { Raid } from "../lib/raids";
import { Link } from "react-router-dom";
import type { CatchStatus } from "../lib/catchStatus";
import type { Lingo } from "../lib/lingos";

/** Bottom card shown while a poster is tracked (SPEC §8). */
export default function ScanOverlay({
  lingo,
  status,
  server,
  onRetryServer,
  attemptsLeft,
  attemptsPerDay,
  raid = null,
}: {
  lingo: Lingo;
  status: CatchStatus;
  /** getMyState: until it answers we can't tell which button is right. */
  server: "loading" | "ok" | "error";
  onRetryServer: () => void;
  attemptsLeft: number | null;
  attemptsPerDay: number | null;
  /** Live Owl Raid on this poster, if any. */
  raid?: Raid | null;
}) {
  const streak = status.favorite && status.favStreak > 0 ? status.favStreak : 0;
  const kind = server === "ok" ? status.kind : `server-${server}`;

  return (
    <section className="scan-card" aria-live="polite" data-kind={kind}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="swatch" style={{ background: lingo.color }} aria-hidden="true" />
          <div>
            <h2 style={{ margin: 0 }}>{lingoName(lingo)}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {lingo.detYear} · {lingo.rarity}
              {status.favorite && " · ⭐ favourite"}
            </p>
          </div>
        </div>
        {server === "ok" && attemptsLeft !== null && attemptsPerDay !== null && (
          <span className="small muted" title="Attempts left today">
            {attemptsLeft}/{attemptsPerDay}
          </span>
        )}
      </div>

      {raid && (
        <Link className="btn raid-join" to={`/raid/${raid.id}`} data-raid={raid.id}>
          🦉 Join the {BRAND.raidName}
        </Link>
      )}

      {server === "loading" && (
        <button className="btn" disabled>
          Checking…
        </button>
      )}

      {server === "error" && (
        <>
          <p className="done">Can't reach the game server right now.</p>
          <button className="btn secondary" onClick={onRetryServer}>
            Try again
          </button>
        </>
      )}

      {server === "ok" && status.kind === "catch" && (
        <>
          {status.favorite && (
            <p className="streak">{streak > 0 ? `🔥 Day ${streak} — keep it going` : "🔥 Start your streak today"}</p>
          )}
          <Link className="btn" to={`/catch/${lingo.id}`}>
            Catch it
          </Link>
        </>
      )}

      {server === "ok" && status.kind === "caughtToday" && (
        <p className="done">
          Caught today ✓ — come back tomorrow
          {streak > 0 && <span className="streak"> · 🔥 Day {streak}</span>}
        </p>
      )}

      {server === "ok" && status.kind === "noAttempts" && (
        <p className="done">No attempts left today — come back tomorrow</p>
      )}
    </section>
  );
}
