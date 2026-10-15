import type { Level } from "@shared/types";
import { BRAND } from "../config/brand";

/**
 * "Lv 2" / "MAX" badge. With the kit's DET emblems (docs/DET-DESIGN.md §4): the scallop frames MAX,
 * the emblem marks the levels; else the plain pill.
 */
export default function LevelBadge({ level }: { level: Level }) {
  const art = level === "MAX" ? BRAND.emblems.scallop : BRAND.emblems.emblem;
  return (
    <span className="level-badge" data-level={level} data-art={art ? "kit" : undefined}>
      {art && <img className="level-badge-art" src={art} alt="" aria-hidden="true" />}
      <span>{level === "MAX" ? "MAX" : `Lv ${level}`}</span>
    </span>
  );
}
