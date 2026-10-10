import { useEffect, useState } from "react";
import type { GetMyStateOutput } from "@shared/types";
import { ClockIcon } from "./Icons";

export type GamePhase = "before" | "open" | "over";

/** Where the game window is at server time `now` (the server's clock — never the phone's). */
export function gamePhase(me: Pick<GetMyStateOutput, "startAt" | "lockAt" | "locked"> | null, now: number): GamePhase {
  if (!me || me.startAt === null || me.lockAt === null) return "open"; // unknown: the server decides on Start
  if (me.locked || now >= me.lockAt) return "over";
  return now < me.startAt ? "before" : "open";
}

function left(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

/** Server time, ticking once a second (offsetMs = server − phone, from getMyState). */
export function useServerNow(offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    setNow(Date.now() + offsetMs);
    const t = setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => clearInterval(t);
  }, [offsetMs]);
  return now;
}

/** Home: "The hunt starts in …" before startAt, "The hunt is over" after the lock. Nothing while open. */
export default function GameClock({ phase, me, now }: { phase: GamePhase; me: GetMyStateOutput | null; now: number }) {
  if (phase === "open" || !me) return null;
  return (
    <section className="card game-clock" data-game-clock={phase} role="status">
      <ClockIcon />
      {phase === "before" ? (
        <div>
          <strong>The hunt starts in</strong>
          <span className="game-clock-time" data-countdown>
            {left((me.startAt ?? now) - now)}
          </span>
          <span className="small muted">Explore the rules and find the posters — catching opens at the start.</span>
        </div>
      ) : (
        <div>
          <strong>The hunt is over</strong>
          <span className="small muted">Thanks for playing! The top players meet in the final round.</span>
        </div>
      )}
    </section>
  );
}
