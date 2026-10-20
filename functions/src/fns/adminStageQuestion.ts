import { HttpsError, onCall } from "firebase-functions/v2/https";
import { STAGE_SEEN_MAX, type AdminStageQuestionOutput } from "../shared/types";
import { requireRole } from "../lib/guards";
import { questionPool } from "../lib/questionPool";
import { pickStageQuestion, stageReveal } from "../lib/stage";

const ID = /^[\w-]{1,128}$/;

/**
 * /stage sudden-death tiebreaker (admin only): "next" = a random Hard meaning / fill-in-the-blank
 * question the stage hasn't shown this session, without its answer; "reveal" = its answer, asked
 * for only when the host taps "Reveal answer". Reads the cached pool (no extra Firestore reads).
 */
export const adminStageQuestion = onCall<unknown, Promise<AdminStageQuestionOutput>>(async (req) => {
  requireRole(req, ["admin"]);
  const d = (req.data ?? {}) as { action?: unknown; seen?: unknown; id?: unknown };
  const pool = await questionPool();
  if (d.action === "reveal") {
    if (typeof d.id !== "string" || !ID.test(d.id)) throw new HttpsError("invalid-argument", "Send {action: \"reveal\", id}.");
    const reveal = stageReveal(pool, d.id);
    if (!reveal) throw new HttpsError("not-found", "That question isn't in the pool any more.", { code: "no-question" });
    return { reveal };
  }
  if (d.action !== "next") throw new HttpsError("invalid-argument", "action must be \"next\" or \"reveal\".");
  const seen = d.seen ?? [];
  if (!Array.isArray(seen) || seen.length > STAGE_SEEN_MAX || seen.some((s) => typeof s !== "string" || !ID.test(s))) {
    throw new HttpsError("invalid-argument", "seen must be a list of question ids.");
  }
  const question = pickStageQuestion(pool, new Set(seen as string[]));
  if (!question) {
    throw new HttpsError("failed-precondition", "No more hard questions left — every one was shown this session.", { code: "no-more" });
  }
  return { question };
});
