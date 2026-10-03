import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  COL,
  challengeId,
  isVoiceChallenge,
  raidChallengeId,
  timerSeconds,
  type AttemptDoc,
  type CatchDoc,
  type ChallengeDoc,
  type RaidDoc,
  type RaidPlayerDoc,
  type StartAttemptOutput,
  type UserDoc,
} from "../shared/types";
import { forfeitTx, readOpenAttemptsTx } from "../lib/attempts";
import { publicChallenge } from "../lib/challenge";
import { istDate } from "../lib/date";
import { catchRef, db, userRef } from "../lib/db";
import { campusCheck, isEmulator, isValidLatLng } from "../lib/geo";
import { requirePlayer } from "../lib/guards";
import { raidPhase } from "../lib/raids";
import { attemptsUsedToday } from "../lib/state";

const fail = (code: string, message: string): never => {
  throw new HttpsError("failed-precondition", message, { code });
};

export const startAttempt = onCall<unknown, Promise<StartAttemptOutput>>(async (req) => {
  const now = Date.now();
  const { uid, config } = await requirePlayer(req, now);
  const { lingoId, lat, lng, raidId, speech } = (req.data ?? {}) as Record<string, unknown>;

  if (typeof lingoId !== "string" || !/^[\w-]{1,40}$/.test(lingoId)) {
    throw new HttpsError("invalid-argument", "Unknown Lingo.");
  }
  if (raidId != null && (typeof raidId !== "string" || !/^[\w-]{1,64}$/.test(raidId))) {
    throw new HttpsError("invalid-argument", "Unknown raid.");
  }
  if (!isValidLatLng(lat, lng)) throw new HttpsError("invalid-argument", "We need your location.", { code: "bad-location" });
  if (campusCheck(lat as number, lng as number, config, isEmulator()) === "off-campus") {
    fail("off-campus", "You need to be on campus to catch Lingos.");
  }

  const today = istDate(now);
  const { rules } = config;
  const lingoSnap = await db().collection(COL.lingos).doc(lingoId).get();
  if (!lingoSnap.exists) throw new HttpsError("not-found", "Unknown Lingo.");

  const attemptRef = db().collection(COL.attempts).doc();
  const raidRef = raidId ? db().collection(COL.raids).doc(raidId as string) : null;
  const result = await db().runTransaction(async (tx) => {
    // All reads first (Firestore transactions require it).
    const [open, userSnap, catchSnap, challengeSnap, raidSnap, playerSnap] = await Promise.all([
      readOpenAttemptsTx(tx, uid),
      tx.get(userRef(uid)),
      tx.get(catchRef(uid, lingoId)),
      tx.get(db().collection(COL.challenges).doc(raidRef ? raidChallengeId(raidRef.id) : challengeId(today, lingoId))),
      raidRef ? tx.get(raidRef) : null,
      raidRef ? tx.get(raidRef.collection(COL.players).doc(uid)) : null,
    ]);
    const user = userSnap.data() as UserDoc;
    const caught = catchSnap.data() as CatchDoc | undefined;
    const used = attemptsUsedToday(user, today);

    if (raidRef) {
      // Owl Raid (SPEC §2, §5): joined players only, once unlocked and before endAt, exactly one try
      // each. Outside the daily 4 and the once-a-day catch rule.
      const raid = raidSnap!.data() as RaidDoc | undefined;
      if (!raid || raid.lingoId !== lingoId) throw new HttpsError("not-found", "Unknown raid.");
      const player = playerSnap!.data() as RaidPlayerDoc | undefined;
      if (!player) fail("not-joined", "Join the raid at the poster first.");
      if (player!.attemptId) fail("raid-tried", "You've already had your one try at this raid.");
      if (raidPhase(raid, now) !== "active") fail("raid-ended", "This raid is over.");
      if (!raid.unlocked) fail("raid-locked", "The raid isn't unlocked yet — it needs more players.");
    } else {
      if (caught?.lastCaughtDate === today) fail("already-caught", "You already caught this Lingo today. Come back tomorrow!");
      if (used >= rules.attemptsPerDay) fail("no-attempts", "No attempts left today. Come back tomorrow!");
    }
    if (!challengeSnap.exists) fail("no-challenge", raidRef ? "This raid has no challenge." : "This Lingo has no challenge today.");
    // No speech recognition in this browser + a voice challenge: refuse BEFORE any write, so no
    // attempt (or raid try) is used and nothing but "it needs your voice" is revealed (SPEC §3.8).
    if (speech === false && isVoiceChallenge((challengeSnap.data() as ChallengeDoc).type)) {
      fail("needs-speech", "Open in Chrome or Safari for this Lingo — it needs your voice.");
    }

    // Closing any open attempt guarantees "only one open attempt per user" (SPEC §3.7): an attempt
    // left open in another tab is forfeited (and counted as a loss) here.
    const closed = forfeitTx(tx, uid, open);

    const challenge = challengeSnap.data() as ChallengeDoc;
    const expiresAt = now + timerSeconds(challenge.type, rules) * 1000;
    const attempt: AttemptDoc = {
      uid,
      lingoId,
      date: today,
      type: challenge.type,
      ...(raidRef ? { raidId: raidRef.id } : {}),
      startedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
      status: "open",
    };
    tx.create(attemptRef, attempt);
    if (raidRef) {
      // The one try is used the moment it starts: won, failed and forfeit all count.
      tx.update(raidRef.collection(COL.players).doc(uid), { attemptId: attemptRef.id });
      return { challenge, expiresAt, attemptsLeft: Math.max(0, rules.attemptsPerDay - used), closed };
    }
    tx.update(userRef(uid), { attemptsToday: used + 1, attemptsDate: today });

    return { challenge, expiresAt, attemptsLeft: rules.attemptsPerDay - used - 1, closed };
  });

  return {
    attemptId: attemptRef.id,
    ...publicChallenge(result.challenge),
    expiresAt: result.expiresAt,
    serverNow: now,
    attemptsLeft: result.attemptsLeft,
  };
});
