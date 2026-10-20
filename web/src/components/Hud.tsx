import { Link } from "react-router-dom";
import type { GetMyStateOutput } from "@shared/types";
import { useAuth } from "../lib/auth";
import { fmt, initial, liveDayStreak, playerLevel } from "../lib/trainer";
import { StreakFlame } from "./BrandArt";
import { periodWords, roundLine } from "../lib/period";
import { CoinIcon } from "./Icons";

/**
 * Top HUD on Home / Dex / Leaderboard: avatar + level, 🔥 day streak (grey until today's first win),
 * points, Lingos left today. Points and streak come from the live user doc; today + Lingos left from
 * the server's getMyState (the phone never decides what "today" is).
 */
export default function Hud({ state }: { state: GetMyStateOutput | null }) {
  const { profile } = useAuth();
  const points = profile?.points ?? state?.user?.points ?? 0;
  const { level } = playerLevel(points);
  const w = periodWords(state?.round);
  const round = roundLine(state?.round, state?.serverNow);
  const streak = liveDayStreak(profile?.dayStreak ?? state?.user?.dayStreak, profile?.lastPlayDate ?? state?.user?.lastPlayDate, state?.today);

  return (
    <>
    <header className="hud">
      <Link to="/me" className="hud-avatar" aria-label={`${profile?.name ?? "Me"}, level ${level}`}>
        <span className="avatar" aria-hidden="true">
          {initial(profile?.name)}
        </span>
        <span className="hud-level" aria-hidden="true">
          {level}
        </span>
      </Link>
      <span
        className="hud-chip hud-flame"
        data-lit={streak.lit}
        title={streak.lit ? `${w.Unit}s in a row with a catch` : `Catch a Lingo ${w.now} to keep your streak`}
        aria-label={`${streak.days} ${w.unit} streak${streak.lit ? "" : `, not yet ${w.now}`}`}
      >
        <StreakFlame lit={streak.lit} />
        <span>{streak.days}</span>
      </span>
      <span className="hud-chip hud-points" data-points={points} aria-label={`${fmt(points)} points`}>
        <CoinIcon />
        <span>{fmt(points)}</span>
      </span>
      {state && (
        <span
          className="hud-chip hud-left"
          data-left={state.attemptsLeft}
          aria-label={`Lingos left ${w.now}: ${state.attemptsLeft} of ${state.attemptsPerDay}`}
        >
          <span className="hud-left-label">Lingos left </span>
          <strong>
            {state.attemptsLeft}/{state.attemptsPerDay}
          </strong>
        </span>
      )}
    </header>
    {round && (
      <p className="hud-round" data-active={!!state?.round?.active}>
        {round}
      </p>
    )}
    </>
  );
}
