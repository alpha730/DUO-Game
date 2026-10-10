import type { GetMyStateOutput } from "@shared/types";

export type CatchStatus =
  | { kind: "caughtToday"; favorite: boolean; favStreak: number }
  /** Both tries used today and not caught (failed or forfeit): closed until tomorrow (SPEC §2). */
  | { kind: "triedToday"; favorite: boolean; favStreak: number }
  /** Missed once today: one more try (doesn't use another of the daily 4). */
  | { kind: "retry"; favorite: boolean; favStreak: number; triesLeft: number }
  | { kind: "noAttempts"; favorite: boolean; favStreak: number }
  | { kind: "catch"; favorite: boolean; /** streak still alive (caught yesterday) */ favStreak: number };

/** `YYYY-MM-DD` minus one day (pure date math on the server's `today`). */
export function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Tries used today on this Lingo (failed or forfeit; a win closes it anyway). */
export function triesUsed(lingoId: string, state: GetMyStateOutput | null): number {
  const u = state?.user;
  if (!u || u.triedDate !== state!.today || !u.triedToday?.includes(lingoId)) return 0;
  return u.triesToday?.[lingoId] ?? 1;
}

/** Tries left today on this Lingo (2 a day). */
export function triesLeft(lingoId: string, state: GetMyStateOutput | null): number {
  return Math.max(0, (state?.triesPerLingo ?? 2) - triesUsed(lingoId, state));
}

/**
 * What the scan overlay offers for a Lingo (SPEC §8): 4 different Lingos a day, 2 tries each. Without state (e.g. getMyState failed) we
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
  if (triesUsed(lingoId, state) > 0) {
    const left = triesLeft(lingoId, state);
    return left > 0 ? { kind: "retry", favorite, favStreak, triesLeft: left } : { kind: "triedToday", favorite, favStreak };
  }
  if (state.attemptsLeft <= 0) return { kind: "noAttempts", favorite, favStreak };
  return { kind: "catch", favorite, favStreak };
}
