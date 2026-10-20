import { onCall } from "firebase-functions/v2/https";
import { COL, DEFAULT_RULES, type CatchDoc, type GetMyStateOutput, type UserDoc } from "../shared/types";
import { serverNow } from "../lib/clock";
import { forfeitOpenAttempt } from "../lib/attempts";
import { playPeriod } from "../lib/date";
import { loadConfig, userRef } from "../lib/db";
import { requireAuth } from "../lib/guards";
import { rateLimit } from "../lib/rateLimit";
import { attemptsLeft, catchView, userView } from "../lib/state";

// SPEC §5: no profile / game-open check — Home and Scan call this before the game starts too.
export const getMyState = onCall<unknown, Promise<GetMyStateOutput>>(async (req) => {
  const uid = requireAuth(req);
  const now = await serverNow();
  await rateLimit(uid, "call", now);
  let [userSnap, catchesSnap, config] = await Promise.all([
    userRef(uid).get(),
    userRef(uid).collection(COL.catches).get(),
    loadConfig(),
  ]);
  // Auto-forfeit (SPEC §3.5): only when the user doc points at an open attempt; then re-read the user
  // (losses changed).
  if (await forfeitOpenAttempt(uid, userSnap.data() as UserDoc | undefined, now)) userSnap = await userRef(uid).get();
  const rules = config?.rules ?? DEFAULT_RULES;
  // One-day event: per-day state is per round (the current one, or the next while waiting).
  const period = playPeriod(now, config);
  const today = period.key;
  const user = userSnap.exists ? (userSnap.data() as UserDoc) : null;

  return {
    user: user ? userView(user, today) : null,
    catches: catchesSnap.docs.map((d) => catchView(d.id, d.data() as CatchDoc)),
    serverNow: now,
    today,
    attemptsLeft: user ? attemptsLeft(user, today, rules) : rules.attemptsPerDay,
    attemptsPerDay: rules.attemptsPerDay,
    triesPerLingo: rules.triesPerLingoPerDay,
    startAt: config ? config.startAt.toMillis() : null,
    lockAt: config ? config.lockAt.toMillis() : null,
    locked: config?.locked ?? false,
    round: period.round,
  };
});
