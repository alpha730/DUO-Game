import type { Level } from "@shared/types";

/** "Lv 2" / "MAX" pill. */
export default function LevelBadge({ level }: { level: Level }) {
  return (
    <span className="level-badge" data-level={level}>
      {level === "MAX" ? "MAX" : `Lv ${level}`}
    </span>
  );
}
