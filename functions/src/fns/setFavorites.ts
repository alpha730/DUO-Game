import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type CatchDoc, type SetFavoritesOutput, type UserDoc } from "../shared/types";
import { serverNow } from "../lib/clock";
import { catchRef, db, userRef } from "../lib/db";
import { planFavorites } from "../lib/favorites";
import { requirePlayer } from "../lib/guards";

const MESSAGES = {
  "bad-input": "Pick exactly 2 different Lingos.",
  "not-caught": "You can only pick Lingos you've already caught.",
  "no-changes": "You've already used your one favourite change.",
} as const;

export const setFavorites = onCall<unknown, Promise<SetFavoritesOutput>>(async (req) => {
  const { uid, config } = await requirePlayer(req, await serverNow());
  const requested = (req.data as { lingoIds?: unknown } | undefined)?.lingoIds;

  return db().runTransaction(async (tx) => {
    const [userSnap, catchesSnap] = await Promise.all([
      tx.get(userRef(uid)),
      tx.get(userRef(uid).collection(COL.catches)),
    ]);
    const user = userSnap.data() as UserDoc;
    const caught = new Set(
      catchesSnap.docs.filter((d) => (d.data() as CatchDoc).timesCaught > 0).map((d) => d.id),
    );
    const plan = planFavorites({
      current: user.favorites ?? [],
      changesLeft: user.favoriteChangesLeft ?? 0,
      requested,
      caught,
      count: config.rules.favoritesCount,
      keepStreaksOnFirstPick: (config.rounds?.length ?? 0) > 0,
    });
    if ("error" in plan) {
      throw new HttpsError(plan.error === "no-changes" ? "failed-precondition" : "invalid-argument", MESSAGES[plan.error], {
        code: plan.error,
      });
    }
    if (plan.changed) {
      tx.update(userRef(uid), { favorites: plan.favorites, favoriteChangesLeft: plan.favoriteChangesLeft });
      // Replaced and new favourites start at streak 0 (levels are kept).
      for (const id of plan.resetStreak) tx.update(catchRef(uid, id), { favStreak: 0 });
    }
    return { favorites: plan.favorites, favoriteChangesLeft: plan.favoriteChangesLeft };
  });
});
