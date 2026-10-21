import { describe, expect, it } from "vitest";
import { playPeriod } from "./date";
import { closeWindow, demoView, openWindow, restoreEvent, testRounds, type WindowState } from "./testWindow";

const MIN = 60_000;
const ist = (s: string) => Date.parse(`${s}:00+05:30`);
// The real event: Oct 22, 11:30–12:30, 13:00–14:00, 14:30–15:30 IST → demos until 10:30.
const REAL = [
  { startAt: ist("2026-10-22T11:30"), endAt: ist("2026-10-22T12:30") },
  { startAt: ist("2026-10-22T13:00"), endAt: ist("2026-10-22T14:00") },
  { startAt: ist("2026-10-22T14:30"), endAt: ist("2026-10-22T15:30") },
];
const EVENT: WindowState = { rounds: REAL, startAt: REAL[0].startAt, lockAt: REAL[2].endAt, locked: true, backup: null };
const ok = (r: ReturnType<typeof openWindow>) => {
  if ("error" in r) throw new Error(r.error);
  return r.state;
};
const ts = (s: WindowState) => ({ rounds: s.rounds.map((r) => ({ startAt: { toMillis: () => r.startAt }, endAt: { toMillis: () => r.endAt } })) });
const now = ist("2026-10-21T14:00");
const DEMO = [
  { startAt: now, endAt: now + 5 * MIN },
  { startAt: now + 6 * MIN, endAt: now + 11 * MIN },
  { startAt: now + 12 * MIN, endAt: now + 17 * MIN },
];

describe("demo: one press → 3 rounds", () => {
  const s1 = ok(openWindow(EVENT, now));

  it("first open saves the real times, appends [now,+5] [+6,+11] [+12,+17], opens the game around them", () => {
    expect(s1.backup).toEqual({ rounds: REAL, startAt: REAL[0].startAt, lockAt: REAL[2].endAt });
    expect(s1.rounds).toEqual([...REAL, ...DEMO]);
    expect(s1.startAt).toBe(now); // min(startAt, now)
    expect(s1.lockAt).toBe(REAL[2].endAt); // max(lockAt, demo end)
    expect(s1.locked).toBe(false);
  });

  it("the card: round k of 3 while one runs, the next one in a gap, nothing after", () => {
    expect(demoView(s1, now + MIN)).toEqual({ open: { n: 1, k: 1, of: 3, ...DEMO[0] }, next: null });
    expect(demoView(s1, now + 5.5 * MIN)).toEqual({ open: null, next: { k: 2, of: 3, startAt: DEMO[1].startAt } });
    expect(demoView(s1, now + 7 * MIN).open).toMatchObject({ n: 2, k: 2, of: 3 });
    expect(demoView(s1, now + 13 * MIN).open).toMatchObject({ n: 3, k: 3, of: 3 });
    expect(demoView(s1, now + 18 * MIN)).toEqual({ open: null, next: null });
  });

  it("the demo rounds are rounds 1–3 in a row (a favourite's streak carries); the game is closed in the gaps", () => {
    for (const [i, t] of [now + MIN, now + 7 * MIN, now + 13 * MIN].entries()) {
      expect(playPeriod(t, ts(s1))).toMatchObject({ key: `2026-10-21#R${i + 1}`, round: { n: i + 1, active: true } });
    }
    expect(playPeriod(now + 5.5 * MIN, ts(s1)).round).toMatchObject({ n: 2, active: false });
    expect(playPeriod(now + 18 * MIN, ts(s1)).round).toMatchObject({ n: 4, active: false }); // next = the real round 1
  });

  it("lockAt grows when the demo ends after it", () => {
    const s = ok(openWindow({ ...EVENT, lockAt: now + 10 * MIN }, now));
    expect(s.lockAt).toBe(now + 17 * MIN);
  });

  it("refuses a second demo while one runs (also in a gap); a later demo keeps the backup and the old rounds", () => {
    expect(openWindow(s1, now + MIN)).toMatchObject({ code: "already-open" });
    expect(openWindow(s1, now + 5.5 * MIN)).toMatchObject({ code: "already-open" });
    const later = now + 30 * MIN;
    const s2 = ok(openWindow(s1, later));
    expect(s2.backup).toEqual(s1.backup);
    expect(s2.rounds).toHaveLength(9);
    expect(demoView(s2, later).open).toMatchObject({ n: 4, k: 1, of: 3 });
  });
});

describe("demo: close and restore", () => {
  const s1 = ok(openWindow(EVENT, now));

  it("close in round 1 ends it now and removes rounds 2 and 3", () => {
    const s = ok(closeWindow(s1, now + 2 * MIN));
    expect(testRounds(s)).toEqual([{ startAt: now, endAt: now + 2 * MIN }]);
    expect(s.rounds.slice(0, 3)).toEqual(REAL);
    expect(demoView(s, now + 3 * MIN)).toEqual({ open: null, next: null });
    expect(closeWindow(s, now + 3 * MIN)).toMatchObject({ code: "not-open" });
  });

  it("close in a gap removes the rounds not started yet", () => {
    const s = ok(closeWindow(s1, now + 5.5 * MIN));
    expect(testRounds(s)).toEqual([DEMO[0]]);
  });

  it("close in the last round just ends it", () => {
    const s = ok(closeWindow(s1, now + 14 * MIN));
    expect(testRounds(s)).toEqual([DEMO[0], DEMO[1], { startAt: DEMO[2].startAt, endAt: now + 14 * MIN }]);
  });

  it("close never touches a real round", () => {
    expect(closeWindow(EVENT, ist("2026-10-22T12:00"))).toMatchObject({ code: "not-open" });
  });

  it("restore puts back the real rounds, startAt and lockAt and drops the backup", () => {
    const r = ok(restoreEvent(ok(closeWindow(s1, now + MIN))));
    expect(r.rounds).toEqual(REAL);
    expect(r.startAt).toBe(REAL[0].startAt);
    expect(r.lockAt).toBe(REAL[2].endAt);
    expect(r.backup).toBeNull();
    expect(restoreEvent(r)).toMatchObject({ code: "no-backup" });
  });
});

describe("demo: refused on the event day", () => {
  it("from 1 h before round 1 (10:30) until the last round ends (15:30)", () => {
    for (const t of ["2026-10-22T10:30", "2026-10-22T11:29", "2026-10-22T12:45", "2026-10-22T15:29"]) {
      expect(openWindow(EVENT, ist(t)), t).toMatchObject({ code: "event-day" });
    }
    const msg = openWindow(EVENT, ist("2026-10-22T10:45"));
    expect("error" in msg && msg.error).toMatch(/demos end at 10:30 IST \(1 h before round 1\).*after 15:30 IST/);
  });
  it("also when the demo's 3 rounds would run past 10:30 (17 minutes)", () => {
    expect(openWindow(EVENT, ist("2026-10-22T10:14"))).toMatchObject({ code: "event-day" }); // ends 10:31
    expect(openWindow(EVENT, ist("2026-10-22T10:20"))).toMatchObject({ code: "event-day" }); // ends 10:37
    expect("state" in openWindow(EVENT, ist("2026-10-22T10:13"))).toBe(true); // ends 10:30
    expect("state" in openWindow(EVENT, ist("2026-10-22T09:00"))).toBe(true); // well before
  });
  it("uses the backup's rounds once demos are in use", () => {
    const s = ok(openWindow(EVENT, now));
    expect(openWindow(s, ist("2026-10-22T10:40"))).toMatchObject({ code: "event-day" });
  });
  it("allowed again after the last round", () => {
    expect("state" in openWindow(EVENT, ist("2026-10-22T15:31"))).toBe(true);
  });
});
