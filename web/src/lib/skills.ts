import type { ChallengeType } from "@shared/types";

/**
 * "Your skills" on Me: answered tries per skill, kept on this phone (per account). The server only
 * counts total wins/losses; it never sends past questions back (attempts are server-only), so the
 * Reading/Speaking split comes from the answers given on this phone. Display only — never scores.
 *   Reading  = Choose the Meaning + Fill in the Blanks (meaning, question)
 *   Speaking = Read Aloud (pronounce, speak)
 */
export type Skill = "reading" | "speaking";
export type SkillCounts = Record<Skill, { right: number; total: number }>;

const key = (uid: string) => `skills:${uid}`;
const empty = (): SkillCounts => ({ reading: { right: 0, total: 0 }, speaking: { right: 0, total: 0 } });

export const skillOf = (type: ChallengeType): Skill => (type === "pronounce" || type === "speak" ? "speaking" : "reading");

export function readSkills(uid: string | undefined): SkillCounts {
  if (!uid) return empty();
  try {
    const raw = JSON.parse(localStorage.getItem(key(uid)) ?? "null") as SkillCounts | null;
    return raw?.reading && raw?.speaking ? raw : empty();
  } catch {
    return empty();
  }
}

/** One answered try (won or failed; forfeits and late answers aren't answers). */
export function recordAnswer(uid: string | undefined, type: ChallengeType, right: boolean): void {
  if (!uid) return;
  const s = readSkills(uid);
  const k = skillOf(type);
  s[k] = { right: s[k].right + (right ? 1 : 0), total: s[k].total + 1 };
  try {
    localStorage.setItem(key(uid), JSON.stringify(s));
  } catch {
    // storage blocked: the panel just stays empty
  }
}
