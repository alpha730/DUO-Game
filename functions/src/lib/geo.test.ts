import { describe, expect, it } from "vitest";
import { distanceM, isOnCampus, isValidLatLng } from "./geo";

describe("distanceM", () => {
  it("is 0 for the same point", () => {
    expect(distanceM(26.78, 75.82, 26.78, 75.82)).toBe(0);
  });
  it("is ~111.2 km per degree of latitude", () => {
    expect(distanceM(26, 75, 27, 75)).toBeCloseTo(111_195, -1);
  });
  it("matches a known short distance near Jaipur (~149 m)", () => {
    // 0.001° lat ≈ 111 m N, 0.001° lng ≈ 99 m E
    const d = distanceM(26.78, 75.82, 26.781, 75.821);
    expect(d).toBeGreaterThan(145);
    expect(d).toBeLessThan(155);
  });
});

describe("isOnCampus", () => {
  const campus = { campusLat: 26.78, campusLng: 75.82, campusRadiusM: 500 };
  it("accepts inside the radius", () => expect(isOnCampus(26.782, 75.82, campus)).toBe(true));
  it("rejects outside the radius", () => expect(isOnCampus(26.79, 75.82, campus)).toBe(false));
});

describe("isValidLatLng", () => {
  it("validates", () => {
    expect(isValidLatLng(26.78, 75.82)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(NaN, 0)).toBe(false);
    expect(isValidLatLng("26", 75)).toBe(false);
  });
});
