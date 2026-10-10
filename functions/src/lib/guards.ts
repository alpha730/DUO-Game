import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { GameConfigDoc, Role, UserDoc } from "../shared/types";
import { loadConfig, userRef } from "./db";
import { rateLimit } from "./rateLimit";

/** Signed in → returns uid. */
export function requireAuth(req: Pick<CallableRequest, "auth">): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Please sign in.");
  return uid;
}

/** Profile done → returns the user doc. */
export async function requireProfile(uid: string): Promise<UserDoc> {
  const snap = await userRef(uid).get();
  const user = snap.data() as UserDoc | undefined;
  if (!user?.profileDone) throw new HttpsError("failed-precondition", "Finish your profile first.", { code: "no-profile" });
  if (user.disabled) {
    throw new HttpsError("permission-denied", "This account has been paused by the organisers. Please talk to them at the help desk.", {
      code: "disabled",
    });
  }
  return user;
}

/** Why the game is closed at `now`, or null if open. Pure, for tests. */
export function gameClosedReason(config: Pick<GameConfigDoc, "startAt" | "lockAt" | "locked">, now: number) {
  if (config.locked) return "locked";
  if (now < config.startAt.toMillis()) return "not-started";
  if (now >= config.lockAt.toMillis()) return "locked";
  return null;
}

/** Game open (startAt ≤ now < lockAt, locked == false) → returns config. */
export async function requireGameOpen(now = Date.now()): Promise<GameConfigDoc> {
  const config = await loadConfig();
  if (!config) throw new HttpsError("failed-precondition", "Game is not configured.", { code: "no-config" });
  const reason = gameClosedReason(config, now);
  if (reason === "not-started") {
    throw new HttpsError("failed-precondition", "The hunt hasn't started yet.", {
      code: reason,
      startAt: config.startAt.toMillis(),
    });
  }
  if (reason === "locked") throw new HttpsError("failed-precondition", "The hunt is over.", { code: reason });
  return config;
}

/** Caller has one of `roles` (custom claim `role`) → returns uid. */
export function requireRole(req: Pick<CallableRequest, "auth">, roles: Role[]): string {
  const uid = requireAuth(req);
  const role = req.auth?.token?.role as Role | undefined;
  if (!role || !roles.includes(role)) throw new HttpsError("permission-denied", "Not allowed.");
  return uid;
}

/** Only verified emails play (anti-cheat F): Google accounts are verified; email/password must click the link. */
export function requireVerified(req: Pick<CallableRequest, "auth">): void {
  if (req.auth?.token?.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verify your email first.", { code: "unverified" });
  }
}

/**
 * All of CLAUDE.md rule 6 in one call, for player-facing callables: signed in, verified email,
 * within the rate limit (startAttempt counts as a start too), profile done and not disabled, game open.
 */
export async function requirePlayer(req: Pick<CallableRequest, "auth">, now = Date.now(), kind: "call" | "start" = "call") {
  const uid = requireAuth(req);
  requireVerified(req);
  await rateLimit(uid, kind, now);
  const [user, config] = await Promise.all([requireProfile(uid), requireGameOpen(now)]);
  return { uid, user, config };
}
