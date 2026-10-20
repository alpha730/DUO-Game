import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import type { AdminSetConfigInput, GameConfigDoc } from "../shared/types";
import { parseConfigPatch } from "../lib/admin";
import { configRef, loadConfig } from "../lib/db";
import { requireRole } from "../lib/guards";
import { STAFF_INSTANCES } from "../lib/instances";

/** Admin: edit config/game (PLAN 7.2) — times, campus centre + radius, lock, rules (merged). */
export const adminSetConfig = onCall<AdminSetConfigInput, Promise<{ ok: true }>>(STAFF_INSTANCES, async (req) => {
  requireRole(req, ["admin"]);
  const config = await loadConfig();
  if (!config) throw new HttpsError("failed-precondition", "Game is not configured — run the seed first.");
  const parsed = parseConfigPatch(req.data, { startAt: config.startAt.toMillis(), lockAt: config.lockAt.toMillis() });
  if ("error" in parsed) throw new HttpsError("invalid-argument", parsed.error, { code: "bad-config" });

  const { startAt, lockAt, rules, ...rest } = parsed.patch;
  const update: Partial<GameConfigDoc> & Record<string, unknown> = { ...rest };
  if (startAt !== undefined) update.startAt = Timestamp.fromMillis(startAt);
  if (lockAt !== undefined) update.lockAt = Timestamp.fromMillis(lockAt);
  // Dotted paths merge single rules without touching the others.
  for (const [k, v] of Object.entries(rules ?? {})) update[`rules.${k}`] = v;
  if (Object.keys(update).length) await configRef().update(update);
  return { ok: true };
});
