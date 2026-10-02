import { describe, expect, it } from "vitest";
import { parseProfile } from "./completeProfile";

describe("parseProfile", () => {
  it("trims and collapses spaces", () => {
    expect(parseProfile({ name: "  Asha   Verma " })).toEqual({ name: "Asha Verma" });
  });
  it("accepts 2 and 40 characters", () => {
    expect(parseProfile({ name: "Al" }).name).toBe("Al");
    expect(parseProfile({ name: "x".repeat(40) }).name).toHaveLength(40);
  });
  it("rejects too short, too long, missing", () => {
    expect(() => parseProfile({ name: "A" })).toThrow(/name/);
    expect(() => parseProfile({ name: "   A   " })).toThrow(/name/);
    expect(() => parseProfile({ name: "x".repeat(41) })).toThrow(/name/);
    expect(() => parseProfile({})).toThrow(/name/);
    expect(() => parseProfile(null)).toThrow(/name/);
  });
  it("ignores any extra fields (no dept/year/roll)", () => {
    expect(parseProfile({ name: "Asha", dept: "CSE", roll: "22X" })).toEqual({ name: "Asha" });
  });
});
