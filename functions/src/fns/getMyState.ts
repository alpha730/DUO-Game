import { onCall } from "firebase-functions/v2/https";
import { COL, DEFAULT_RULES, type CatchDoc, type GetMyStateOutput, type UserDoc } from "../shared/types";
import { istDate } from "../lib/date";
import { db, loadConfig, userRef } from "../lib/db";
import { requireAuth } from "../lib/guards";
import { attemptsLeft, catchView, userView } from "../lib/state";

/** Marks every open attempt of `uid` as forfeit (SPEC §3.5). Returns how many were closed. */
export async function forfeitOpenAttempts(uid: string): Promise<number> {
  const open = await db().collection(COL.attempts).where("uid", "==", uid).where("status", "==", "open").get();
  if (open.empty) return 0;
  const batch = db().batch();
  open.docs.forEach((d) => batch.update(d.ref, { status: "forfeit" }));
  await batch.commit();
  return open.size;
}

// SPEC §5: no profile / game-open check — Home and Scan call this before the game starts too.
export const getMyState = onCall<unknown, Promise<GetMyStateOutput>>(async (req) => {
  const uid = requireAuth(req);
  const now = Date.now();
  const today = istDate(now);

  const [, userSnap, catchesSnap, config] = await Promise.all([
    forfeitOpenAttempts(uid),
    userRef(uid).get(),
    userRef(uid).collection(COL.catches).get(),
    loadConfig(),
  ]);
  const rules = config?.rules ?? DEFAULT_RULES;
  const user = userSnap.exists ? (userSnap.data() as UserDoc) : null;

  return {
    user: user ? userView(user, today) : null,
    catches: catchesSnap.docs.map((d) => catchView(d.id, d.data() as CatchDoc)),
    serverNow: now,
    today,
    attemptsLeft: user ? attemptsLeft(user, today, rules) : rules.attemptsPerDay,
    attemptsPerDay: rules.attemptsPerDay,
  };
});
