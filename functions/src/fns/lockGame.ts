import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { LockGameInput, LockGameOutput } from "../shared/types";
import { configRef } from "../lib/db";
import { requireRole } from "../lib/guards";

/** Admin: lock (or reopen) the game at once (SPEC §5). Every player function then refuses. */
export const lockGame = onCall<LockGameInput, Promise<LockGameOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const locked = req.data?.locked;
  if (typeof locked !== "boolean") throw new HttpsError("invalid-argument", "locked must be true or false.");
  await configRef().update({ locked });
  return { locked };
});
