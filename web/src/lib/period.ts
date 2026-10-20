import type { RoundView } from "@shared/types";

/**
 * Wording for the play period: the one-day event says "this round" / "next round" where the
 * multi-day game said "today" / "tomorrow". `round` = GetMyStateOutput.round.
 */
export interface PeriodWords {
  /** "today" | "this round" */
  now: string;
  /** "come back tomorrow" | "come back next round" | "that was the last round" */
  comeBack: string;
  /** "day" | "round" */
  unit: string;
  /** "Day" | "Round" */
  Unit: string;
}

export function periodWords(round: RoundView | null | undefined): PeriodWords {
  if (!round) return { now: "today", comeBack: "come back tomorrow", unit: "day", Unit: "Day" };
  return {
    now: "this round",
    comeBack: round.n < round.of ? "come back next round" : "that was the last round",
    unit: "round",
    Unit: "Round",
  };
}

/** "10:30" in IST (the event runs on campus time). */
export const istTime = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16);

/** "Round 2 of 3 · until 14:00" / "Round 2 starts at 12:30" / null (multi-day game). */
export function roundLine(round: RoundView | null | undefined, now = Date.now()): string | null {
  if (!round) return null;
  if (round.active) return `Round ${round.n} of ${round.of} · until ${istTime(round.endAt)}`;
  if (now < round.startAt) return `Round ${round.n} starts at ${istTime(round.startAt)}`;
  return "All rounds are over";
}
