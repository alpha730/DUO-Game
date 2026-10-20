import type { StudentRow, UserDoc } from "../shared/types";

export const BOARD_SIZE = 100;
/** Candidates read per refresh (SPEC §5): top 300 by points, then tie-broken in code. */
export const CANDIDATES = 300;

export type RankInput = Pick<UserDoc, "name" | "points" | "wins" | "losses" | "totalAnswerMs"> & {
  /** Favourites at MAX (0–2). */
  favMaxCount?: number;
  uid: string;
  /** millis; null if never scored */
  pointsReachedAt: number | null;
};

const accuracy = (u: RankInput) => (u.wins + u.losses > 0 ? u.wins / (u.wins + u.losses) : 0);
const avgAnswerMs = (u: RankInput) => (u.wins > 0 ? u.totalAnswerMs / u.wins : Number.POSITIVE_INFINITY);

const favMax = (u: RankInput) => u.favMaxCount ?? 0;

/** Both favourites at MAX: qualified to win (one-day event). */
export const QUALIFY_FAV_MAX = 2;
export const isQualified = (favMaxCount: number | undefined) => (favMaxCount ?? 0) >= QUALIFY_FAV_MAX;

/**
 * Leaderboard order (SPEC §2): points ↓ → favourites at MAX ↓ → accuracy ↓ → average answer time ↑
 * → reached the score first ↑ → uid (never a tie). The same order picks the top 20 for the final,
 * where qualified players (both favourites at MAX) come first. Pure.
 */
export function compareStudents(a: RankInput, b: RankInput): number {
  return (
    b.points - a.points ||
    favMax(b) - favMax(a) ||
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
      favMax: favMax(u),
    }));
}
