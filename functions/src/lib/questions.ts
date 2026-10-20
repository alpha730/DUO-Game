import {
  QUESTION_LEVELS,
  QUESTION_TYPES,
  type CatchDoc,
  type IstDate,
  type QuestionCounts,
  type QuestionDoc,
  type QuestionLevel,
  type QuestionType,
  type QuestionUpload,
} from "../shared/types";
import { parseChallenge } from "./challenge";
import { isPreviousPeriod } from "./date";

/** SPEC §9: a favourite's catch on its 6th streak day or later gets a hard question. */
export const HARD_FROM_STREAK_DAY = 6;
/** SPEC §9: question type weights when picking. */
export const TYPE_WEIGHTS: Record<QuestionType, number> = { meaning: 0.4, question: 0.4, pronounce: 0.2 };
/** Firestore writes per batch (all-or-nothing upload). */
export const MAX_POOL_WRITES = 500;

export interface PoolQuestion {
  id: string;
  doc: QuestionDoc;
}

/**
 * The favourite-streak day this catch would be (SPEC §9): a favourite caught yesterday (IST) →
 * its streak + 1; anything else → 1.
 */
export function streakDayFor(favorite: boolean, c: Pick<CatchDoc, "lastCaughtDate" | "favStreak"> | undefined, today: IstDate): number {
  if (!favorite || !c || !isPreviousPeriod(c.lastCaughtDate, today)) return 1;
  return (c.favStreak ?? 0) + 1;
}

/** Favourite on streak day ≥ `hardFrom` (rules.hardFromStreakDay: 6, one-day event 2) → hard; else medium. */
export const levelFor = (favorite: boolean, streakDay: number, hardFrom: number = HARD_FROM_STREAK_DAY): QuestionLevel =>
  favorite && streakDay >= hardFrom ? "hard" : "medium";

/** The word a question is about (meaning/pronounce: the word; question: the blank's answer). */
export const targetWord = (q: QuestionDoc): string => (q.type === "question" ? q.target : q.word).trim().toLowerCase();

/** Types in weighted-random order: the first is drawn by TYPE_WEIGHTS, then the rest, and so on. */
export function weightedTypeOrder(types: readonly QuestionType[], rand: () => number): QuestionType[] {
  const left = [...types];
  const out: QuestionType[] = [];
  while (left.length) {
    const total = left.reduce((s, t) => s + TYPE_WEIGHTS[t], 0);
    let r = rand() * total;
    let i = left.findIndex((t) => (r -= TYPE_WEIGHTS[t]) < 0);
    if (i < 0) i = left.length - 1;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Picks the question for a try (SPEC §9). Type by weight (meaning 40 / question 40 / pronounce 20);
 * then a random question of that level + type this player hasn't seen and whose word they haven't
 * had today. Runs out → another type → repeats (still avoiding today's words) → anything of the
 * level → the other level. `allowVoice: false` (no speech recognition) leaves pronounce out.
 */
export function pickQuestion(
  pool: readonly PoolQuestion[],
  opts: { level: QuestionLevel; seen: ReadonlySet<string>; wordsToday: ReadonlySet<string>; allowVoice: boolean; rand?: () => number },
): PoolQuestion | null {
  const rand = opts.rand ?? Math.random;
  const types = QUESTION_TYPES.filter((t) => opts.allowVoice || t !== "pronounce");
  const order = weightedTypeOrder(types, rand);
  const levels: QuestionLevel[] = [opts.level, ...QUESTION_LEVELS.filter((l) => l !== opts.level)];
  const passes: Array<(q: PoolQuestion) => boolean> = [
    (q) => !opts.seen.has(q.id) && !opts.wordsToday.has(targetWord(q.doc)),
    (q) => !opts.wordsToday.has(targetWord(q.doc)),
    () => true,
  ];
  for (const level of levels) {
    for (const ok of passes) {
      for (const type of order) {
        const c = pool.filter((q) => q.doc.level === level && q.doc.type === type && ok(q));
        if (c.length) return c[Math.floor(rand() * c.length)];
      }
    }
  }
  return null;
}

const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

export interface PoolRowError {
  /** 1-based row (0 = the whole upload) */
  row: number;
  message: string;
}

/**
 * Validates a question pool upload (scripts/loadQuestions.ts and /admin). Every row: unique id,
 * level medium|hard, type meaning|question|pronounce, its fields (4 different options and
 * correctIndex 0–3 for meaning/question; `target` for question), an explanation. All-or-nothing:
 * any error → nothing to write. Pure.
 */
export function parseQuestionPool(rows: unknown): { questions: PoolQuestion[] } | { errors: PoolRowError[] } {
  if (!Array.isArray(rows) || rows.length === 0) return { errors: [{ row: 0, message: "Upload a JSON array of questions." }] };
  if (rows.length >= MAX_POOL_WRITES) return { errors: [{ row: 0, message: `At most ${MAX_POOL_WRITES - 1} questions per pool.` }] };
  const errors: PoolRowError[] = [];
  const questions: PoolQuestion[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of rows.entries()) {
    const row = i + 1;
    const bad = (message: string) => errors.push({ row, message });
    const r = (raw ?? {}) as Record<string, unknown>;
    const id = typeof r.id === "string" && /^[\w-]{1,64}$/.test(r.id) ? r.id : null;
    if (!id) {
      bad("id must be letters, digits, - or _ (max 64).");
      continue;
    }
    if (ids.has(id)) {
      bad(`Duplicate id "${id}".`);
      continue;
    }
    ids.add(id);
    if (!QUESTION_LEVELS.includes(r.level as QuestionLevel)) {
      bad(`${id}: level must be medium or hard.`);
      continue;
    }
    if (!QUESTION_TYPES.includes(r.type as QuestionType)) {
      bad(`${id}: type must be meaning, question or pronounce.`);
      continue;
    }
    const explanation = text(r.explanation, 300);
    if (!explanation) {
      bad(`${id}: explanation is missing.`);
      continue;
    }
    const ch = parseChallenge(r);
    if (!ch || ch.type === "speak") {
      bad(`${id}: bad ${String(r.type)} — meaning/question need 4 different options and correctIndex 0–3; meaning/pronounce need a word; question needs a prompt.`);
      continue;
    }
    const level = r.level as QuestionLevel;
    if (ch.type === "question") {
      const target = text(r.target, 40);
      if (!target) {
        bad(`${id}: question needs its target word.`);
        continue;
      }
      questions.push({ id, doc: { ...ch, target, level, explanation } });
    } else {
      questions.push({ id, doc: { ...ch, level, explanation } });
    }
  }
  return errors.length ? { errors } : { questions };
}

/** Counts per level × type (for /admin and the load script). */
export function countQuestions(qs: ReadonlyArray<{ doc: Pick<QuestionDoc, "level" | "type"> }>): QuestionCounts {
  const counts = Object.fromEntries(QUESTION_LEVELS.flatMap((l) => QUESTION_TYPES.map((t) => [`${l}/${t}`, 0]))) as QuestionCounts;
  for (const q of qs) counts[`${q.doc.level}/${q.doc.type}`]++;
  return counts;
}

/** Back to an upload row (for exports / round trips). */
export const toUpload = (q: PoolQuestion): QuestionUpload => ({ id: q.id, ...q.doc });
