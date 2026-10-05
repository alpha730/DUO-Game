import type { ReactNode } from "react";

const R = 46;
const C = 2 * Math.PI * R;

/**
 * Circular countdown around the Lingo (SPEC §3.3: the server is the real timer; this only shows it).
 * Colour shifts green → yellow → red; the last 5 s shake (data-low).
 */
export default function TimerRing({ leftMs, totalMs, children }: { leftMs: number; totalMs: number; children: ReactNode }) {
  const frac = totalMs ? Math.max(0, Math.min(1, leftMs / totalMs)) : 0;
  const seconds = Math.ceil(leftMs / 1000);
  const color = frac > 0.5 ? "var(--ring-good)" : frac > 0.25 ? "var(--ring-mid)" : "var(--ring-low)";
  return (
    <div className="timer-ring timer" data-low={seconds <= 5} role="timer" aria-label={`${seconds} seconds left`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="timer-ring-track" cx="50" cy="50" r={R} />
        <circle
          className="timer-ring-fill"
          cx="50"
          cy="50"
          r={R}
          style={{ stroke: color, strokeDasharray: C, strokeDashoffset: C * (1 - frac) }}
        />
      </svg>
      <div className="timer-ring-inner">{children}</div>
      <span className="timer-seconds" data-seconds={seconds} style={{ background: color }}>
        {seconds}s
      </span>
    </div>
  );
}
