import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { DeskPlayerOutput, UserDoc } from "../shared/types";
import { serverNow } from "../lib/clock";
import { userRef } from "../lib/db";
import { requireRole } from "../lib/guards";
import { rateLimit } from "../lib/rateLimit";

/**
 * Prize desk (/redeem): a volunteer/admin looks up the player behind a QR code (= uid) — name,
 * points and balance (points − spent). Players' docs are owner-read only, so the desk asks here.
 */
export const deskPlayer = onCall<unknown, Promise<DeskPlayerOutput>>(async (req) => {
  const byUid = requireRole(req, ["volunteer", "admin"]);
  await rateLimit(byUid, "call", await serverNow());
  const uid = (req.data as { uid?: unknown } | null)?.uid;
  if (typeof uid !== "string" || !/^[\w-]{1,128}$/.test(uid)) {
    throw new HttpsError("invalid-argument", "That isn't a prize code.", { code: "bad-code" });
  }
  const user = (await userRef(uid).get()).data() as UserDoc | undefined;
  if (!user?.profileDone) throw new HttpsError("not-found", "No player with that QR code.", { code: "no-player" });
  const spent = user.spent ?? 0;
  return { uid, name: user.name, points: user.points, spent, balance: user.points - spent, disabled: user.disabled === true };
});
