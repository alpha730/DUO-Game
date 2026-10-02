import { describe, expect, it } from "vitest";
import { speedBonus } from "./speed";

const start = 1_000_000;
const exp = (timer: number) => start + timer * 1000;

describe("speedBonus", () => {
  it("is the timer length when answered instantly", () => {
    expect(speedBonus(exp(20), start, 20)).toBe(20);
  });
  it("counts only full seconds left", () => {
    expect(speedBonus(exp(15), start + 4_001, 15)).toBe(10); // 10.999 s left
    expect(speedBonus(exp(15), start + 4_000, 15)).toBe(11);
  });
  it("is 0 in the last second and during the grace period", () => {
    expect(speedBonus(exp(15), exp(15) - 999, 15)).toBe(0);
    expect(speedBonus(exp(15), exp(15) + 1_500, 15)).toBe(0);
  });
  it("is clamped to the timer length (clock skew can't inflate it)", () => {
    expect(speedBonus(exp(15), start - 5_000, 15)).toBe(15);
  });
  it("scales with the per-second rule", () => {
    expect(speedBonus(exp(20), start + 10_000, 20, 2)).toBe(20);
  });
});
