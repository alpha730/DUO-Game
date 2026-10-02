import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { DEFAULT_RULES, NAME_MAX, NAME_MIN, type CompleteProfileInput, type CompleteProfileOutput } from "../shared/types";
import { db, loadConfig, userRef } from "../lib/db";
import { requireAuth } from "../lib/guards";

/** Name only (SPEC §4): trimmed, inner spaces collapsed, 2–40 characters. */
export function parseProfile(data: unknown): CompleteProfileInput {
  const d = (data ?? {}) as Record<string, unknown>;
  const name = typeof d.name === "string" ? d.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new HttpsError("invalid-argument", `Enter your name (${NAME_MIN}–${NAME_MAX} characters).`);
  }
  return { name };
}

export const completeProfile = onCall<unknown, Promise<CompleteProfileOutput>>(async (req) => {
  const uid = requireAuth(req);
  // Fake-account guard (SPEC §4): Google accounts arrive verified; email/password users must click
  // the verification link first (the client refreshes its token afterwards).
  const token = req.auth!.token;
  if (!token.email || token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verify your email first.", { code: "email-unverified" });
  }
  const { name } = parseProfile(req.data);
  const rules = (await loadConfig())?.rules ?? DEFAULT_RULES;
  const uRef = userRef(uid);

  await db().runTransaction(async (tx) => {
    const userSnap = await tx.get(uRef);
    if (userSnap.data()?.profileDone) {
      throw new HttpsError("already-exists", "Your profile is already set up.", { code: "profile-done" });
    }
    tx.set(uRef, {
      name,
      email: token.email,
      points: 0,
      attemptsToday: 0,
      attemptsDate: null,
      dayStreak: 0,
      lastPlayDate: null,
      lingosCaught: 0,
      allTenBonus: false,
      favorites: [],
      favoriteChangesLeft: rules.favoriteChanges,
      wins: 0,
      losses: 0,
      totalAnswerMs: 0,
      pointsReachedAt: null,
      profileDone: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
