import { DEFAULT_RULES, MAX_CAMPUSES, type Campus, type GameRules } from "../shared/types";

export interface ConfigPatch {
  startAt?: number;
  lockAt?: number;
  locked?: boolean;
  campuses?: Campus[];
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
  const known = new Set(["startAt", "lockAt", "locked", "campuses", "rules"]);
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
  if (d.campuses !== undefined) {
    const parsed = parseCampuses(d.campuses);
    if ("error" in parsed) return parsed;
    patch.campuses = parsed.campuses;
  }

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

/** 1–MAX_CAMPUSES campuses, each {name, lat, lng, radiusM} with a unique name and sensible numbers. */
export function parseCampuses(input: unknown): { campuses: Campus[] } | { error: string } {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_CAMPUSES) {
    return { error: `Set 1 to ${MAX_CAMPUSES} campuses.` };
  }
  const campuses: Campus[] = [];
  for (const [i, raw] of input.entries()) {
    const c = (raw ?? {}) as Record<string, unknown>;
    const label = `Campus ${i + 1}`;
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!name || name.length > 60) return { error: `${label} needs a name (up to 60 characters).` };
    if (campuses.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { error: `Two campuses are called "${name}".` };
    const num = (k: "lat" | "lng" | "radiusM", min: number, max: number) =>
      typeof c[k] === "number" && Number.isFinite(c[k]) && (c[k] as number) >= min && (c[k] as number) <= max;
    if (!num("lat", -90, 90)) return { error: `${label}: latitude must be between -90 and 90.` };
    if (!num("lng", -180, 180)) return { error: `${label}: longitude must be between -180 and 180.` };
    if (!num("radiusM", 50, 20_000)) return { error: `${label}: radius must be 50–20000 m.` };
    campuses.push({ name, lat: c.lat as number, lng: c.lng as number, radiusM: c.radiusM as number });
  }
  return { campuses };
}
