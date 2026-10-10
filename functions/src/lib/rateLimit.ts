import { HttpsError } from "firebase-functions/v2/https";
import { COL } from "../shared/types";
import { db } from "./db";

// Rate limits per user, server side (anti-cheat E): a fixed one-minute window in limits/{uid}.
// A human taps a few times a minute; a script hammering the functions is told to slow down.
export const CALLS_PER_MINUTE = 30;
export const STARTS_PER_MINUTE = 6;

interface LimitDoc {
  minute: number;
  calls: number;
  starts: number;
}

/** Pure: the counters after one more call, or null if that call is over a limit. */
export function nextCount(prev: LimitDoc | undefined, minute: number, start: boolean): LimitDoc | null {
  const same = prev?.minute === minute;
  const calls = (same ? prev!.calls : 0) + 1;
  const starts = (same ? prev!.starts : 0) + (start ? 1 : 0);
  return calls > CALLS_PER_MINUTE || starts > STARTS_PER_MINUTE ? null : { minute, calls, starts };
}

/**
 * Counts one call for `uid` (startAttempt also counts as a start); throws "Slow down" when over.
 * A refused call isn't counted, so waiting out the minute always works. One small transaction on
 * the user's own counter doc — no contention between players.
 */
export async function rateLimit(uid: string, kind: "call" | "start" = "call", now = Date.now()): Promise<void> {
  const ref = db().collection(COL.limits).doc(uid);
  const minute = Math.floor(now / 60_000);
  const ok = await db().runTransaction(async (tx) => {
    const next = nextCount((await tx.get(ref)).data() as LimitDoc | undefined, minute, kind === "start");
    if (next) tx.set(ref, next);
    return next !== null;
  });
  if (!ok) {
    throw new HttpsError("resource-exhausted", "Slow down — that's a lot of tries in one minute. Wait a moment and try again.", {
      code: "slow-down",
    });
  }
}
