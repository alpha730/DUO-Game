import type { Campus } from "../shared/types";

/**
 * The real campuses (user, 2026-10-07: both have all 10 posters). Approximate centres; radius
 * DECISION: 500 m each — check on site and widen in /admin → Config if a poster spot fails.
 */
export const CAMPUSES: Campus[] = [
  { name: "JECRC Foundation", lat: 26.7838, lng: 75.8301, radiusM: 500 },
  { name: "JECRC University", lat: 26.7759236, lng: 75.8745013, radiusM: 500 },
];
