import { describe, expect, it } from "vitest";
import { fastAnswerFlag, isSuspect } from "./cheat";

describe("fastAnswerFlag", () => {
  it("flags voice answers under 1.5 s and choice answers under 0.8 s", () => {
    expect(fastAnswerFlag("speak", 1499)).toMatch(/speak answered in 1499 ms/);
    expect(fastAnswerFlag("pronounce", 900)).not.toBeNull();
    expect(fastAnswerFlag("speak", 1500)).toBeNull();
    expect(fastAnswerFlag("meaning", 799)).not.toBeNull();
    expect(fastAnswerFlag("question", 300)).not.toBeNull();
    expect(fastAnswerFlag("question", 800)).toBeNull();
    expect(fastAnswerFlag("meaning", 1200)).toBeNull(); // fast for voice, fine for a tap
  });
});

describe("isSuspect", () => {
  it("needs ≥ 10 wins, ≥ 95 % accuracy and < 3 s average", () => {
    expect(isSuspect({ wins: 10, losses: 0, totalAnswerMs: 10 * 2900 })).toBe(true);
    expect(isSuspect({ wins: 19, losses: 1, totalAnswerMs: 19 * 2000 })).toBe(true); // exactly 95 %
    expect(isSuspect({ wins: 9, losses: 0, totalAnswerMs: 9 * 1000 })).toBe(false); // too few wins
    expect(isSuspect({ wins: 18, losses: 2, totalAnswerMs: 18 * 1000 })).toBe(false); // 90 %
    expect(isSuspect({ wins: 20, losses: 0, totalAnswerMs: 20 * 3000 })).toBe(false); // avg 3.0 s
    expect(isSuspect({ wins: 0, losses: 0, totalAnswerMs: 0 })).toBe(false);
  });
});
