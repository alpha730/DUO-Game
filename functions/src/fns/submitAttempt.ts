import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  COL,
  raidChallengeId,
  timerSeconds,
  type AttemptDoc,
  type CatchDoc,
  type ChallengeDoc,
  type PointsLogDoc,
  type PointsReason,
  type SubmitAttemptOutput,
  type UserDoc,
} from "../shared/types";
import { serverNow } from "../lib/clock";
import { catchRef, db, userRef } from "../lib/db";
import { requirePlayer } from "../lib/guards";
import { scoreCatch, scoreRaidCatch } from "../lib/points";
import { originalChoice } from "../lib/challenge";
import { fastAnswerFlag, isSuspect, voiceSignals } from "../lib/cheat";
import { words } from "../lib/match";
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
  const now = await serverNow(); // the server is the timer (CLAUDE.md rule 5)
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

    // The question asked is stored on the attempt (startAttempt); only older raid attempts lack it.
    const [challengeSnap, userSnap, catchSnap] = await Promise.all([
      attempt.question || !attempt.raidId ? null : tx.get(db().collection(COL.challenges).doc(raidChallengeId(attempt.raidId))),
      tx.get(userRef(uid)),
      tx.get(catchRef(uid, attempt.lingoId)),
    ]);
    const user = userSnap.data() as UserDoc;
    const expiresAt = attempt.expiresAt.toMillis();

    // Too late (past expiry + grace): the chance is lost whatever the client says. Commit the
    // forfeit, then report the error outside the transaction (a throw here would roll it back).
    if (now > expiresAt + rules.graceSeconds * 1000) {
      tx.update(attemptRef, { status: "forfeit", receivedAt: Timestamp.fromMillis(now) });
      tx.update(userRef(uid), { losses: FieldValue.increment(1), openAttemptId: null });
      return { late: true as const };
    }

    const challenge = attempt.question ?? (challengeSnap?.data() as ChallengeDoc | undefined);
    if (!challenge) throw new HttpsError("internal", "Challenge missing.");
    // After answering only (CLAUDE.md rule 4): the right option and what it means, for learning.
    const answer =
      challenge.type === "meaning" || challenge.type === "question"
        ? {
            answer: {
              text: challenge.options[challenge.correctIndex],
              ...(attempt.question?.explanation ? { explanation: attempt.question.explanation } : {}),
            },
          }
        : {};
    // Anti-cheat B: the client sends the position it saw; map it back through this attempt's order.
    const result = scoreAnswer(challenge, { transcript, choice: originalChoice(choice, attempt.order) }, rules);
    const answerMs = now - attempt.startedAt.toMillis();
    const bonus = result.won ? speedBonus(expiresAt, now, timerSeconds(attempt.type, rules), rules.speedBonusPerSecond) : 0;

    const receivedAt = Timestamp.fromMillis(now);
    // Cheat signals (Day 8): flag only — points and the result are never affected.
    const flagReason = fastAnswerFlag(attempt.type, answerMs);
    tx.update(attemptRef, {
      status: result.won ? "won" : "failed",
      score: result.score,
      receivedAt,
      answerMs,
      speedBonus: bonus,
      ...(flagReason ? { flagged: true, flagReason } : {}),
    });
    // Admin signals on the user: fast-answer count + "too good to be true" (re-evaluated each answer).
    const after = {
      wins: (user.wins ?? 0) + (result.won ? 1 : 0),
      losses: (user.losses ?? 0) + (result.won ? 0 : 1),
      totalAnswerMs: (user.totalAnswerMs ?? 0) + (result.won ? answerMs : 0),
    };
    // Anti-cheat G (flag only): every Read Aloud win a perfect transcript in under 2 s.
    const target = challenge.type === "pronounce" ? challenge.word : challenge.type === "speak" ? challenge.phrase : null;
    const voice =
      result.won && target !== null
        ? voiceSignals(user, { perfect: words(transcript ?? "").join(" ") === words(target).join(" "), answerMs })
        : null;
    const signals = { suspect: isSuspect(after), ...(flagReason ? { flags: FieldValue.increment(1) } : {}), ...(voice ?? {}) };
    const caught = catchSnap.data() as CatchDoc | undefined;
    const missed = result.missedWords ? { missedWords: result.missedWords } : {};

    if (!result.won) {
      // Wrong / failed = 0 points (SPEC §2); it only counts as a loss.
      tx.update(userRef(uid), { losses: FieldValue.increment(1), openAttemptId: null, ...signals });
      const response: SubmitAttemptOutput = {
        result: "failed",
        pointsAdded: 0,
        speedBonus: 0,
        bonuses: [],
        newLevel: caught?.level ?? 1,
        newTotal: user.points,
        needsFavorites: false,
        ...(attempt.raidId ? { raid: true } : {}),
        ...missed,
        ...answer,
      };
      return { late: false as const, response };
    }

    const log = (amount: number, reason: PointsReason) => {
      if (amount <= 0) return;
      const entry: Omit<PointsLogDoc, "createdAt"> & { createdAt: Timestamp } = {
        uid,
        amount,
        reason,
        attemptId,
        createdAt: receivedAt,
      };
      tx.create(db().collection(COL.pointsLog).doc(), entry);
    };
    // DECISION: a raid answer counts in wins/losses and answer time like any other (leaderboard accuracy).
    const stats = {
      ...signals,
      openAttemptId: null, // this was the open attempt (only one can be open)
      wins: FieldValue.increment(1),
      totalAnswerMs: FieldValue.increment(answerMs),
      pointsReachedAt: receivedAt, // tie-break: who reached this total first
    };

    if (attempt.raidId) {
      // Owl Raid win (SPEC §2): raidCatchPoints + speed instead of the catch points; collection only —
      // no favourite streak, MAX, day streak or "caught today".
      const r = scoreRaidCatch({ user, catchDoc: caught, lingoId: attempt.lingoId, rules, speedBonus: bonus });
      tx.set(
        catchRef(uid, attempt.lingoId),
        { ...r.catchDoc, ...(r.firstCatch ? { firstCaughtAt: receivedAt } : {}) },
        { merge: true },
      );
      tx.update(userRef(uid), { points: FieldValue.increment(r.pointsAdded), ...r.user, ...stats });
      log(r.base, "raid");
      log(r.speedBonus, "speed");
      for (const b of r.bonuses) log(b.points, b.kind);
      const response: SubmitAttemptOutput = {
        result: "won",
        pointsAdded: r.pointsAdded,
        speedBonus: r.speedBonus,
        bonuses: r.bonuses,
        newLevel: r.newLevel,
        newTotal: user.points + r.pointsAdded,
        needsFavorites: r.needsFavorites,
        raid: true,
        ...missed,
        ...answer,
      };
      return { late: false as const, response };
    }

    // Win: points, catch doc, user totals and the points log in this one transaction (PLAN 4.2).
    const o = scoreCatch({ user, catchDoc: caught, lingoId: attempt.lingoId, today: attempt.date, rules, speedBonus: bonus });
    tx.set(
      catchRef(uid, attempt.lingoId),
      { ...o.catchDoc, ...(o.firstCatch ? { firstCaughtAt: receivedAt } : {}) },
      { merge: true },
    );
    tx.update(userRef(uid), { points: FieldValue.increment(o.pointsAdded), ...o.user, ...stats });
    log(o.base, o.baseReason);
    log(o.speedBonus, "speed");
    for (const b of o.bonuses) log(b.points, b.kind);

    const response: SubmitAttemptOutput = {
      result: "won",
      pointsAdded: o.pointsAdded,
      speedBonus: o.speedBonus,
      bonuses: o.bonuses,
      newLevel: o.newLevel,
      ...(o.favorite ? { favStreak: o.catchDoc.favStreak } : {}),
      newTotal: user.points + o.pointsAdded,
      needsFavorites: o.needsFavorites,
      ...missed,
      ...answer,
    };
    return { late: false as const, response };
  });

  if (out.late) {
    throw new HttpsError("deadline-exceeded", "Time was up — this chance is lost.", { code: "too-late" });
  }
  return out.response;
});
