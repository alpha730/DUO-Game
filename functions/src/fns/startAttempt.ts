import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  COL,
  challengeId,
  isVoiceChallenge,
  timerSeconds,
  type AttemptDoc,
  type CatchDoc,
  type ChallengeDoc,
  type StartAttemptOutput,
  type UserDoc,
} from "../shared/types";
import { forfeitTx, readOpenAttemptsTx } from "../lib/attempts";
import { publicChallenge } from "../lib/challenge";
import { istDate } from "../lib/date";
import { catchRef, db, userRef } from "../lib/db";
import { campusCheck, isEmulator, isValidLatLng } from "../lib/geo";
import { requirePlayer } from "../lib/guards";
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
  // DECISION: raids arrive on Day 6; until then a raidId is refused rather than silently ignored.
  if (raidId !== undefined) throw new HttpsError("unimplemented", "Owl Raids aren't open yet.", { code: "no-raids" });
  if (!isValidLatLng(lat, lng)) throw new HttpsError("invalid-argument", "We need your location.", { code: "bad-location" });
  if (campusCheck(lat as number, lng as number, config, isEmulator()) === "off-campus") {
    fail("off-campus", "You need to be on campus to catch Lingos.");
  }

  const today = istDate(now);
  const { rules } = config;
  const lingoSnap = await db().collection(COL.lingos).doc(lingoId).get();
  if (!lingoSnap.exists) throw new HttpsError("not-found", "Unknown Lingo.");

  const attemptRef = db().collection(COL.attempts).doc();
  const result = await db().runTransaction(async (tx) => {
    // All reads first (Firestore transactions require it).
    const [open, userSnap, catchSnap, challengeSnap] = await Promise.all([
      readOpenAttemptsTx(tx, uid),
      tx.get(userRef(uid)),
      tx.get(catchRef(uid, lingoId)),
      tx.get(db().collection(COL.challenges).doc(challengeId(today, lingoId))),
    ]);
    const user = userSnap.data() as UserDoc;
    const caught = catchSnap.data() as CatchDoc | undefined;

    if (caught?.lastCaughtDate === today) fail("already-caught", "You already caught this Lingo today. Come back tomorrow!");
    const used = attemptsUsedToday(user, today);
    if (used >= rules.attemptsPerDay) fail("no-attempts", "No attempts left today. Come back tomorrow!");
    if (!challengeSnap.exists) fail("no-challenge", "This Lingo has no challenge today.");
    // No speech recognition in this browser + a voice challenge: refuse BEFORE any write, so no
    // attempt is used and nothing but "it needs your voice" is revealed (SPEC §3.8).
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
      startedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
      status: "open",
    };
    tx.create(attemptRef, attempt);
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
