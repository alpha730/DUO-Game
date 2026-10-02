import { describe, expect, it } from "vitest";
import { matchPhrase, matchWord, words } from "./match";

describe("matchWord (pronounce)", () => {
  it("passes when the transcript is the word", () => {
    expect(matchWord("comfortable", "comfortable").passed).toBe(true);
  });
  it("ignores case, punctuation and extra words around it", () => {
    expect(matchWord("Entrepreneur", "um the word is entrepreneur!").passed).toBe(true);
  });
  it("accepts listed alternative spellings", () => {
    expect(matchWord("colour", "color", ["color"]).passed).toBe(true);
    expect(matchWord("colour", "color").passed).toBe(false);
  });
  it("supports multi-word spellings as consecutive words", () => {
    expect(matchWord("alright", "it's all right", ["all right"]).passed).toBe(true);
    expect(matchWord("alright", "all is right", ["all right"]).passed).toBe(false);
  });
  it("matches whole words only", () => {
    expect(matchWord("schedule", "schedules").passed).toBe(false);
    expect(matchWord("form", "comfortable").passed).toBe(false);
  });
  it("fails a wrong or empty transcript", () => {
    expect(matchWord("schedule", "shed jewel").passed).toBe(false);
    expect(matchWord("schedule", "").passed).toBe(false);
  });
  it("never passes an empty word", () => {
    expect(matchWord("", "anything", [""]).passed).toBe(false);
  });
});

describe("words", () => {
  it("lowercases, strips punctuation, collapses spaces", () => {
    expect(words("  Hello,   World!  It's   GREAT. ")).toEqual(["hello", "world", "its", "great"]);
  });
  it("splits on dashes", () => {
    expect(words("well-known")).toEqual(["well", "known"]);
  });
});

describe("matchPhrase", () => {
  const phrase = "Practice makes progress every day"; // 5 words

  it("passes an exact match", () => {
    expect(matchPhrase(phrase, "practice makes progress every day")).toEqual({
      score: 1,
      passed: true,
      missedWords: [],
    });
  });
  it("ignores case and punctuation", () => {
    expect(matchPhrase("Don't stop, keep going!", "dont stop keep going").passed).toBe(true);
    expect(matchPhrase("dont stop keep going", "Don't stop. Keep going!").passed).toBe(true);
  });
  it("passes at exactly 80% (4 of 5)", () => {
    const r = matchPhrase(phrase, "practice makes progress every");
    expect(r.score).toBeCloseTo(0.8);
    expect(r.passed).toBe(true);
    expect(r.missedWords).toEqual(["day"]);
  });
  it("fails below 80% (3 of 5)", () => {
    const r = matchPhrase(phrase, "practice makes day");
    expect(r.passed).toBe(false);
    expect(r.missedWords).toEqual(["progress", "every"]);
  });
  it("fails 7 of 9 (77.8%)", () => {
    expect(matchPhrase("one two three four five six seven eight nine", "one two three four five six seven").passed).toBe(
      false,
    );
  });
  it("ignores extra words and order", () => {
    const r = matchPhrase(phrase, "umm so every day practice uh makes progress okay");
    expect(r.passed).toBe(true);
    expect(r.score).toBe(1);
  });
  it("fails an empty transcript", () => {
    expect(matchPhrase(phrase, "")).toMatchObject({ score: 0, passed: false });
  });
  it("never passes an empty phrase", () => {
    expect(matchPhrase("", "anything").passed).toBe(false);
  });
  it("respects a custom pass ratio", () => {
    expect(matchPhrase(phrase, "practice makes progress every", 0.9).passed).toBe(false);
  });
});
