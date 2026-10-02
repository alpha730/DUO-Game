import { describe, expect, it } from "vitest";
import type { ChallengeDoc } from "../shared/types";
import { scoreAnswer } from "./score";

const rules = { speakPassRatio: 0.8 };
const pronounce: ChallengeDoc = { type: "pronounce", word: "programme", accept: ["program"] };
const speak: ChallengeDoc = { type: "speak", phrase: "Practice every day and you will see the difference." };
const meaning: ChallengeDoc = { type: "meaning", word: "reluctant", options: ["unwilling", "excited", "tired", "careful"], correctIndex: 0 };
const question: ChallengeDoc = { type: "question", prompt: "She has been working here ___ 2022.", options: ["since", "for", "from", "at"], correctIndex: 0 };

describe("scoreAnswer", () => {
  it("pronounce: word or accepted spelling", () => {
    expect(scoreAnswer(pronounce, { transcript: "Programme" }, rules)).toEqual({ won: true, score: 1 });
    expect(scoreAnswer(pronounce, { transcript: "program" }, rules).won).toBe(true);
    expect(scoreAnswer(pronounce, { transcript: "programming" }, rules).won).toBe(false);
    expect(scoreAnswer(pronounce, {}, rules).won).toBe(false);
  });
  it("speak: ≥ 80% of words, returns missed words", () => {
    const ok = scoreAnswer(speak, { transcript: "practice every day and you will see the difference" }, rules);
    expect(ok).toEqual({ won: true, score: 1, missedWords: [] });
    const bad = scoreAnswer(speak, { transcript: "practice every day" }, rules);
    expect(bad.won).toBe(false);
    expect(bad.missedWords).toEqual(["and", "you", "will", "see", "the", "difference"]);
  });
  it("meaning/question: choice must equal correctIndex", () => {
    expect(scoreAnswer(meaning, { choice: 0 }, rules).won).toBe(true);
    expect(scoreAnswer(meaning, { choice: 1 }, rules).won).toBe(false);
    expect(scoreAnswer(question, { choice: 0 }, rules).won).toBe(true);
    expect(scoreAnswer(question, { choice: 3 }, rules).won).toBe(false);
  });
  it("an answer of the wrong kind fails", () => {
    expect(scoreAnswer(meaning, { transcript: "unwilling" }, rules).won).toBe(false);
    expect(scoreAnswer(speak, { choice: 0 }, rules).won).toBe(false);
  });
});
