/** Seconds left + shrinking bar (turns orange under 5 s). */
export default function TimerBar({ leftMs, totalMs }: { leftMs: number; totalMs: number }) {
  const pct = totalMs ? (leftMs / totalMs) * 100 : 0;
  const seconds = Math.ceil(leftMs / 1000);
  return (
    <div className="timer" data-low={seconds <= 5} role="timer" aria-label={`${seconds} seconds left`}>
      <div className="timer-bar">
        <div className="timer-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="timer-seconds" data-seconds={seconds}>
        {seconds}s
      </span>
    </div>
  );
}
