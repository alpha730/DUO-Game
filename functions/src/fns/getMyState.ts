import { onCall } from "firebase-functions/v2/https";
import { COL, DEFAULT_RULES, type CatchDoc, type GetMyStateOutput, type UserDoc } from "../shared/types";
import { serverNow } from "../lib/clock";
import { forfeitOpenAttempt } from "../lib/attempts";
import { istDate } from "../lib/date";
import { loadConfig, userRef } from "../lib/db";
import { requireAuth } from "../lib/guards";
import { attemptsLeft, catchView, userView } from "../lib/state";

// SPEC §5: no profile / game-open check — Home and Scan call this before the game starts too.
export const getMyState = onCall<unknown, Promise<GetMyStateOutput>>(async (req) => {
  const uid = requireAuth(req);
  const now = await serverNow();
  const today = istDate(now);

  let [userSnap, catchesSnap, config] = await Promise.all([
    userRef(uid).get(),
    userRef(uid).collection(COL.catches).get(),
    loadConfig(),
  ]);
  // Auto-forfeit (SPEC §3.5): only when the user doc points at an open attempt; then re-read the user
  // (losses changed).
  if (await forfeitOpenAttempt(uid, userSnap.data() as UserDoc | undefined)) userSnap = await userRef(uid).get();
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
