import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  COL,
  challengeId,
  timerSeconds,
  type AttemptDoc,
  type CatchDoc,
  type ChallengeDoc,
  type SubmitAttemptOutput,
  type UserDoc,
} from "../shared/types";
import { catchRef, db, userRef } from "../lib/db";
import { requirePlayer } from "../lib/guards";
import { scoreAnswer } from "../lib/score";
import { speedBonus } from "../lib/speed";

const MAX_TRANSCRIPT = 500;

function parseInput(data: unknown) {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.attemptId !== "string" || !/^[\w-]{1,64}$/.test(d.attemptId)) {
    throw new HttpsError("invalid-argument", "Unknown attempt.");
  }
  if (d.transcript !== undefined && (typeof d.transcript !== "string" || d.transcript.length > MAX_TRANSCRIPT)) {
    throw new HttpsError("invalid-argument", "Bad answer.");
  }
  if (d.choice !== undefined && !(Number.isInteger(d.choice) && (d.choice as number) >= 0 && (d.choice as number) <= 3)) {
    throw new HttpsError("invalid-argument", "Bad answer.");
  }
  return { attemptId: d.attemptId, transcript: d.transcript as string | undefined, choice: d.choice as number | undefined };
}

export const submitAttempt = onCall<unknown, Promise<SubmitAttemptOutput>>(async (req) => {
  const now = Date.now(); // the server is the timer (CLAUDE.md rule 5)
  const { uid, config } = await requirePlayer(req, now);
  const { attemptId, transcript, choice } = parseInput(req.data);
  const { rules } = config;
  const attemptRef = db().collection(COL.attempts).doc(attemptId);

  const out = await db().runTransaction(async (tx) => {
    const attemptSnap = await tx.get(attemptRef);
    const attempt = attemptSnap.data() as AttemptDoc | undefined;
    if (!attempt || attempt.uid !== uid) throw new HttpsError("permission-denied", "Not your attempt.");
    if (attempt.status !== "open") {
      throw new HttpsError("failed-precondition", "This chance is already over.", { code: "not-open", status: attempt.status });
    }

    const [challengeSnap, userSnap, catchSnap] = await Promise.all([
      tx.get(db().collection(COL.challenges).doc(challengeId(attempt.date, attempt.lingoId))),
      tx.get(userRef(uid)),
      tx.get(catchRef(uid, attempt.lingoId)),
    ]);
    const user = userSnap.data() as UserDoc;
    const expiresAt = attempt.expiresAt.toMillis();

    // Too late (past expiry + grace): the chance is lost whatever the client says. Commit the
    // forfeit, then report the error outside the transaction (a throw here would roll it back).
    if (now > expiresAt + rules.graceSeconds * 1000) {
      tx.update(attemptRef, { status: "forfeit", receivedAt: Timestamp.fromMillis(now) });
      tx.update(userRef(uid), { losses: FieldValue.increment(1) });
      return { late: true as const };
    }

    const challenge = challengeSnap.data() as ChallengeDoc | undefined;
    if (!challenge) throw new HttpsError("internal", "Challenge missing.");
    const result = scoreAnswer(challenge, { transcript, choice }, rules);
    const answerMs = now - attempt.startedAt.toMillis();
    const bonus = result.won ? speedBonus(expiresAt, now, timerSeconds(attempt.type, rules), rules.speedBonusPerSecond) : 0;

    tx.update(attemptRef, {
      status: result.won ? "won" : "failed",
      score: result.score,
      receivedAt: Timestamp.fromMillis(now),
      answerMs,
      speedBonus: bonus,
    });
    // Points, catches, streaks and depts are wired in on Day 4 (PLAN 4.2).
    tx.update(
      userRef(uid),
      result.won
        ? { wins: FieldValue.increment(1), totalAnswerMs: FieldValue.increment(answerMs) }
        : { losses: FieldValue.increment(1) },
    );

    const caught = catchSnap.data() as CatchDoc | undefined;
    const response: SubmitAttemptOutput = {
      result: result.won ? "won" : "failed",
      // DECISION: Day 3 is scoring only — points (incl. the speed bonus) are paid from PLAN 4.2.
      pointsAdded: 0,
      speedBonus: 0,
      bonuses: [],
      newLevel: caught?.level ?? 1,
      newTotal: user.points,
      needsFavorites: false,
      ...(result.missedWords ? { missedWords: result.missedWords } : {}),
    };
    return { late: false as const, response };
  });

  if (out.late) {
    throw new HttpsError("deadline-exceeded", "Time was up — this chance is lost.", { code: "too-late" });
  }
  return out.response;
});
