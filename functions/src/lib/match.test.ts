import { describe, expect, it } from "vitest";
import { matchPhrase, matchWord, normWord, words } from "./match";

describe("matchWord (pronounce)", () => {
  it("passes when the transcript is the word", () => {
    expect(matchWord("comfortable", "comfortable").passed).toBe(true);
  });
  it("ignores case, punctuation and extra words around it", () => {
    expect(matchWord("Entrepreneur", "um the word is entrepreneur!").passed).toBe(true);
  });
  it("accepts listed alternative spellings", () => {
    // programme/program isn't covered by normWord(), so it needs accept[] (colour/color now is).
    expect(matchWord("programme", "program", ["program"]).passed).toBe(true);
    expect(matchWord("programme", "program").passed).toBe(false);
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

describe("normalisation: numbers 0–20 and UK/US spellings (both sides)", () => {
  it("the two required phrases pass", () => {
    expect(matchPhrase("Ten years of learning deserve a big celebration.", "10 years of learning deserve a big celebration")).toMatchObject({ passed: true, score: 1 });
    expect(matchPhrase("My favourite way to relax is listening to music.", "my favorite way to relax is listening to music")).toMatchObject({ passed: true, score: 1 });
  });

  it("numbers both ways, 0–20", () => {
    expect(normWord("ten")).toBe("10");
    expect(normWord("twenty")).toBe("20");
    expect(normWord("zero")).toBe("0");
    expect(matchPhrase("I have 2 brothers and 1 sister", "i have two brothers and one sister").score).toBe(1);
    expect(normWord("twentyone")).toBe("twentyone"); // only 0–20
  });

  it("UK and US spellings meet in the middle", () => {
    const same = [
      ["colour", "color"], ["favourite", "favorite"], ["behaviour", "behavior"], ["neighbours", "neighbors"], ["neighbourhood", "neighborhood"],
      ["organise", "organize"], ["recognised", "recognized"], ["organisation", "organization"], ["analyse", "analyze"],
      ["travelling", "traveling"], ["cancelled", "canceled"], ["centre", "center"], ["theatres", "theaters"],
      ["practise", "practice"], ["practising", "practicing"], ["licence", "license"],
    ];
    for (const [uk, us] of same) expect([uk, normWord(uk)]).toEqual([uk, normWord(us)]);
  });

  it("doesn't merge different words", () => {
    for (const [a, b] of [["our", "or"], ["four", "for"], ["filling", "filing"], ["your", "yor"], ["hour", "hor"], ["telling", "teling"]]) {
      expect(normWord(a)).not.toBe(normWord(b));
    }
    expect(matchPhrase("our team", "or team").passed).toBe(false);
  });

  it("missed words keep the phrase's spelling", () => {
    expect(matchPhrase("My favourite colour is blue today", "my is blue today").missedWords).toEqual(["favourite", "colour"]);
  });

  it("pronounce answers use the same normalisation", () => {
    expect(matchWord("favourite", "favorite").passed).toBe(true);
    expect(matchWord("organise", "i said organize").passed).toBe(true);
    expect(matchWord("theatre", "theater").passed).toBe(true);
    expect(matchWord("twelve", "12").passed).toBe(true);
    expect(matchWord("behaviour", "behavioural").passed).toBe(false); // still whole words only
  });
});
