import { DEMO_GAP_MINUTES, DEMO_ROUND_MINUTES, DEMO_ROUNDS, TEST_WINDOW_GUARD_MS } from "../shared/types";

// Admin "Test window" (adminTestWindow): a 3-round demo of the event before the event, on prod, with
// the real game rules. Pure (millis in, millis out) so it's unit-tested without Firestore.

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

const MIN = 60_000;
const hhmm = (ms: number) => new Date(ms + 330 * MIN).toISOString().slice(11, 16); // IST
const byStart = (a: Span, b: Span) => a.startAt - b.startAt;

/** The real event rounds: the backup's, else the live list (no demo used yet). */
export const realRounds = (s: WindowState): Span[] => [...(s.backup?.rounds ?? s.rounds)].sort(byStart);

/** The demo (test) rounds, in order: every round that isn't a real one. */
export function testRounds(s: WindowState): Span[] {
  const real = new Set(realRounds(s).map((r) => r.startAt));
  return s.rounds.filter((r) => !real.has(r.startAt)).sort(byStart);
}

/** The demo's rounds for `now`: [now, +5], [+6, +11], [+12, +17] (5 min each, 1-minute gaps). */
export function demoRounds(now: number): Span[] {
  return Array.from({ length: DEMO_ROUNDS }, (_, i) => {
    const startAt = now + i * (DEMO_ROUND_MINUTES + DEMO_GAP_MINUTES) * MIN;
    return { startAt, endAt: startAt + DEMO_ROUND_MINUTES * MIN };
  });
}

/** The test rounds split into demos: rounds no more than the demo gap apart belong together. */
function demos(s: WindowState): Span[][] {
  const out: Span[][] = [];
  for (const r of testRounds(s)) {
    const last = out.at(-1)?.at(-1);
    if (last && r.startAt - last.endAt <= DEMO_GAP_MINUTES * MIN) out.at(-1)!.push(r);
    else out.push([r]);
  }
  return out;
}

export interface DemoView {
  /** The demo round running now (k of `of`, n = its round number in config/game). */
  open: { n: number; k: number; of: number; startAt: number; endAt: number } | null;
  /** In a gap: the demo's next round. */
  next: { k: number; of: number; startAt: number } | null;
}

/** Where the demo is at `now`. */
export function demoView(s: WindowState, now: number): DemoView {
  const demo = demos(s).find((d) => d.at(-1)!.endAt > now);
  if (!demo) return { open: null, next: null };
  const k = demo.findIndex((r) => now < r.endAt);
  const r = demo[k];
  if (now >= r.startAt) return { open: { n: roundNumber(s, r), k: k + 1, of: demo.length, ...r }, next: null };
  return { open: null, next: { k: k + 1, of: demo.length, startAt: r.startAt } };
}

/** A round's number, as playPeriod counts (rounds sorted by start). */
export const roundNumber = (s: WindowState, w: Span) => [...s.rounds].sort(byStart).findIndex((r) => r.startAt === w.startAt) + 1;

/**
 * "Open demo (3 rounds)": saves the real times on the first open (only if no backup yet), APPENDS
 * the 3 demo rounds — the next round numbers, so a favourite caught in each goes Lv 1 → Lv 2 → MAX —
 * and opens the game around them. Refused on the event day: from 1 h before the first real round
 * until the last one ends (also when the demo's last round would run into that).
 */
export function openWindow(s: WindowState, now: number): Result {
  const add = demoRounds(now);
  const end = add.at(-1)!.endAt;
  const real = realRounds(s);
  if (real.length) {
    const guardFrom = real[0].startAt - TEST_WINDOW_GUARD_MS;
    const guardTo = real[real.length - 1].endAt;
    if (end > guardFrom && now < guardTo) {
      return {
        error: `No demo on the event day: demos end at ${hhmm(guardFrom)} IST (1 h before round 1) — the last demo round must finish by then. Open again after ${hhmm(guardTo)} IST.`,
        code: "event-day",
      };
    }
  }
  const v = demoView(s, now);
  if (v.open || v.next) return { error: "A demo is already running — close it first.", code: "already-open" };
  if (s.rounds.some((r) => r.startAt < end && now < r.endAt)) return { error: "That would overlap another round.", code: "overlap" };
  return {
    state: {
      rounds: [...s.rounds, ...add],
      startAt: Math.min(s.startAt, now),
      lockAt: Math.max(s.lockAt, end),
      locked: false,
      backup: s.backup ?? { rounds: s.rounds, startAt: s.startAt, lockAt: s.lockAt },
    },
  };
}

/** "Close now": the running demo round ends now and the demo rounds not started yet go (real rounds never). */
export function closeWindow(s: WindowState, now: number): Result {
  const test = new Set(testRounds(s));
  const running = s.rounds.find((r) => test.has(r) && r.startAt <= now && now < r.endAt);
  const later = s.rounds.filter((r) => test.has(r) && r.startAt > now);
  if (!running && !later.length) return { error: "No demo is running.", code: "not-open" };
  const rounds = s.rounds.filter((r) => !later.includes(r)).map((r) => (r === running ? { startAt: r.startAt, endAt: now } : r));
  return { state: { ...s, rounds } };
}

/** "Back to event times": rounds, startAt and lockAt from the backup; the backup goes. */
export function restoreEvent(s: WindowState): Result {
  if (!s.backup) return { error: "The event times are already active.", code: "no-backup" };
  return { state: { ...s, rounds: s.backup.rounds, startAt: s.backup.startAt, lockAt: s.backup.lockAt, backup: null } };
}
