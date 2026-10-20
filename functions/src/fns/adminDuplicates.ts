import { onCall } from "firebase-functions/v2/https";
import { COL, type AdminPlayersOutput, type UserDoc } from "../shared/types";
import { playerRow } from "../lib/adminPlayers";
import { db } from "../lib/db";
import { findDuplicates } from "../lib/duplicates";
import { requireRole } from "../lib/guards";
import { STAFF_INSTANCES } from "../lib/instances";

/**
 * Admin "Possible duplicate accounts" (anti-cheat F): same/similar names, similar emails, made within
 * minutes of each other. Flag only — no automatic action.
 * DECISION: spotting near-duplicates needs every name, so this reads all players — but only when an
 * admin clicks (≈ 20,000 small reads, about a rupee), never on a schedule or for a ranking (cost rules).
 */
export const adminDuplicates = onCall<unknown, Promise<AdminPlayersOutput>>(STAFF_INSTANCES, async (req) => {
  requireRole(req, ["admin"]);
  const snap = await db().collection(COL.users).where("profileDone", "==", true).get();
  const users = new Map(snap.docs.map((d) => [d.id, d.data() as UserDoc]));
  const dups = findDuplicates(
    [...users].map(([uid, u]) => ({ uid, name: u.name, email: u.email, createdAt: u.createdAt ? u.createdAt.toMillis() : null })),
  );
  return { rows: dups.map((d) => ({ ...playerRow(d.uid, users.get(d.uid)!), group: d.group, reason: d.reason })) };
});
