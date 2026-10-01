import { describe, expect, it } from "vitest";
import { parseProfile } from "./completeProfile";

describe("parseProfile", () => {
  const ok = { name: "  Asha   Verma ", dept: "CSE", year: 2, roll: " 22ejccs001 " };

  it("normalises name and roll", () => {
    expect(parseProfile(ok)).toEqual({ name: "Asha Verma", dept: "CSE", year: 2, roll: "22EJCCS001" });
  });
  it("accepts year as a string", () => {
    expect(parseProfile({ ...ok, year: "3" }).year).toBe(3);
  });
  it("rejects bad input", () => {
    expect(() => parseProfile({ ...ok, name: "A" })).toThrow(/name/);
    expect(() => parseProfile({ ...ok, dept: "Law" })).toThrow(/department/);
    expect(() => parseProfile({ ...ok, year: 5 })).toThrow(/year/);
    expect(() => parseProfile({ ...ok, roll: "22/CS/1" })).toThrow(/roll/);
    expect(() => parseProfile({ ...ok, roll: "" })).toThrow(/roll/);
    expect(() => parseProfile(null)).toThrow();
  });
});
