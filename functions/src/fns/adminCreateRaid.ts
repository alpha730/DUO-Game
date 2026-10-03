import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, raidChallengeId, type AdminCreateRaidOutput, type LingoDoc, type RaidDoc } from "../shared/types";
import { parseChallenge } from "../lib/challenge";
import { db } from "../lib/db";
import { requireRole } from "../lib/guards";
import { planRaid } from "../lib/raids";

const MESSAGES = {
  "bad-input": "Give a poster, a Lingo, a start time and a sensible length.",
  "unknown-lingo": "Unknown Lingo.",
  "poster-mismatch": "That Lingo isn't on that poster.",
  "in-the-past": "The start time is in the past.",
  "bad-challenge": "The raid challenge is incomplete (meaning/question need 4 different options and a correct answer).",
} as const;

/**
 * Admin: schedule an Owl Raid on one poster (PLAN 6.1). Default 15 minutes, 20 players to unlock.
 * The raid has its own challenge (never today's normal one), stored server-only at
 * challenges/raid_{raidId} in the same batch as the raid.
 */
export const adminCreateRaid = onCall<unknown, Promise<AdminCreateRaidOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const input = (req.data ?? {}) as Record<string, unknown>;
  const lingoId = typeof input.lingoId === "string" ? input.lingoId : "";
  const lingoSnap = lingoId && /^[\w-]{1,40}$/.test(lingoId) ? await db().collection(COL.lingos).doc(lingoId).get() : null;
  const now = Date.now();
  const plan = planRaid(input, lingoSnap?.exists ? (lingoSnap.data() as LingoDoc) : undefined, now);
  if ("error" in plan) throw new HttpsError("invalid-argument", MESSAGES[plan.error], { code: plan.error });
  const challenge = parseChallenge(input.challenge);
  if (!challenge) throw new HttpsError("invalid-argument", MESSAGES["bad-challenge"], { code: "bad-challenge" });

  const raid: Omit<RaidDoc, "startAt" | "endAt"> & { startAt: Timestamp; endAt: Timestamp } = {
    posterIndex: plan.posterIndex,
    lingoId: plan.lingoId,
    startAt: Timestamp.fromMillis(plan.startAt),
    endAt: Timestamp.fromMillis(plan.endAt),
    minPlayers: plan.minPlayers,
    joined: 0,
    unlocked: false,
    status: plan.status,
  };
  const ref = db().collection(COL.raids).doc();
  const batch = db().batch();
  batch.create(db().collection(COL.challenges).doc(raidChallengeId(ref.id)), challenge);
  batch.create(ref, raid);
  await batch.commit();
  return { raidId: ref.id };
});
