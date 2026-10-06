import { DEFAULT_RULES, type GameRules } from "../shared/types";

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
