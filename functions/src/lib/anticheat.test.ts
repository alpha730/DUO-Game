import { describe, expect, it } from "vitest";
import { originalChoice, publicChallenge, shuffledOrder } from "./challenge";
import { JUMP_M, JUMP_MS, locationJump, voiceSignals } from "./cheat";
import { emailKey, findDuplicates, nameKey } from "./duplicates";
import { distanceM } from "./geo";
import { CALLS_PER_MINUTE, nextCount, STARTS_PER_MINUTE } from "./rateLimit";

describe("B. per-attempt option order", () => {
  it("is a permutation of 0..3, and every order shows up", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const o = shuffledOrder(4);
      expect([...o].sort()).toEqual([0, 1, 2, 3]);
      seen.add(o.join(""));
    }
    expect(seen.size).toBe(24);
  });
  it("maps the shown position back to the stored option", () => {
    const ch = { type: "meaning" as const, word: "w", options: ["a", "b", "c", "d"] as [string, string, string, string], correctIndex: 2 as const };
    const order = [3, 2, 0, 1];
    const shown = publicChallenge(ch, order);
    expect(shown.options).toEqual(["d", "c", "a", "b"]);
    const pos = shown.options!.indexOf("c");
    expect(originalChoice(pos, order)).toBe(2);
    expect(originalChoice(undefined, order)).toBeUndefined();
    expect(originalChoice(1, undefined)).toBe(1); // old attempts without an order
    expect(JSON.stringify(shown)).not.toMatch(/correctIndex/);
  });
});

describe("E. rate-limit counter", () => {
  it(`allows ${CALLS_PER_MINUTE} calls and ${STARTS_PER_MINUTE} starts a minute, then refuses; a new minute resets`, () => {
    let c: ReturnType<typeof nextCount> | undefined;
    for (let i = 0; i < CALLS_PER_MINUTE; i++) c = nextCount(c ?? undefined, 5, false)!;
    expect(c!.calls).toBe(CALLS_PER_MINUTE);
    expect(nextCount(c!, 5, false)).toBeNull();
    expect(nextCount(c!, 6, false)).toEqual({ minute: 6, calls: 1, starts: 0 });
    let s: ReturnType<typeof nextCount> | undefined;
    for (let i = 0; i < STARTS_PER_MINUTE; i++) s = nextCount(s ?? undefined, 5, true)!;
    expect(nextCount(s!, 5, true)).toBeNull();
    expect(nextCount(s!, 5, false)).not.toBeNull(); // other calls still fine
  });
});

describe("H. location jumps", () => {
  const foundation = { lat: 26.7838, lng: 75.8301 };
  const university = { lat: 26.7759236, lng: 75.8745013 };
  it("the two campuses are ~4.5 km apart (over the 3 km jump distance)", () => {
    expect(distanceM(foundation.lat, foundation.lng, university.lat, university.lng)).toBeGreaterThan(JUMP_M);
  });
  it("flags campus → campus in under 5 minutes, not slower, not within one campus", () => {
    expect(locationJump({ ...foundation, at: 0 }, { ...university, at: JUMP_MS - 1 }, distanceM)).toBe(true);
    expect(locationJump({ ...foundation, at: 0 }, { ...university, at: JUMP_MS + 1 }, distanceM)).toBe(false);
    expect(locationJump({ ...foundation, at: 0 }, { lat: 26.785, lng: 75.831, at: 1000 }, distanceM)).toBe(false);
    expect(locationJump(null, { ...university, at: 0 }, distanceM)).toBe(false);
  });
});

describe("G. Read Aloud perfect + fast", () => {
  it("flags only when every one of ≥ 5 voice wins was perfect and under 2 s", () => {
    let u = {};
    for (let i = 0; i < 4; i++) u = voiceSignals(u, { perfect: true, answerMs: 1200 });
    expect(u).toMatchObject({ voiceWins: 4, voiceSuspect: false });
    u = voiceSignals(u, { perfect: true, answerMs: 1500 });
    expect(u).toMatchObject({ voiceWins: 5, voicePerfectFast: 5, voiceSuspect: true });
    expect(voiceSignals(u, { perfect: true, answerMs: 2500 }).voiceSuspect).toBe(false); // one slow → a person
    expect(voiceSignals(u, { perfect: false, answerMs: 900 }).voiceSuspect).toBe(false);
  });
});

describe("F. possible duplicate accounts", () => {
  it("normalises names and emails", () => {
    expect(nameKey("  Ásha  VERMA ")).toBe("asha verma");
    expect(nameKey("Verma Asha")).toBe("asha verma");
    expect(emailKey("Asha.Verma+2@gmail.com")).toBe("ashaverma");
    expect(emailKey("asha_verma22@yahoo.in")).toBe("ashaverma");
  });
  it("groups same name, spelling variants and similar emails; notes accounts made minutes apart", () => {
    const t = 1_700_000_000_000;
    const rows = findDuplicates([
      { uid: "a", name: "Rohan Gupta", email: "rohan.g@gmail.com", createdAt: t },
      { uid: "b", name: "rohan gupta", email: "x1@a.com", createdAt: t + 3 * 60_000 },
      { uid: "c", name: "Rohann Gupta", email: "x2@a.com", createdAt: t + 3 * 86_400_000 },
      { uid: "d", name: "Meera Iyer", email: "rohang22@yahoo.com", createdAt: null },
      { uid: "e", name: "Totally Different", email: "td@a.com", createdAt: t },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.uid, r]));
    expect(Object.keys(by).sort()).toEqual(["a", "b", "c", "d"]);
    expect(new Set(rows.map((r) => r.group)).size).toBe(1);
    expect(by.b.reason).toMatch(/same name/);
    expect(by.b.reason).toMatch(/created 3 min apart/);
    expect(by.c.reason).toMatch(/similar name/);
    expect(by.d.reason).toMatch(/similar email/);
  });
  it("short names don't match on spelling alone", () => {
    expect(findDuplicates([
      { uid: "a", name: "Ali", email: "p@a.com", createdAt: null },
      { uid: "b", name: "Avi", email: "q@a.com", createdAt: null },
    ])).toEqual([]);
  });
});
