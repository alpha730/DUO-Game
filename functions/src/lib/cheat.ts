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
