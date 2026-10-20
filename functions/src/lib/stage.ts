import { randomInt } from "node:crypto";
import type { StageQuestion, StageReveal } from "../shared/types";
import { publicChallenge, shuffledOrder } from "./challenge";
import type { PoolQuestion } from "./questions";

/** Sudden-death questions: Hard, and a tap on one of 4 options (meaning or fill in the blank). */
export const isStageQuestion = (q: PoolQuestion) => q.doc.level === "hard" && (q.doc.type === "meaning" || q.doc.type === "question");

/**
 * One random stage question not in `seen` (pure but for the RNG), or null when all were shown. The
 * options come in a new random order and never with the answer (CLAUDE.md rule 4).
 */
export function pickStageQuestion(
  pool: readonly PoolQuestion[],
  seen: ReadonlySet<string>,
  rand: (max: number) => number = randomInt,
): StageQuestion | null {
  const left = pool.filter((q) => isStageQuestion(q) && !seen.has(q.id));
  if (!left.length) return null;
  const q = left[rand(left.length)];
  const view = publicChallenge(q.doc, shuffledOrder(4, rand));
  return {
    id: q.id,
    type: view.type as StageQuestion["type"],
    ...(view.word !== undefined ? { word: view.word } : {}),
    ...(view.prompt !== undefined ? { prompt: view.prompt } : {}),
    options: view.options ?? [],
    left: left.length - 1,
  };
}

/** The answer of stage question `id` (null if it isn't one). */
export function stageReveal(pool: readonly PoolQuestion[], id: string): StageReveal | null {
  const q = pool.find((x) => x.id === id);
  if (!q || !isStageQuestion(q) || !("correctIndex" in q.doc)) return null;
  return { id, answer: q.doc.options[q.doc.correctIndex], ...(q.doc.explanation ? { explanation: q.doc.explanation } : {}) };
}
