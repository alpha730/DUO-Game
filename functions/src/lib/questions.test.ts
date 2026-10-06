import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { QuestionDoc } from "../shared/types";
import { countQuestions, levelFor, parseQuestionPool, pickQuestion, streakDayFor, targetWord, weightedTypeOrder, type PoolQuestion } from "./questions";

const TODAY = "2026-10-15";
const YESTERDAY = "2026-10-14";

const meaning = (id: string, word: string, level: "medium" | "hard" = "medium"): PoolQuestion => ({
  id,
  doc: { type: "meaning", word, options: ["a", "b", "c", "d"], correctIndex: 0, level, explanation: "x" },
});
const fill = (id: string, target: string, level: "medium" | "hard" = "medium"): PoolQuestion => ({
  id,
  doc: { type: "question", prompt: "The ___ one.", target, options: [target, "b", "c", "d"], correctIndex: 0, level, explanation: "x" },
});
const say = (id: string, word: string, level: "medium" | "hard" = "medium"): PoolQuestion => ({
  id,
  doc: { type: "pronounce", word, level, explanation: "x" },
});
/** A rand() that returns the given values in turn (then 0). */
const seq = (...v: number[]) => () => v.shift() ?? 0;
const pick = (pool: PoolQuestion[], o: Partial<Parameters<typeof pickQuestion>[1]> = {}) =>
  pickQuestion(pool, { level: "medium", seen: new Set(), wordsToday: new Set(), allowVoice: true, ...o });

describe("difficulty (SPEC §9)", () => {
  it("non-favourite → streak day 1 → medium", () => {
    const day = streakDayFor(false, { lastCaughtDate: YESTERDAY, favStreak: 8 }, TODAY);
    expect(day).toBe(1);
    expect(levelFor(false, day)).toBe("medium");
  });
  it("favourite caught yesterday on day 4 → day 5 → medium; on day 5 → day 6 → hard", () => {
    expect(levelFor(true, streakDayFor(true, { lastCaughtDate: YESTERDAY, favStreak: 4 }, TODAY))).toBe("medium");
    expect(streakDayFor(true, { lastCaughtDate: YESTERDAY, favStreak: 5 }, TODAY)).toBe(6);
    expect(levelFor(true, 6)).toBe("hard");
    expect(levelFor(true, 11)).toBe("hard");
  });
  it("favourite with a broken streak (not caught yesterday) → day 1 → medium", () => {
    expect(streakDayFor(true, { lastCaughtDate: "2026-10-12", favStreak: 9 }, TODAY)).toBe(1);
    expect(streakDayFor(true, undefined, TODAY)).toBe(1);
  });
});

describe("pickQuestion", () => {
  const pool = [meaning("m1", "abundant"), fill("q1", "feasible"), say("p1", "candid"), meaning("h1", "laconic", "hard")];

  it("draws the type by weight: meaning 40 / question 40 / pronounce 20", () => {
    expect(pick(pool, { rand: seq(0.1) })?.id).toBe("m1"); // < 0.4
    expect(pick(pool, { rand: seq(0.5) })?.id).toBe("q1"); // 0.4–0.8
    expect(pick(pool, { rand: seq(0.9) })?.id).toBe("p1"); // ≥ 0.8
    const counts = { meaning: 0, question: 0, pronounce: 0 };
    let x = 0;
    const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 6000; i++) counts[weightedTypeOrder(["meaning", "question", "pronounce"], rand)[0]]++;
    expect(counts.meaning / 6000).toBeCloseTo(0.4, 1);
    expect(counts.question / 6000).toBeCloseTo(0.4, 1);
    expect(counts.pronounce / 6000).toBeCloseTo(0.2, 1);
  });
  it("only picks the asked level", () => {
    expect(pick(pool, { level: "hard" })?.id).toBe("h1");
  });
  it("skips questions the player has seen", () => {
    const two = [meaning("m1", "abundant"), meaning("m2", "brief")];
    expect(pick(two, { seen: new Set(["m1"]), rand: seq(0, 0) })?.id).toBe("m2");
  });
  it("skips a word the player already had today (any type)", () => {
    const p = [meaning("m1", "abundant"), say("p1", "Abundant"), fill("q1", "feasible")];
    expect(pick(p, { wordsToday: new Set(["abundant"]), rand: seq(0.1, 0, 0) })?.id).toBe("q1");
  });
  it("falls back to another type when one runs out, then allows repeats", () => {
    const p = [meaning("m1", "abundant"), fill("q1", "feasible")];
    // meaning drawn, but seen → question
    expect(pick(p, { seen: new Set(["m1"]), rand: seq(0.1, 0, 0) })?.id).toBe("q1");
    // everything seen → a repeat (still not today's word)
    expect(pick(p, { seen: new Set(["m1", "q1"]), wordsToday: new Set(["abundant"]), rand: seq(0.1, 0, 0) })?.id).toBe("q1");
    // everything seen and both words used today → still something
    expect(pick(p, { seen: new Set(["m1", "q1"]), wordsToday: new Set(["abundant", "feasible"]) })).not.toBeNull();
  });
  it("uses the other level only when its own level is empty", () => {
    expect(pick([meaning("h1", "laconic", "hard")], { level: "medium" })?.id).toBe("h1");
  });
  it("never picks pronounce without speech recognition", () => {
    expect(pick([say("p1", "candid"), meaning("m1", "abundant")], { allowVoice: false, rand: seq(0.9) })?.id).toBe("m1");
    expect(pick([say("p1", "candid")], { allowVoice: false })).toBeNull();
  });
  it("returns null for an empty pool", () => {
    expect(pick([])).toBeNull();
  });
});

describe("targetWord", () => {
  it("is the word (meaning, pronounce) or the blank's answer (question), lowercased", () => {
    expect(targetWord(meaning("m", "Abundant").doc)).toBe("abundant");
    expect(targetWord(fill("q", "Feasible").doc)).toBe("feasible");
    expect(targetWord(say("p", "candid").doc)).toBe("candid");
  });
});

describe("parseQuestionPool", () => {
  const good = { id: "m-1", level: "medium", type: "meaning", word: "abundant", options: ["a", "b", "c", "d"], correctIndex: 2, explanation: "plenty" };
  it("accepts valid rows of each type", () => {
    const out = parseQuestionPool([
      good,
      { id: "q-1", level: "hard", type: "question", prompt: "It is ___.", target: "feasible", options: ["feasible", "b", "c", "d"], correctIndex: 0, explanation: "possible" },
      { id: "p-1", level: "medium", type: "pronounce", word: "candid", explanation: "honest" },
    ]);
    expect("questions" in out && out.questions.map((q) => q.id)).toEqual(["m-1", "q-1", "p-1"]);
  });
  it("rejects duplicate ids, bad options, bad correctIndex, bad level/type — all-or-nothing", () => {
    const out = parseQuestionPool([
      good,
      { ...good }, // duplicate id
      { ...good, id: "m-2", options: ["a", "a", "c", "d"] },
      { ...good, id: "m-3", correctIndex: 4 },
      { ...good, id: "m-4", level: "easy" },
      { ...good, id: "m-5", type: "speak" },
      { ...good, id: "m-6", options: ["a", "b", "c"] },
      { id: "q-2", level: "medium", type: "question", prompt: "x ___", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "e" }, // no target
      { ...good, id: "m-7", explanation: "" },
    ]);
    expect("errors" in out && out.errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("rejects a non-array or empty upload", () => {
    expect(parseQuestionPool({})).toHaveProperty("errors");
    expect(parseQuestionPool([])).toHaveProperty("errors");
  });
  it("the real pool file is valid: 456 questions, unique, counts per level × type", () => {
    const rows = JSON.parse(readFileSync(new URL("../../../scripts/content/question-pool-2026.json", import.meta.url), "utf8"));
    const out = parseQuestionPool(rows);
    if ("errors" in out) throw new Error(JSON.stringify(out.errors.slice(0, 5)));
    expect(out.questions).toHaveLength(456);
    expect(countQuestions(out.questions)).toEqual({
      "medium/meaning": 100,
      "medium/question": 100,
      "medium/pronounce": 30,
      "hard/meaning": 100,
      "hard/question": 96,
      "hard/pronounce": 30,
    });
    // Never a public field that gives the answer away: the blank's answer is one of the options.
    for (const q of out.questions) {
      const d = q.doc as QuestionDoc;
      if (d.type === "question") expect(d.options).toContain(d.target);
    }
  });
});
