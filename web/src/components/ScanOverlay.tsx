import { Link } from "react-router-dom";
import type { Level } from "@shared/types";
import { BRAND, lingoName } from "../config/brand";
import type { CatchStatus } from "../lib/catchStatus";
import type { Lingo } from "../lib/lingos";
import type { Raid } from "../lib/raids";
import LevelBadge from "./LevelBadge";
import LingoArt from "./LingoArt";
import { Det10Icon, DuoArt } from "./BrandArt";

/** Dex categories → DET 10 icons. */
const RARITY_ICON = { common: "books", rare: "globe", epic: "key", legendary: "doorOpen" } as const;

/** Bottom sheet shown while a poster is tracked (SPEC §8): who it is + Catch it / why not today. */
export default function ScanOverlay({
  lingo,
  level = null,
  status,
  server,
  onRetryServer,
  attemptsLeft,
  attemptsPerDay,
  raid = null,
}: {
  lingo: Lingo;
  /** This Lingo's level if the player has caught it before. */
  level?: Level | null;
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
    <section className="scan-card" aria-live="polite" data-kind={kind} style={{ "--lingo": lingo.color } as React.CSSProperties}>
      <div className="scan-card-head">
        {BRAND.lingoArt[lingo.id] ? (
          <span className="scan-card-pose" aria-hidden="true">
            <LingoArt lingo={lingo} level={level} favStreak={streak} />
          </span>
        ) : (
          <span className="scan-card-dot" aria-hidden="true" />
        )}
        <div className="scan-card-title">
          <span className="scan-card-kicker">You found a {BRAND.creatureName}!</span>
          <h2>{lingoName(lingo)}</h2>
          <p className="scan-card-meta">
            <span>{lingo.detYear}</span>
            <span className="dex-rarity">
              <Det10Icon name={RARITY_ICON[lingo.rarity]} className="chip-icon" />
              {lingo.rarity}
            </span>
            {level ? <LevelBadge level={level} /> : <span className="scan-new">New!</span>}
            {status.favorite && <span className="scan-fav">⭐ Favourite</span>}
          </p>
        </div>
        {server === "ok" && attemptsLeft !== null && attemptsPerDay !== null && (
          <span className="scan-card-left" title="Lingos left today">
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
        <button className="btn big" disabled>
          Checking…
        </button>
      )}

      {server === "error" && (
        <>
          <p className="done">📶 Can't reach the game server right now.</p>
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
          <Link className="btn big catch-it" to={`/catch/${lingo.id}`}>
            Catch it!
          </Link>
        </>
      )}

      {server === "ok" && status.kind === "retry" && (
        <>
          <p className="streak" data-retry>
            Missed it earlier — {status.triesLeft === 1 ? "1 more try" : `${status.triesLeft} more tries`} today
          </p>
          <Link className="btn big catch-it" to={`/catch/${lingo.id}`}>
            Try again!
          </Link>
        </>
      )}

      {server === "ok" && status.kind === "caughtToday" && (
        <p className="done" data-closed>
          Caught today ✓ — come back tomorrow
          {streak > 0 && <span className="streak"> · 🔥 Day {streak}</span>}
        </p>
      )}

      {server === "ok" && status.kind === "triedToday" && (
        <p className="done" data-closed>
          Both tries used today ✗ — back tomorrow
        </p>
      )}

      {server === "ok" && status.kind === "noAttempts" && (
        <div className="done done-sleep" data-closed>
          <DuoArt mood={BRAND.duo.nightOwl ? "nightOwl" : "sleep"} className="sleep-art" />
          <strong>No Lingos left today</strong>
          <span className="small">You've tried {attemptsPerDay ?? 4} Lingos today — come back tomorrow</span>
        </div>
      )}
    </section>
  );
}
