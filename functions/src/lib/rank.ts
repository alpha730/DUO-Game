import type { StudentRow, UserDoc } from "../shared/types";

export const BOARD_SIZE = 100;
/** Candidates read per refresh (SPEC §5): top 300 by points, then tie-broken in code. */
export const CANDIDATES = 300;

export type RankInput = Pick<UserDoc, "name" | "points" | "wins" | "losses" | "totalAnswerMs"> & {
  uid: string;
  /** millis; null if never scored */
  pointsReachedAt: number | null;
};

const accuracy = (u: RankInput) => (u.wins + u.losses > 0 ? u.wins / (u.wins + u.losses) : 0);
const avgAnswerMs = (u: RankInput) => (u.wins > 0 ? u.totalAnswerMs / u.wins : Number.POSITIVE_INFINITY);

/**
 * Leaderboard order (SPEC §2): points ↓ → accuracy ↓ → average answer time ↑ → reached the
 * score first ↑. The same order picks the top 20 for the final. Pure.
 */
export function compareStudents(a: RankInput, b: RankInput): number {
  return (
    b.points - a.points ||
    accuracy(b) - accuracy(a) ||
    avgAnswerMs(a) - avgAnswerMs(b) ||
    (a.pointsReachedAt ?? Number.POSITIVE_INFINITY) - (b.pointsReachedAt ?? Number.POSITIVE_INFINITY) ||
    a.uid.localeCompare(b.uid) // fully deterministic
  );
}

/** Sorted top `size` rows for leaderboard/students. Players with 0 points aren't listed. */
export function rankStudents(users: RankInput[], size = BOARD_SIZE): StudentRow[] {
  return users
    .filter((u) => u.points > 0)
    .sort((a, b) => {
      const c = compareStudents(a, b);
      return Number.isNaN(c) ? 0 : c; // Infinity − Infinity (no wins on either side)
    })
    .slice(0, size)
    .map((u) => ({
      uid: u.uid,
      name: u.name,
      points: u.points,
      accuracy: Math.round(accuracy(u) * 1000) / 1000,
      avgAnswerMs: u.wins > 0 ? Math.round(u.totalAnswerMs / u.wins) : 0,
    }));
}
