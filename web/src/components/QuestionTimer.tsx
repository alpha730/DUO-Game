import { ClockIcon } from "./Icons";

/**
 * DET-style question timer: "0:12" with a clock, top right of the question card, plus a thin time
 * bar under the top bar. Only shows the time (SPEC §3.3: the server is the real timer).
 * Green → yellow → red; the last 5 s turn red and pulse (data-low).
 */
export function QuestionTimer({ leftMs }: { leftMs: number }) {
  const seconds = Math.max(0, Math.ceil(leftMs / 1000));
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span className="q-timer timer" data-low={seconds <= 5} role="timer" aria-label={`${seconds} seconds left for this question`}>
      <ClockIcon size={20} />
      <span className="timer-seconds" data-seconds={seconds}>
        {mm}:{ss}
      </span>
    </span>
  );
}

export function TimeBar({ leftMs, totalMs }: { leftMs: number; totalMs: number }) {
  const frac = totalMs ? Math.max(0, Math.min(1, leftMs / totalMs)) : 0;
  const color = frac > 0.5 ? "var(--ring-good)" : frac > 0.25 ? "var(--ring-mid)" : "var(--ring-low)";
  return (
    <div className="q-timebar" aria-hidden="true">
      <i style={{ width: `${frac * 100}%`, background: color }} />
    </div>
  );
}
