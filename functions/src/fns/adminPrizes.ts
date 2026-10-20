import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type AdminPrizeRow, type AdminPrizesOutput, type PrizeDoc } from "../shared/types";
import { db } from "../lib/db";
import { requireRole } from "../lib/guards";
import { parsePrize, PRIZE_ID } from "../lib/prizes";

/** Every prize with its redemptions so far (one count query per prize — a handful of prizes). */
async function listPrizes(): Promise<AdminPrizeRow[]> {
  const snap = await db().collection(COL.prizes).get();
  const rows = await Promise.all(
    snap.docs.map(async (d) => {
      const redeemed = (await db().collection(COL.redemptions).where("prizeId", "==", d.id).count().get()).data().count;
      return { id: d.id, ...(d.data() as PrizeDoc), redeemed };
    }),
  );
  return rows.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}

/**
 * Admin: the prize list (PLAN 7.x) — add, edit (name, cost, stock) and remove, validated here
 * (lib/prizes.ts); clients never write prizes. Removing a prize keeps its redemptions (history).
 */
export const adminPrizes = onCall<unknown, Promise<AdminPrizesOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const d = (req.data ?? {}) as { action?: unknown; id?: unknown };
  const prizes = db().collection(COL.prizes);
  if (d.action === "save") {
    const parsed = parsePrize(req.data);
    if ("error" in parsed) throw new HttpsError("invalid-argument", parsed.error, { code: "bad-prize" });
    if (parsed.id) {
      const ref = prizes.doc(parsed.id);
      if (!(await ref.get()).exists) throw new HttpsError("not-found", "That prize was removed — reload the list.", { code: "no-prize" });
      await ref.set(parsed.prize);
    } else {
      await prizes.add(parsed.prize);
    }
  } else if (d.action === "remove") {
    if (typeof d.id !== "string" || !PRIZE_ID.test(d.id)) throw new HttpsError("invalid-argument", "Bad prize id.");
    await prizes.doc(d.id).delete();
  } else if (d.action !== "list") {
    throw new HttpsError("invalid-argument", 'action must be "list", "save" or "remove".');
  }
  return { prizes: await listPrizes() };
});
