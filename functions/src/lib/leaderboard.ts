import { Timestamp } from "firebase-admin/firestore";
import { COL, DOC, type StudentsBoardDoc, type UserDoc } from "../shared/types";
import { db } from "./db";
import { CANDIDATES, rankStudents } from "./rank";

/** The query refreshLeaderboard runs: single-field (points) — never reads all users (cost rules). */
export const topUsersQuery = () =>
  db().collection(COL.users).where("points", ">", 0).orderBy("points", "desc").limit(CANDIDATES);

/** Rebuilds leaderboard/students from the top 300 users by points (SPEC §5). Returns rows written. */
export async function refreshStudentsBoard(now = Date.now()): Promise<number> {
  const snap = await topUsersQuery().get();
  const top = rankStudents(
    snap.docs.map((d) => {
      const u = d.data() as UserDoc;
      return {
        uid: d.id,
        name: u.name,
        points: u.points,
        wins: u.wins ?? 0,
        losses: u.losses ?? 0,
        totalAnswerMs: u.totalAnswerMs ?? 0,
        pointsReachedAt: u.pointsReachedAt ? u.pointsReachedAt.toMillis() : null,
      };
    }),
  );
  const board: Omit<StudentsBoardDoc, "updatedAt"> & { updatedAt: Timestamp } = { top, updatedAt: Timestamp.fromMillis(now) };
  await db().collection(COL.leaderboard).doc(DOC.studentsBoard).set(board);
  return top.length;
}
