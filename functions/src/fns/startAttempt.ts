import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  COL,
  challengeId,
  isVoiceChallenge,
  raidChallengeId,
  timerSeconds,
  type AttemptDoc,
  type ChallengeDoc,
  type LingoDoc,
  type RaidDoc,
  type RaidPlayerDoc,
  type StartAttemptOutput,
  type UserDoc,
} from "../shared/types";
import { serverNow } from "../lib/clock";
import { forfeitTx, readOpenAttemptTx } from "../lib/attempts";
import { publicChallenge } from "../lib/challenge";
import { istDate } from "../lib/date";
import { db, userRef } from "../lib/db";
import { campusCheck, isEmulator, isValidLatLng } from "../lib/geo";
import { requirePlayer } from "../lib/guards";
import { raidPhase } from "../lib/raids";
import { attemptsUsedToday, triedToday } from "../lib/state";

const fail = (code: string, message: string): never => {
  throw new HttpsError("failed-precondition", message, { code });
};

export const startAttempt = onCall<unknown, Promise<StartAttemptOutput>>(async (req) => {
  const now = await serverNow();
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
  // DECISION (Day 8 load test): the challenge is read outside the transaction — every player of a
  // Lingo reads the same document, and it doesn't change during play.
  const challengeSnap = await db()
    .collection(COL.challenges)
    .doc(raidRef ? raidChallengeId(raidRef.id) : challengeId(today, lingoId))
    .get();
  const result = await db().runTransaction(async (tx) => {
    // All reads first (Firestore transactions require it). Only this player's own documents.
    const [userSnap, raidSnap, playerSnap] = await Promise.all([
      tx.get(userRef(uid)),
      raidRef ? tx.get(raidRef) : null,
      raidRef ? tx.get(raidRef.collection(COL.players).doc(uid)) : null,
    ]);
    const user = userSnap.data() as UserDoc;
    const open = await readOpenAttemptTx(tx, user);
    const used = attemptsUsedToday(user, today);
    const tried = triedToday(user, today);

    if (raidRef) {
      // Owl Raid (SPEC §2, §5): joined players only, once unlocked and before endAt, exactly one try
      // each. Outside the daily 4 and the one-try-per-Lingo rule.
      const raid = raidSnap!.data() as RaidDoc | undefined;
      if (!raid || raid.lingoId !== lingoId) throw new HttpsError("not-found", "Unknown raid.");
      const player = playerSnap!.data() as RaidPlayerDoc | undefined;
      if (!player) fail("not-joined", "Join the raid at the poster first.");
      if (player!.attemptId) fail("raid-tried", "You've already had your one try at this raid.");
      if (raidPhase(raid, now) !== "active") fail("raid-ended", "This raid is over.");
      if (!raid.unlocked) fail("raid-locked", "The raid isn't unlocked yet — it needs more players.");
    } else {
      // SPEC §2: ONE try per Lingo per IST day (won, failed or forfeit all close it), 4 different
      // Lingos a day. Checked on the user doc alone — no query on attempts in the transaction.
      const name = (lingoSnap.data() as LingoDoc).name;
      if (tried.includes(lingoId)) fail("already-tried", `You've already tried ${name} today — come back tomorrow`);
      if (used >= rules.attemptsPerDay || tried.length >= rules.attemptsPerDay) {
        fail("no-attempts", `You've tried ${rules.attemptsPerDay} Lingos today — come back tomorrow`);
      }
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
    tx.update(userRef(uid), { openAttemptId: attemptRef.id });
    if (raidRef) {
      // The one try is used the moment it starts: won, failed and forfeit all count.
      tx.update(raidRef.collection(COL.players).doc(uid), { attemptId: attemptRef.id });
      return { challenge, expiresAt, attemptsLeft: Math.max(0, rules.attemptsPerDay - used), closed };
    }
    // The try is used the moment Start succeeds (a forfeit closes the Lingo too).
    tx.update(userRef(uid), { attemptsToday: used + 1, attemptsDate: today, triedToday: [...tried, lingoId], triedDate: today });

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
