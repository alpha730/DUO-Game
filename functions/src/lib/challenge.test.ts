import { describe, expect, it } from "vitest";
import type { ChallengeDoc } from "../shared/types";
import { publicChallenge } from "./challenge";

const all: ChallengeDoc[] = [
  { type: "pronounce", word: "programme", accept: ["program"] },
  { type: "speak", phrase: "Practice every day and you will see the difference." },
  { type: "meaning", word: "reluctant", options: ["unwilling", "excited", "tired", "careful"], correctIndex: 0 },
  { type: "question", prompt: "She has been working here ___ 2022.", options: ["since", "for", "from", "at"], correctIndex: 0 },
];

describe("publicChallenge", () => {
  it("never includes the answer", () => {
    for (const ch of all) {
      const out = publicChallenge(ch);
      expect(out).not.toHaveProperty("accept");
      expect(out).not.toHaveProperty("correctIndex");
      expect(JSON.stringify(out)).not.toMatch(/accept|correctIndex|"program"/);
    }
  });
  it("keeps what each type needs to be shown", () => {
    expect(publicChallenge(all[0])).toEqual({ type: "pronounce", word: "programme" });
    expect(publicChallenge(all[1])).toEqual({ type: "speak", phrase: "Practice every day and you will see the difference." });
    expect(publicChallenge(all[2])).toEqual({ type: "meaning", word: "reluctant", options: ["unwilling", "excited", "tired", "careful"] });
    expect(publicChallenge(all[3])).toEqual({
      type: "question",
      prompt: "She has been working here ___ 2022.",
      options: ["since", "for", "from", "at"],
    });
  });
  it("drops unknown extra fields stored on the doc", () => {
    const sneaky = { ...all[2], answer: "unwilling", notes: "x" } as unknown as ChallengeDoc;
    expect(Object.keys(publicChallenge(sneaky)).sort()).toEqual(["options", "type", "word"]);
  });
});
