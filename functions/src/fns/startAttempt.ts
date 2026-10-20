import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  COL,
  isVoiceChallenge,
  raidChallengeId,
  timerSeconds,
  type AttemptDoc,
  type CatchDoc,
  type ChallengeDoc,
  type LingoDoc,
  type QuestionLevel,
  type RaidDoc,
  type RaidPlayerDoc,
  type StartAttemptOutput,
  type UserDoc,
} from "../shared/types";
import { serverNow } from "../lib/clock";
import { forfeitTx, readOpenAttemptTx } from "../lib/attempts";
import { publicChallenge, shuffledOrder } from "../lib/challenge";
import { playPeriod } from "../lib/date";
import { catchRef, db, userRef } from "../lib/db";
import { lenientCampus } from "../lib/emulator";
import { campusCheck, distanceM, isValidLatLng } from "../lib/geo";
import { locationJump } from "../lib/cheat";
import { requirePlayer } from "../lib/guards";
import { pinnedQuestion, questionPool } from "../lib/questionPool";
import { levelFor, pickQuestion, streakDayFor, targetWord } from "../lib/questions";
import { raidPhase } from "../lib/raids";
import { attemptsUsedToday, triedToday, triesToday } from "../lib/state";

/** Two Starts within this window (two tabs/devices at the same moment): the second is refused. */
const RACE_MS = 5000;

const fail = (code: string, message: string): never => {
  throw new HttpsError("failed-precondition", message, { code });
};

export const startAttempt = onCall<unknown, Promise<StartAttemptOutput>>(async (req) => {
  const now = await serverNow();
  const { uid, config } = await requirePlayer(req, now, "start");
  const { lingoId, lat, lng, raidId, speech } = (req.data ?? {}) as Record<string, unknown>;

  if (typeof lingoId !== "string" || !/^[\w-]{1,40}$/.test(lingoId)) {
    throw new HttpsError("invalid-argument", "Unknown Lingo.");
  }
  if (raidId != null && (typeof raidId !== "string" || !/^[\w-]{1,64}$/.test(raidId))) {
    throw new HttpsError("invalid-argument", "Unknown raid.");
  }
  if (!isValidLatLng(lat, lng)) throw new HttpsError("invalid-argument", "We need your location.", { code: "bad-location" });
  if (campusCheck(lat as number, lng as number, config.campuses ?? [], await lenientCampus()) === "off-campus") {
    fail("off-campus", "You need to be on campus to catch Lingos.");
  }

  // Per-day keys hold the round key in the one-day event (lib/date.ts playPeriod).
  const period = playPeriod(now, config);
  const today = period.key;
  const inRounds = period.round !== null;
  const thisTime = inRounds ? "this round" : "today";
  const comeBack = inRounds
    ? period.round!.n < period.round!.of
      ? " — come back next round"
      : ""
    : " — come back tomorrow";
  const { rules } = config;
  const lingoSnap = await db().collection(COL.lingos).doc(lingoId).get();
  if (!lingoSnap.exists) throw new HttpsError("not-found", "Unknown Lingo.");

  const attemptRef = db().collection(COL.attempts).doc();
  const raidRef = raidId ? db().collection(COL.raids).doc(raidId as string) : null;
  // DECISION (Day 8 load test): shared content is read outside the transaction. A raid has its own
  // challenge doc; a normal try picks from the question pool, held in memory (SPEC §9 cost rule).
  // Emulator only: a pinned question keeps browser tests deterministic (lib/questionPool.ts).
  const raidChallengeSnap = raidRef ? await db().collection(COL.challenges).doc(raidChallengeId(raidRef.id)).get() : null;
  const pinned = raidRef ? null : await pinnedQuestion(lingoId);
  const pool = raidRef || pinned ? [] : await questionPool();
  const result = await db().runTransaction(async (tx) => {
    // All reads first (Firestore transactions require it). Only this player's own documents.
    const [userSnap, raidSnap, playerSnap, catchSnap] = await Promise.all([
      tx.get(userRef(uid)),
      raidRef ? tx.get(raidRef) : null,
      raidRef ? tx.get(raidRef.collection(COL.players).doc(uid)) : null,
      raidRef ? null : tx.get(catchRef(uid, lingoId)),
    ]);
    const user = userSnap.data() as UserDoc;
    const open = await readOpenAttemptTx(tx, user);
    // Anti-cheat C: Start from two tabs/devices at the same moment → only the first one runs (and
    // uses a try); the second is refused without writing anything. An older open attempt (a tab
    // left behind) is still closed as a miss below (SPEC §3.7).
    const openDoc = open?.data() as AttemptDoc | undefined;
    if (openDoc?.status === "open" && now - openDoc.startedAt.toMillis() < RACE_MS) {
      fail("busy", "You already have a question open — answer that one first.");
    }
    const used = attemptsUsedToday(user, today);
    const tried = triedToday(user, today);
    const tries = triesToday(user, today);
    const triesUsed = tries[lingoId] ?? 0;

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
      // SPEC §2: 4 different Lingos per IST day, up to 2 tries each (failed and forfeit use a try; a
      // win closes the Lingo for the day). Only a new Lingo uses 1 of the 4. Checked on the user doc
      // and this Lingo's catch doc — no query on attempts in the transaction.
      const name = (lingoSnap.data() as LingoDoc).name;
      if ((catchSnap!.data() as CatchDoc | undefined)?.lastCaughtDate === today) {
        fail("already-caught", `You've already caught ${name} ${thisTime}${comeBack}`);
      }
      if (triesUsed >= rules.triesPerLingoPerDay) {
        fail("already-tried", `You've used your ${rules.triesPerLingoPerDay} tries at ${name} ${thisTime}${comeBack}`);
      }
      if (!tried.includes(lingoId) && (used >= rules.attemptsPerDay || tried.length >= rules.attemptsPerDay)) {
        fail("no-attempts", `You've tried ${rules.attemptsPerDay} Lingos ${thisTime}${comeBack}`);
      }
    }
    // Which question (SPEC §9): favourite on streak day ≥ 6 → hard, else medium; weighted type; not
    // seen before by this player; not a word they already had today.
    let challenge: ChallengeDoc & { explanation?: string };
    let questionId: string | undefined;
    let level: QuestionLevel | undefined;
    let word: string | null = null;
    if (raidRef) {
      if (!raidChallengeSnap!.exists) fail("no-challenge", "This raid has no challenge.");
      challenge = raidChallengeSnap!.data() as ChallengeDoc;
    } else if (pinned) {
      challenge = pinned;
      questionId = `pin-${lingoId}`;
      level = "medium";
    } else {
      const favorite = user.favorites.includes(lingoId);
      level = levelFor(favorite, streakDayFor(favorite, catchSnap!.data() as CatchDoc | undefined, today), rules.hardFromStreakDay ?? 6);
      const q = pickQuestion(pool, {
        level,
        seen: new Set(user.seenQ ?? []),
        wordsToday: new Set(user.wordsDate === today ? (user.wordsToday ?? []) : []),
        // No speech recognition in this browser: pick a tap-to-answer question instead (SPEC §3.8).
        allowVoice: speech !== false,
      });
      if (!q) fail("no-challenge", "There are no questions yet — ask the organisers.");
      challenge = q!.doc;
      questionId = q!.id;
      word = targetWord(q!.doc);
    }
    // A raid's (or pinned) voice challenge without speech recognition: refuse BEFORE any write, so no
    // attempt (or raid try) is used and nothing but "it needs your voice" is revealed (SPEC §3.8).
    if (speech === false && isVoiceChallenge(challenge!.type)) {
      fail("needs-speech", "Open in Chrome or Safari for this Lingo — it needs your voice.");
    }

    // Closing any open attempt guarantees "only one open attempt per user" (SPEC §3.7): an attempt
    // left open in another tab is forfeited (and counted as a loss) here.
    const closed = forfeitTx(tx, uid, open);

    const expiresAt = now + timerSeconds(challenge!.type, rules) * 1000;
    // Anti-cheat B: choice options in a new random order for every attempt.
    const order = challenge!.type === "meaning" || challenge!.type === "question" ? shuffledOrder(4) : undefined;
    // Anti-cheat H (flag only): a jump between far-apart places faster than possible.
    const fix = { lat: lat as number, lng: lng as number, at: Timestamp.fromMillis(now) };
    const jumped = locationJump(user.lastFix ? { ...user.lastFix, at: user.lastFix.at.toMillis() } : null, { ...fix, at: now }, distanceM);
    const attempt: AttemptDoc = {
      uid,
      lingoId,
      date: today,
      type: challenge!.type,
      ...(raidRef ? { raidId: raidRef.id } : {}),
      ...(questionId ? { questionId, level } : {}),
      question: challenge!, // server-only copy, scored by submitAttempt
      ...(order ? { order } : {}),
      startedAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(expiresAt),
      status: "open",
    };
    tx.create(attemptRef, attempt);
    tx.update(userRef(uid), { openAttemptId: attemptRef.id, lastFix: fix, ...(jumped ? { locationJumps: FieldValue.increment(1) } : {}) });
    if (raidRef) {
      // The one try is used the moment it starts: won, failed and forfeit all count.
      tx.update(raidRef.collection(COL.players).doc(uid), { attemptId: attemptRef.id });
      return { challenge: challenge!, order, expiresAt, attemptsLeft: Math.max(0, rules.attemptsPerDay - used), closed, level };
    }
    // The try is used the moment Start succeeds (a forfeit uses it too). A second try at the same
    // Lingo doesn't use another of the daily 4. The question counts as seen, and its word as used
    // today, from this moment too — so a second try always gets a different word.
    const words = user.wordsDate === today ? (user.wordsToday ?? []) : [];
    const newLingo = !tried.includes(lingoId);
    const usedAfter = newLingo ? used + 1 : used;
    tx.update(userRef(uid), {
      attemptsToday: usedAfter,
      attemptsDate: today,
      triedToday: newLingo ? [...tried, lingoId] : tried,
      triesToday: { ...tries, [lingoId]: triesUsed + 1 },
      triedDate: today,
      ...(questionId ? { seenQ: [...(user.seenQ ?? []).filter((id) => id !== questionId), questionId] } : {}),
      ...(word ? { wordsToday: [...words, word], wordsDate: today } : {}),
    });

    return {
      challenge: challenge!,
      order,
      expiresAt,
      attemptsLeft: Math.max(0, rules.attemptsPerDay - usedAfter),
      lingoTriesLeft: Math.max(0, rules.triesPerLingoPerDay - triesUsed - 1),
      closed,
      level,
    };
  });

  return {
    attemptId: attemptRef.id,
    ...publicChallenge(result.challenge, result.order),
    expiresAt: result.expiresAt,
    serverNow: now,
    attemptsLeft: result.attemptsLeft,
    ...("lingoTriesLeft" in result ? { lingoTriesLeft: result.lingoTriesLeft } : {}),
    ...(result.level ? { level: result.level } : {}),
  };
});
