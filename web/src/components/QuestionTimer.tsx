import { ClockIcon } from "./Icons";

/**
 * DET test header timer (DET-DESIGN §3): "⏱ 0:20 for this question" — clock icon, bold time, label.
 * Only shows the time (SPEC §3.3: the server is the real timer). Half the time gone → Fox clock;
 * the last 5 s → Cardinal clock on a Walking Fish pill (data-low). No bar, no colours elsewhere:
 * the question itself stays calm.
 */
export function QuestionTimer({ leftMs, totalMs, label = "for this question" }: { leftMs: number; totalMs: number; label?: string }) {
  const seconds = Math.max(0, Math.ceil(leftMs / 1000));
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  const phase = seconds <= 5 ? "low" : totalMs && leftMs / totalMs <= 0.5 ? "mid" : "ok";
  return (
    <span className="q-timer timer" data-low={seconds <= 5} data-phase={phase} role="timer" aria-label={`${seconds} seconds left ${label}`}>
      <ClockIcon size={20} />
      <strong className="timer-seconds" data-seconds={seconds}>
        {mm}:{ss}
      </strong>
      <span className="timer-label">{label}</span>
    </span>
  );
}
