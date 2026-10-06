import { COL, type ChallengeDoc, type QuestionDoc } from "../shared/types";
import { db } from "./db";
import { isEmulator } from "./geo";
import type { PoolQuestion } from "./questions";

/** SPEC §9 cost rule: the pool is read once per function instance and refreshed every 10 minutes. */
export const POOL_TTL_MS = 10 * 60_000;

let cache: { at: number; version: string | null; questions: PoolQuestion[] } | null = null;
let loading: Promise<PoolQuestion[]> | null = null;

/**
 * Emulator only: tests bump `_emulator/questions.version` after changing the pool, so the cached
 * copy is dropped at once (production waits for the 10-minute refresh).
 */
async function emulatorVersion(): Promise<string | null> {
  if (!isEmulator()) return null;
  return ((await db().doc("_emulator/questions").get()).data()?.version as string | undefined) ?? null;
}

/** The whole pool from memory (≈ 456 docs read once per instance per 10 min, not per attempt). */
export async function questionPool(): Promise<PoolQuestion[]> {
  const version = await emulatorVersion();
  if (cache && Date.now() - cache.at < POOL_TTL_MS && cache.version === version) return cache.questions;
  // Many first calls on a cold instance share one read.
  loading ??= db()
    .collection(COL.questions)
    .get()
    .then((snap) => {
      const questions = snap.docs.map((d) => ({ id: d.id, doc: d.data() as QuestionDoc }));
      cache = { at: Date.now(), version, questions };
      return questions;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** After an admin upload in this instance: use the new pool straight away. */
export function dropPoolCache(): void {
  cache = null;
}

/**
 * Emulator only (like `_emulator/clock`): `_emulator/pins` = { until: ms, byLingo: { lingoId: challenge } }
 * fixes the question a Lingo asks, so browser tests stay deterministic. Ignored in production and
 * after `until`.
 */
export async function pinnedQuestion(lingoId: string): Promise<ChallengeDoc | null> {
  if (!isEmulator()) return null;
  const pins = (await db().doc("_emulator/pins").get()).data() as { until?: number; byLingo?: Record<string, ChallengeDoc> } | undefined;
  if (!pins?.byLingo?.[lingoId] || !(typeof pins.until === "number" && pins.until > Date.now())) return null;
  return pins.byLingo[lingoId];
}
