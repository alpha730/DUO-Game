const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** True only inside the Firebase emulator (the env var is set by the emulator, never in production). */
export const isEmulator = () => process.env.FUNCTIONS_EMULATOR === "true";

/**
 * Campus location check (SPEC §2). DECISION (user request): on the emulators an off-campus player
 * is let through with a warning so the game can be played from home; in production it's refused.
 */
export function campusCheck(
  lat: number,
  lng: number,
  campus: { campusLat: number; campusLng: number; campusRadiusM: number },
  emulator: boolean,
): "on-campus" | "skipped" | "off-campus" {
  if (isOnCampus(lat, lng, campus)) return "on-campus";
  if (emulator) {
    const m = Math.round(distanceM(lat, lng, campus.campusLat, campus.campusLng));
    console.warn(`[emulator] off campus by ${m} m (radius ${campus.campusRadiusM} m) — check skipped; enforced in production`);
    return "skipped";
  }
  return "off-campus";
}

export function isOnCampus(
  lat: number,
  lng: number,
  campus: { campusLat: number; campusLng: number; campusRadiusM: number },
): boolean {
  return distanceM(lat, lng, campus.campusLat, campus.campusLng) <= campus.campusRadiusM;
}
