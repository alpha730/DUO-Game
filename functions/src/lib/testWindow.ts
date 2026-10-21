import { TEST_WINDOW_GUARD_MS, TEST_WINDOW_MAX_MINUTES } from "../shared/types";

// Admin "Test window" (adminTestWindow): short test rounds before the event, on prod, with the real
// game rules. Pure (millis in, millis out) so it's unit-tested without Firestore.

export interface Span {
  startAt: number;
  endAt: number;
}
export interface WindowState {
  rounds: Span[];
  startAt: number;
  lockAt: number;
  locked: boolean;
  backup: { rounds: Span[]; startAt: number; lockAt: number } | null;
}
type Result = { state: WindowState } | { error: string; code: string };

const hhmm = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(11, 16); // IST
const byStart = (a: Span, b: Span) => a.startAt - b.startAt;

/** The real event rounds: the backup's, else the live list (no test window used yet). */
export const realRounds = (s: WindowState): Span[] => [...(s.backup?.rounds ?? s.rounds)].sort(byStart);

/** A test round running at `now` (never one of the real rounds). */
export function openTestWindow(s: WindowState, now: number): Span | null {
  const real = new Set(realRounds(s).map((r) => r.startAt));
  return s.rounds.find((r) => !real.has(r.startAt) && r.startAt <= now && now < r.endAt) ?? null;
}

/** Its round number, as playPeriod counts (rounds sorted by start). */
export const roundNumber = (s: WindowState, w: Span) => [...s.rounds].sort(byStart).findIndex((r) => r.startAt === w.startAt) + 1;

/**
 * "Open for N minutes": saves the real times on the first open (only if no backup yet), APPENDS a
 * round [now, now + N min] — the next round number, so a favourite's streak carries from window to
 * window — and opens the game around it. Refused on the event day: from 2 h before the first real
 * round until the last one ends (also when the window would run into that).
 */
export function openWindow(s: WindowState, now: number, minutes = 5): Result {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > TEST_WINDOW_MAX_MINUTES) {
    return { error: `Minutes must be a whole number, 1–${TEST_WINDOW_MAX_MINUTES}.`, code: "bad-minutes" };
  }
  const end = now + minutes * 60_000;
  const real = realRounds(s);
  if (real.length) {
    const guardFrom = real[0].startAt - TEST_WINDOW_GUARD_MS;
    const guardTo = real[real.length - 1].endAt;
    if (end > guardFrom && now < guardTo) {
      return {
        error: `No test windows on the event day: closed from ${hhmm(guardFrom)} IST (2 h before round 1) until the last round ends at ${hhmm(guardTo)} IST.`,
        code: "event-day",
      };
    }
  }
  if (openTestWindow(s, now)) return { error: "A test window is already open — close it first.", code: "already-open" };
  if (s.rounds.some((r) => r.startAt < end && now < r.endAt)) return { error: "That would overlap another round.", code: "overlap" };
  return {
    state: {
      rounds: [...s.rounds, { startAt: now, endAt: end }],
      startAt: Math.min(s.startAt, now),
      lockAt: Math.max(s.lockAt, end),
      locked: false,
      backup: s.backup ?? { rounds: s.rounds, startAt: s.startAt, lockAt: s.lockAt },
    },
  };
}

/** "Close now": the open test window ends at `now` (a real round is never touched). */
export function closeWindow(s: WindowState, now: number): Result {
  const w = openTestWindow(s, now);
  if (!w) return { error: "No test window is open.", code: "not-open" };
  return { state: { ...s, rounds: s.rounds.map((r) => (r === w ? { startAt: r.startAt, endAt: now } : r)) } };
}

/** "Back to event times": rounds, startAt and lockAt from the backup; the backup goes. */
export function restoreEvent(s: WindowState): Result {
  if (!s.backup) return { error: "The event times are already active.", code: "no-backup" };
  return { state: { ...s, rounds: s.backup.rounds, startAt: s.backup.startAt, lockAt: s.backup.lockAt, backup: null } };
}
