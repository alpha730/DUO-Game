import { describe, expect, it } from "vitest";
import { campusCheck, distanceM, isOnCampus, isValidLatLng } from "./geo";

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
  const campus = [{ name: "A", lat: 26.78, lng: 75.82, radiusM: 500 }];
  it("accepts inside the radius", () => expect(isOnCampus(26.782, 75.82, campus)).toBe(true));
  it("rejects outside the radius", () => expect(isOnCampus(26.79, 75.82, campus)).toBe(false));
  it("rejects everyone when no campus is set", () => expect(isOnCampus(26.78, 75.82, [])).toBe(false));
});

describe("two campuses", () => {
  // ~5.5 km apart; each 500 m radius.
  const campuses = [
    { name: "A", lat: 26.78, lng: 75.82, radiusM: 500 },
    { name: "B", lat: 26.83, lng: 75.82, radiusM: 500 },
  ];
  it("accepts a player at either campus", () => {
    expect(campusCheck(26.781, 75.82, campuses, false)).toBe("on-campus");
    expect(campusCheck(26.831, 75.821, campuses, false)).toBe("on-campus");
  });
  it("refuses a player between them", () => {
    expect(campusCheck(26.805, 75.82, campuses, false)).toBe("off-campus");
  });
});

describe("campusCheck", () => {
  const campus = [{ name: "A", lat: 26.78, lng: 75.82, radiusM: 500 }];
  const home = [26.9124, 75.7873] as const; // Jaipur city centre, ~17 km away
  it("is on campus inside the radius in both modes", () => {
    expect(campusCheck(26.782, 75.82, campus, false)).toBe("on-campus");
    expect(campusCheck(26.782, 75.82, campus, true)).toBe("on-campus");
  });
  it("refuses off-campus in production", () => {
    expect(campusCheck(...home, campus, false)).toBe("off-campus");
  });
  it("only skips (with a warning) on the emulator", () => {
    expect(campusCheck(...home, campus, true)).toBe("skipped");
  });
});

describe("isValidLatLng", () => {
  it("validates", () => {
    expect(isValidLatLng(26.78, 75.82)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(NaN, 0)).toBe(false);
    expect(isValidLatLng("26", 75)).toBe(false);
  });
});
