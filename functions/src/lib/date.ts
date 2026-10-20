// IST has no daylight saving, so a fixed +05:30 offset is exact.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of `now` in Asia/Kolkata. */
export function istDate(now: Date | number = Date.now()): string {
  const ms = typeof now === "number" ? now : now.getTime();
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Adds whole days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** True if IST date `a` is the day before IST date `b`. */
export function isYesterday(a: string | null | undefined, b: string): boolean {
  return !!a && addDays(a, 1) === b;
}

// ---------------------------------------------------------------- one-day event: rounds as "days"
// With config/game.rounds set, every per-day key (attemptsDate, triedDate, wordsDate, lastCaughtDate,
// lastPlayDate, attempt.date) holds a ROUND key instead: "<IST date of round 1>#R<n>". The code that
// compares keys for equality needs no change; "yesterday" becomes "the previous round".

type Millis = { toMillis(): number };
export interface RoundsConfig {
  rounds?: { startAt: Millis; endAt: Millis }[] | null;
}

const ROUND_KEY = /^(\d{4}-\d{2}-\d{2})#R(\d+)$/;

/** A one-day-event round key ("2026-10-22#R2")? */
export const isRoundKey = (key: string | null | undefined) => !!key && ROUND_KEY.test(key);

export const roundKey = (firstRoundStart: number, n: number) => `${istDate(firstRoundStart)}#R${n}`;

export interface Period {
  /** The key to store/compare: a round key, or the IST date (multi-day game). */
  key: string;
  /** Round mode only: the current round (active) or the next / last one. */
  round: { n: number; of: number; startAt: number; endAt: number; active: boolean } | null;
}

/**
 * Where `now` falls. Multi-day game (no rounds): the IST date. One-day event: the active round, or —
 * before / between rounds — the NEXT round (so "tried this round" is empty and attempts are full), or
 * after the last one, the last round.
 */
export function playPeriod(now: number, config: RoundsConfig | null | undefined): Period {
  const rounds = (config?.rounds ?? []).map((r) => ({ startAt: r.startAt.toMillis(), endAt: r.endAt.toMillis() }));
  if (!rounds.length) return { key: istDate(now), round: null };
  rounds.sort((a, b) => a.startAt - b.startAt);
  const first = rounds[0].startAt;
  let i = rounds.findIndex((r) => now < r.endAt); // current or next
  if (i < 0) i = rounds.length - 1; // after the last round
  const r = rounds[i];
  return {
    key: roundKey(first, i + 1),
    round: { n: i + 1, of: rounds.length, startAt: r.startAt, endAt: r.endAt, active: now >= r.startAt && now < r.endAt },
  };
}

/** True if period key `a` comes right before `b`: the previous round, or the previous IST day. */
export function isPreviousPeriod(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const ra = ROUND_KEY.exec(a);
  const rb = ROUND_KEY.exec(b);
  if (ra || rb) return !!ra && !!rb && ra[1] === rb[1] && Number(ra[2]) + 1 === Number(rb[2]);
  return isYesterday(a, b);
}
