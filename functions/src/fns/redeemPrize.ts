import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type PrizeDoc, type RedeemPrizeOutput, type RedemptionDoc, type UserDoc } from "../shared/types";
import { db, userRef } from "../lib/db";
import { requireRole } from "../lib/guards";
import { rateLimit } from "../lib/rateLimit";
import { serverNow } from "../lib/clock";

const fail = (code: string, message: string): never => {
  throw new HttpsError("failed-precondition", message, { code });
};

/**
 * Prize desk (SPEC §5, anti-cheat J): a volunteer/admin redeems a prize for a player (QR = uid).
 * One transaction reads the player and the prize, checks balance ≥ cost and stock > 0, then writes
 * spent + stock + the redemption together. Two desks redeeming at the same moment are serialised,
 * so only one succeeds when only one fits, and neither balance nor stock can go below 0.
 * DECISION: balance = points − spent. Leaderboard points stay as earned (a prize mustn't cost a
 * player their place before the final).
 */
export const redeemPrize = onCall<unknown, Promise<RedeemPrizeOutput>>(async (req) => {
  const byUid = requireRole(req, ["volunteer", "admin"]);
  await rateLimit(byUid, "call", await serverNow());
  const { uid, prizeId } = (req.data ?? {}) as { uid?: unknown; prizeId?: unknown };
  if (typeof uid !== "string" || !/^[\w-]{1,128}$/.test(uid) || typeof prizeId !== "string" || !/^[\w-]{1,64}$/.test(prizeId)) {
    throw new HttpsError("invalid-argument", "Send {uid, prizeId}.");
  }
  const prizeRef = db().collection(COL.prizes).doc(prizeId);
  const redemptionRef = db().collection(COL.redemptions).doc();

  const newBalance = await db().runTransaction(async (tx) => {
    const [userSnap, prizeSnap] = await Promise.all([tx.get(userRef(uid)), tx.get(prizeRef)]);
    const user = userSnap.data() as UserDoc | undefined;
    const prize = prizeSnap.data() as PrizeDoc | undefined;
    if (!user?.profileDone) fail("no-player", "No player with that QR code.");
    if (user!.disabled) fail("disabled", "This player's account is paused — ask an organiser.");
    if (!prize) fail("no-prize", "Unknown prize.");
    if (prize!.stock <= 0) fail("out-of-stock", `${prize!.name} is out of stock.`);
    const balance = user!.points - (user!.spent ?? 0);
    if (balance < prize!.cost) fail("not-enough", `Not enough points: ${balance} left, ${prize!.name} costs ${prize!.cost}.`);
    const redemption: Omit<RedemptionDoc, "createdAt"> & { createdAt: Timestamp } = {
      uid,
      prizeId,
      cost: prize!.cost,
      byUid,
      createdAt: Timestamp.now(),
    };
    tx.update(userRef(uid), { spent: FieldValue.increment(prize!.cost) });
    tx.update(prizeRef, { stock: FieldValue.increment(-1) });
    tx.create(redemptionRef, redemption);
    return balance - prize!.cost;
  });
  return { newBalance, redemptionId: redemptionRef.id };
});
