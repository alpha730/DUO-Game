import { isVoiceChallenge, type ChallengeType, type UserDoc } from "../shared/types";

// Cheat signals (Day 8). They only FLAG a player for the admin to look at — they never block or
// change points: a fast, honest player must never lose anything because of them.

/** Faster than a human can read + say (voice) or read + tap (choice) after the challenge appears. */
export const FAST_VOICE_MS = 1500;
export const FAST_CHOICE_MS = 800;

/** Reason to flag an answer that arrived suspiciously soon after the attempt started, else null. */
export function fastAnswerFlag(type: ChallengeType, answerMs: number): string | null {
  const limit = isVoiceChallenge(type) ? FAST_VOICE_MS : FAST_CHOICE_MS;
  return answerMs < limit ? `${type} answered in ${answerMs} ms (< ${limit} ms)` : null;
}

export const SUSPECT_MIN_WINS = 10;
export const SUSPECT_MIN_ACCURACY = 0.95;
export const SUSPECT_MAX_AVG_MS = 3000;

/**
 * "Too good to be true": ≥ 10 wins, accuracy ≥ 95 % and an average answer under 3 s. Stored as
 * `users.suspect` (re-evaluated on every answered attempt) so the admin's list is one small query
 * instead of reading every user (cost rules).
 */
export function isSuspect(u: Pick<UserDoc, "wins" | "losses" | "totalAnswerMs">): boolean {
  const wins = u.wins ?? 0;
  const played = wins + (u.losses ?? 0);
  if (wins < SUSPECT_MIN_WINS || played === 0) return false;
  return wins / played >= SUSPECT_MIN_ACCURACY && (u.totalAnswerMs ?? 0) / wins < SUSPECT_MAX_AVG_MS;
}

/** Location jump (anti-cheat H): this far apart (the two JECRC campuses are ~4.5 km apart)… */
export const JUMP_M = 3000;
/** …within this time is faster than anyone gets from one campus to the other. */
export const JUMP_MS = 5 * 60_000;

/** Flag only: did the player's location jump ≥ 3 km in under 5 minutes since the last Start? Pure. */
export function locationJump(
  prev: { lat: number; lng: number; at: number } | null,
  next: { lat: number; lng: number; at: number },
  distance: (lat1: number, lng1: number, lat2: number, lng2: number) => number,
): boolean {
  if (!prev) return false;
  return next.at - prev.at < JUMP_MS && distance(prev.lat, prev.lng, next.lat, next.lng) >= JUMP_M;
}

export const VOICE_MIN_WINS = 5;
export const VOICE_FAST_MS = 2000;

/**
 * Read Aloud (anti-cheat G): "perfect transcript every time + always under 2 s" — a recording or
 * text injected into the speech API rather than a person. Flag only. Pure.
 */
export function voiceSignals(
  u: Pick<UserDoc, "voiceWins" | "voicePerfectFast">,
  win: { perfect: boolean; answerMs: number },
): { voiceWins: number; voicePerfectFast: number; voiceSuspect: boolean } {
  const voiceWins = (u.voiceWins ?? 0) + 1;
  const voicePerfectFast = (u.voicePerfectFast ?? 0) + (win.perfect && win.answerMs < VOICE_FAST_MS ? 1 : 0);
  return { voiceWins, voicePerfectFast, voiceSuspect: voiceWins >= VOICE_MIN_WINS && voicePerfectFast === voiceWins };
}
