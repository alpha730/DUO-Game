import { describe, expect, it } from "vitest";
import { playPeriod } from "./date";
import { closeWindow, openTestWindow, openWindow, restoreEvent, roundNumber, type WindowState } from "./testWindow";

const MIN = 60_000;
const ist = (s: string) => Date.parse(`${s}:00+05:30`);
// The real event: Oct 22, 10:00–11:30, 12:30–14:00, 15:00–16:00 IST.
const REAL = [
  { startAt: ist("2026-10-22T10:00"), endAt: ist("2026-10-22T11:30") },
  { startAt: ist("2026-10-22T12:30"), endAt: ist("2026-10-22T14:00") },
  { startAt: ist("2026-10-22T15:00"), endAt: ist("2026-10-22T16:00") },
];
const EVENT: WindowState = { rounds: REAL, startAt: REAL[0].startAt, lockAt: REAL[2].endAt, locked: true, backup: null };
const ok = (r: ReturnType<typeof openWindow>) => {
  if ("error" in r) throw new Error(r.error);
  return r.state;
};
const ts = (s: WindowState) => ({ rounds: s.rounds.map((r) => ({ startAt: { toMillis: () => r.startAt }, endAt: { toMillis: () => r.endAt } })) });

describe("test window: open (append)", () => {
  const now = ist("2026-10-21T14:00");
  const s1 = ok(openWindow(EVENT, now));

  it("first open saves the real times, appends [now, now + 5 min], opens the game around it", () => {
    expect(s1.backup).toEqual({ rounds: REAL, startAt: REAL[0].startAt, lockAt: REAL[2].endAt });
    expect(s1.rounds).toEqual([...REAL, { startAt: now, endAt: now + 5 * MIN }]);
    expect(s1.startAt).toBe(now); // min(startAt, now)
    expect(s1.lockAt).toBe(REAL[2].endAt); // max(lockAt, window end)
    expect(s1.locked).toBe(false);
    expect(openTestWindow(s1, now + MIN)).toEqual({ startAt: now, endAt: now + 5 * MIN });
  });

  it("the window is a round of its own; the game is closed between windows", () => {
    expect(playPeriod(now + MIN, ts(s1)).round).toMatchObject({ n: 1, active: true });
    const after = playPeriod(now + 6 * MIN, ts(s1)).round!;
    expect(after.active).toBe(false); // next = the real round 1 tomorrow → new tries refused
  });

  it("a second open keeps the backup, keeps the ended window and is the NEXT round number", () => {
    const later = now + 30 * MIN;
    const s2 = ok(openWindow(s1, later, 10));
    expect(s2.backup).toEqual(s1.backup); // only saved once
    expect(s2.rounds).toHaveLength(5);
    const w = openTestWindow(s2, later)!;
    expect(roundNumber(s2, w)).toBe(2);
    expect(playPeriod(later, ts(s2)).key).toBe("2026-10-21#R2"); // R1 → R2: a favourite's streak carries
  });

  it("lockAt grows when a window ends after it", () => {
    const s = ok(openWindow({ ...EVENT, lockAt: ist("2026-10-21T14:02") }, now));
    expect(s.lockAt).toBe(now + 5 * MIN);
  });

  it("refuses a second window while one is open, and bad minutes", () => {
    expect(openWindow(s1, now + MIN)).toMatchObject({ code: "already-open" });
    for (const m of [0, -1, 2.5, 61]) expect(openWindow(EVENT, now, m)).toMatchObject({ code: "bad-minutes" });
  });
});

describe("test window: close and restore", () => {
  const now = ist("2026-10-21T14:00");
  const s1 = ok(openWindow(EVENT, now));

  it("close ends the open window now; the earlier rounds stay", () => {
    const s = ok(closeWindow(s1, now + 2 * MIN));
    expect(s.rounds.at(-1)).toEqual({ startAt: now, endAt: now + 2 * MIN });
    expect(s.rounds.slice(0, 3)).toEqual(REAL);
    expect(openTestWindow(s, now + 3 * MIN)).toBeNull();
    expect(closeWindow(s, now + 3 * MIN)).toMatchObject({ code: "not-open" });
  });

  it("close never ends a real round", () => {
    expect(closeWindow(EVENT, ist("2026-10-22T10:30"))).toMatchObject({ code: "not-open" });
  });

  it("restore puts back the real rounds, startAt and lockAt and drops the backup", () => {
    const s2 = ok(openWindow(ok(closeWindow(s1, now + MIN)), now + 10 * MIN));
    const r = ok(restoreEvent(s2));
    expect(r.rounds).toEqual(REAL);
    expect(r.startAt).toBe(REAL[0].startAt);
    expect(r.lockAt).toBe(REAL[2].endAt);
    expect(r.backup).toBeNull();
    expect(restoreEvent(r)).toMatchObject({ code: "no-backup" });
  });
});

describe("test window: refused on the event day", () => {
  it("from 2 h before round 1 until the last round ends", () => {
    for (const t of ["2026-10-22T08:00", "2026-10-22T09:59", "2026-10-22T12:00", "2026-10-22T15:59"]) {
      expect(openWindow(EVENT, ist(t)), t).toMatchObject({ code: "event-day" });
    }
    const msg = openWindow(EVENT, ist("2026-10-22T09:00"));
    expect("error" in msg && msg.error).toMatch(/08:00 IST .* 16:00 IST/);
  });
  it("also when the window would run into that time", () => {
    expect(openWindow(EVENT, ist("2026-10-22T07:57"), 5)).toMatchObject({ code: "event-day" });
    expect("state" in openWindow(EVENT, ist("2026-10-22T07:50"), 5)).toBe(true);
  });
  it("uses the backup's rounds once testing (not the test windows)", () => {
    const s = ok(openWindow(EVENT, ist("2026-10-21T14:00")));
    expect(openWindow(s, ist("2026-10-22T09:00"))).toMatchObject({ code: "event-day" });
  });
  it("allowed again after the last round", () => {
    expect("state" in openWindow(EVENT, ist("2026-10-22T16:01"))).toBe(true);
  });
});
