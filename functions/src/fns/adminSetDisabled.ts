import { HttpsError, onCall } from "firebase-functions/v2/https";
import { userRef } from "../lib/db";
import { requireRole } from "../lib/guards";

/**
 * Admin "Disable player" (anti-cheat F): sets users.disabled. Every player function then refuses
 * (lib/guards.ts), and the next leaderboard refresh leaves them out. Re-enabling undoes it.
 */
export const adminSetDisabled = onCall<unknown, Promise<{ uid: string; disabled: boolean }>>(async (req) => {
  requireRole(req, ["admin"]);
  const { uid, disabled } = (req.data ?? {}) as { uid?: unknown; disabled?: unknown };
  if (typeof uid !== "string" || !/^[\w-]{1,128}$/.test(uid) || typeof disabled !== "boolean") {
    throw new HttpsError("invalid-argument", "Send {uid, disabled}.");
  }
  const ref = userRef(uid);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "No such player.");
  await ref.update({ disabled });
  return { uid, disabled };
});
