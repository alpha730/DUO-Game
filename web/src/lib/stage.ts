import type { StudentRow } from "@shared/types";

/**
 * The top `n` for the projector (/stage). After the lock, qualified players (both favourites at MAX)
 * come first — only they can win the top prizes (ONE-DAY-EVENT.md) — each group in leaderboard order.
 */
export function stageTop(rows: readonly StudentRow[], afterLock: boolean, n = 10): StudentRow[] {
  if (!afterLock) return rows.slice(0, n);
  const qualified = (r: StudentRow) => (r.favMax ?? 0) >= 2;
  return [...rows.filter(qualified), ...rows.filter((r) => !qualified(r))].slice(0, n);
}
