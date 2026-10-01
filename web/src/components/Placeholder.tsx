import type { ReactNode } from "react";

/** Marks a part of a screen that a later PLAN day fills in. */
export default function Placeholder({ day, children }: { day: number; children: ReactNode }) {
  return (
    <div className="placeholder">
      <p className="small" style={{ margin: 0 }}>
        {children}
      </p>
      <p className="small" style={{ margin: "4px 0 0", opacity: 0.7 }}>
        Coming on day {day}
      </p>
    </div>
  );
}
