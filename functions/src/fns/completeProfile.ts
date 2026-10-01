import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  COL,
  DEFAULT_RULES,
  DEPARTMENTS,
  YEARS,
  type CompleteProfileInput,
  type CompleteProfileOutput,
  type Department,
  type Year,
} from "../shared/types";
import { db, loadConfig, userRef } from "../lib/db";
import { requireAuth } from "../lib/guards";

// DECISION: roll numbers are letters, digits and dashes (3–20 chars); "/" is not allowed because
// the roll is used as a Firestore document id.
const ROLL_RE = /^[A-Z0-9-]{3,20}$/;

export function parseProfile(data: unknown): CompleteProfileInput {
  const d = (data ?? {}) as Record<string, unknown>;
  const name = typeof d.name === "string" ? d.name.trim().replace(/\s+/g, " ") : "";
  const roll = typeof d.roll === "string" ? d.roll.trim().toUpperCase() : "";
  const year = Number(d.year);

  if (name.length < 2 || name.length > 60) throw new HttpsError("invalid-argument", "Enter your name (2–60 letters).");
  if (!DEPARTMENTS.includes(d.dept as Department)) throw new HttpsError("invalid-argument", "Pick your department.");
  if (!YEARS.includes(year as Year)) throw new HttpsError("invalid-argument", "Pick your year.");
  if (!ROLL_RE.test(roll)) throw new HttpsError("invalid-argument", "Enter a valid roll number (letters and digits).");

  return { name, dept: d.dept as Department, year: year as Year, roll };
}

export const completeProfile = onCall<unknown, Promise<CompleteProfileOutput>>(async (req) => {
  const uid = requireAuth(req);
  const { name, dept, year, roll } = parseProfile(req.data);
  const email = (req.auth?.token.email as string | undefined) ?? "";
  const rules = (await loadConfig())?.rules ?? DEFAULT_RULES;

  const rollRef = db().collection(COL.rollNumbers).doc(roll);
  const uRef = userRef(uid);

  await db().runTransaction(async (tx) => {
    const [rollSnap, userSnap] = await Promise.all([tx.get(rollRef), tx.get(uRef)]);
    if (userSnap.data()?.profileDone) {
      throw new HttpsError("already-exists", "Your profile is already set up.", { code: "profile-done" });
    }
    if (rollSnap.exists) {
      throw new HttpsError("already-exists", "This roll number is already registered.", { code: "roll-taken" });
    }

    tx.create(rollRef, { uid });
    tx.set(uRef, {
      name,
      email,
      dept,
      year,
      roll,
      points: 0,
      attemptsToday: 0,
      attemptsDate: null,
      dayStreak: 0,
      lastPlayDate: null,
      lingosCaught: 0,
      allTenBonus: false,
      favorites: [],
      favoriteChangesLeft: rules.favoriteChanges,
      profileDone: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
