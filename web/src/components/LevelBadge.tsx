import type { Level } from "@shared/types";
import { BRAND } from "../config/brand";

/**
 * "Lv 2" / "MAX" badge in the DET scallop shape (the kit's scallop as a mask; MAX = gold), else the
 * plain pill.
 */
export default function LevelBadge({ level }: { level: Level }) {
  const scallop = BRAND.emblems.scallop;
  return (
    <span
      className="level-badge"
      data-level={level}
      data-shape={scallop ? "scallop" : undefined}
      style={scallop ? ({ "--scallop": `url("${scallop}")` } as React.CSSProperties) : undefined}
    >
      {level === "MAX" ? "MAX" : `Lv ${level}`}
    </span>
  );
}
