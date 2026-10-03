import { DEFAULT_RULES, LINGO_COUNT, challengeId, type ChallengeDoc, type GameRules } from "../shared/types";
import { parseChallenge } from "./challenge";
import { addDays, istDate } from "./date";

export interface ConfigPatch {
  startAt?: number;
  lockAt?: number;
  locked?: boolean;
  campusLat?: number;
  campusLng?: number;
  campusRadiusM?: number;
  rules?: Partial<GameRules>;
}

const RATIO_RULES = new Set<keyof GameRules>(["speakPassRatio"]);

/**
 * Validates an admin config edit (PLAN 7.2) against the current times. Pure. Only known fields;
 * numbers must be sensible; startAt < lockAt after the change. Rules: known keys only, whole numbers
 * ≥ 0 (speakPassRatio 0–1).
 */
export function parseConfigPatch(
  input: unknown,
  current: { startAt: number; lockAt: number },
): { patch: ConfigPatch } | { error: string } {
  const d = (input ?? {}) as Record<string, unknown>;
  const patch: ConfigPatch = {};
  const known = new Set(["startAt", "lockAt", "locked", "campusLat", "campusLng", "campusRadiusM", "rules"]);
  const unknown = Object.keys(d).find((k) => !known.has(k));
  if (unknown) return { error: `Unknown setting "${unknown}".` };

  for (const k of ["startAt", "lockAt"] as const) {
    if (d[k] === undefined) continue;
    if (typeof d[k] !== "number" || !Number.isFinite(d[k])) return { error: `${k} must be a time.` };
    patch[k] = d[k] as number;
  }
  if ((patch.startAt ?? current.startAt) >= (patch.lockAt ?? current.lockAt)) return { error: "The start must be before the lock time." };
  if (d.locked !== undefined) {
    if (typeof d.locked !== "boolean") return { error: "locked must be true or false." };
    patch.locked = d.locked;
  }
  const num = (k: "campusLat" | "campusLng" | "campusRadiusM", min: number, max: number) => {
    if (d[k] === undefined) return null;
    const v = d[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return `${k} must be between ${min} and ${max}.`;
    patch[k] = v;
    return null;
  };
  const e = num("campusLat", -90, 90) ?? num("campusLng", -180, 180) ?? num("campusRadiusM", 50, 20_000);
  if (e) return { error: e };

  if (d.rules !== undefined) {
    if (typeof d.rules !== "object" || d.rules === null || Array.isArray(d.rules)) return { error: "rules must be an object." };
    const rules: Partial<GameRules> = {};
    for (const [k, v] of Object.entries(d.rules)) {
      if (!(k in DEFAULT_RULES)) return { error: `Unknown rule "${k}".` };
      const key = k as keyof GameRules;
      const okRatio = RATIO_RULES.has(key) && typeof v === "number" && v > 0 && v <= 1;
      const okInt = !RATIO_RULES.has(key) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100_000;
      if (!okRatio && !okInt) return { error: `Rule "${k}" has a bad value.` };
      rules[key] = v as number;
    }
    patch.rules = rules;
  }
  return { patch };
}

/** A real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
function isRealDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

export interface UploadRowError {
  row: number;
  message: string;
}

/**
 * Validates a challenges upload (PLAN 7.2): every row a valid challenge (4 different options,
 * correctIndex 0–3), a known Lingo, a date between the game's first and last IST day, and no
 * duplicate date × Lingo. All-or-nothing: any error → nothing is written. Pure.
 */
export function parseChallengeUpload(
  rows: unknown,
  range: { startAt: number; lockAt: number },
  lingoIds: ReadonlySet<string>,
): { docs: Array<{ id: string; doc: ChallengeDoc }> } | { errors: UploadRowError[] } {
  if (!Array.isArray(rows) || rows.length === 0) return { errors: [{ row: 0, message: "Upload a JSON array of challenges." }] };
  if (rows.length > 1000) return { errors: [{ row: 0, message: "At most 1000 challenges per upload." }] };
  const first = istDate(range.startAt);
  const last = istDate(range.lockAt - 1); // lockAt is exclusive
  const errors: UploadRowError[] = [];
  const docs: Array<{ id: string; doc: ChallengeDoc }> = [];
  const seen = new Set<string>();

  rows.forEach((raw, i) => {
    const row = i + 1;
    const r = (raw ?? {}) as Record<string, unknown>;
    const { date, lingoId, ...rest } = r;
    if (!isRealDate(date)) {
      errors.push({ row, message: "date must be YYYY-MM-DD." });
      return;
    }
    if (date < first || date > last) {
      errors.push({ row, message: `date ${date} is outside the game (${first} … ${last}).` });
      return;
    }
    if (typeof lingoId !== "string" || !lingoIds.has(lingoId)) {
      errors.push({ row, message: `Unknown Lingo "${String(lingoId)}".` });
      return;
    }
    const doc = parseChallenge(rest);
    if (!doc) {
      errors.push({ row, message: "Bad challenge: check the type and its fields (meaning/question need 4 different options and correctIndex 0–3)." });
      return;
    }
    const id = challengeId(date, lingoId);
    if (seen.has(id)) {
      errors.push({ row, message: `Duplicate: ${date} × ${lingoId}.` });
      return;
    }
    seen.add(id);
    docs.push({ id, doc });
  });
  return errors.length ? { errors } : { docs };
}

/** Days × Lingos without a challenge in the given set of challenge ids (for the admin's check). */
export function missingChallenges(range: { startAt: number; lockAt: number }, lingoIds: string[], have: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const last = istDate(range.lockAt - 1);
  for (let d = istDate(range.startAt); d <= last; d = addDays(d, 1)) {
    for (const l of lingoIds.slice(0, LINGO_COUNT)) if (!have.has(challengeId(d, l))) out.push(challengeId(d, l));
  }
  return out;
}
