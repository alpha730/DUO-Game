import type { GetMyStateOutput } from "@shared/types";

export type CatchStatus =
  | { kind: "caughtToday"; favorite: boolean; favStreak: number }
  | { kind: "noAttempts"; favorite: boolean; favStreak: number }
  | { kind: "catch"; favorite: boolean; /** streak still alive (caught yesterday) */ favStreak: number };

/** `YYYY-MM-DD` minus one day (pure date math on the server's `today`). */
export function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/**
 * What the scan overlay offers for a Lingo (SPEC §8). Without state (e.g. getMyState failed) we
 * offer "Catch it" — the server enforces the real limits in startAttempt.
 */
export function catchStatus(lingoId: string, state: GetMyStateOutput | null): CatchStatus {
  if (!state) return { kind: "catch", favorite: false, favStreak: 0 };
  const c = state.catches.find((x) => x.lingoId === lingoId);
  const favorite = !!state.user?.favorites.includes(lingoId);
  const caughtToday = c?.lastCaughtDate === state.today;
  // A favourite's streak only counts as "going" if it was caught yesterday (or already today).
  const alive = !!c && (caughtToday || c.lastCaughtDate === dayBefore(state.today));
  const favStreak = favorite && alive ? c!.favStreak : 0;

  if (caughtToday) return { kind: "caughtToday", favorite, favStreak };
  if (state.attemptsLeft <= 0) return { kind: "noAttempts", favorite, favStreak };
  return { kind: "catch", favorite, favStreak };
}
