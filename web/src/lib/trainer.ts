import type { IstDate } from "@shared/types";
import { dayBefore } from "./catchStatus";

// DECISION (UI redesign): the player level in the HUD / Me is display-only — derived from points
// (Level n from (n − 1) × 500 points), nothing stored and no rule attached. SPEC has no player level.
export const POINTS_PER_LEVEL = 500;

export function playerLevel(points: number): { level: number; progress: number; toNext: number } {
  const p = Math.max(0, points);
  return {
    level: Math.floor(p / POINTS_PER_LEVEL) + 1,
    progress: (p % POINTS_PER_LEVEL) / POINTS_PER_LEVEL,
    toNext: POINTS_PER_LEVEL - (p % POINTS_PER_LEVEL),
  };
}

/**
 * Days in a row with a win, as it stands today: the stored dayStreak only counts while the last
 * winning day is today or yesterday (the server resets it at the next win). `lit` = won today.
 */
export function liveDayStreak(
  dayStreak: number | undefined,
  lastPlayDate: IstDate | null | undefined,
  today: IstDate | undefined,
): { days: number; lit: boolean } {
  if (!today || !lastPlayDate || !dayStreak) return { days: today ? 0 : (dayStreak ?? 0), lit: false };
  if (lastPlayDate === today) return { days: dayStreak, lit: true };
  return { days: lastPlayDate === dayBefore(today) ? dayStreak : 0, lit: false };
}

export const initial = (name: string | undefined) => (name?.trim()[0] ?? "?").toUpperCase();
export const fmt = (n: number) => n.toLocaleString("en-IN");
