import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type AdminCreateRaidOutput, type LingoDoc, type RaidDoc } from "../shared/types";
import { db } from "../lib/db";
import { requireRole } from "../lib/guards";
import { planRaid } from "../lib/raids";

const MESSAGES = {
  "bad-input": "Give a poster, a Lingo, a start time and a sensible length.",
  "unknown-lingo": "Unknown Lingo.",
  "poster-mismatch": "That Lingo isn't on that poster.",
  "in-the-past": "The start time is in the past.",
} as const;

/** Admin: schedule an Owl Raid on one poster (PLAN 6.1). Default 15 minutes, 20 players to unlock. */
export const adminCreateRaid = onCall<unknown, Promise<AdminCreateRaidOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const input = (req.data ?? {}) as Record<string, unknown>;
  const lingoId = typeof input.lingoId === "string" ? input.lingoId : "";
  const lingoSnap = lingoId && /^[\w-]{1,40}$/.test(lingoId) ? await db().collection(COL.lingos).doc(lingoId).get() : null;
  const now = Date.now();
  const plan = planRaid(input, lingoSnap?.exists ? (lingoSnap.data() as LingoDoc) : undefined, now);
  if ("error" in plan) throw new HttpsError("invalid-argument", MESSAGES[plan.error], { code: plan.error });

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
  const ref = await db().collection(COL.raids).add(raid);
  return { raidId: ref.id };
});
