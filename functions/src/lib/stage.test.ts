import { describe, expect, it } from "vitest";
import type { QuestionDoc } from "../shared/types";
import type { PoolQuestion } from "./questions";
import { isStageQuestion, pickStageQuestion, stageReveal } from "./stage";

const q = (id: string, doc: Partial<QuestionDoc> & Pick<QuestionDoc, "type" | "level">): PoolQuestion => ({
  id,
  doc: {
    explanation: `about ${id}`,
    ...(doc.type === "pronounce"
      ? { word: "programme" }
      : doc.type === "meaning"
        ? { word: "reluctant", options: ["unwilling", "excited", "tired", "careful"], correctIndex: 0 }
        : { prompt: "She has been here ___ 2022.", options: ["for", "since", "from", "at"], correctIndex: 1, target: "since" }),
    ...doc,
  } as QuestionDoc,
});

const pool = [
  q("h-meaning", { type: "meaning", level: "hard" }),
  q("h-question", { type: "question", level: "hard" }),
  q("h-pronounce", { type: "pronounce", level: "hard" }),
  q("m-meaning", { type: "meaning", level: "medium" }),
];

describe("stage questions", () => {
  it("only hard meaning / fill-in-the-blank questions", () => {
    expect(pool.filter(isStageQuestion).map((x) => x.id)).toEqual(["h-meaning", "h-question"]);
  });

  it("never repeats one in seen, and says how many are left", () => {
    const first = pickStageQuestion(pool, new Set());
    expect(first && ["h-meaning", "h-question"]).toContain(first!.id);
    expect(first!.left).toBe(1);
    const second = pickStageQuestion(pool, new Set([first!.id]));
    expect(second!.id).not.toBe(first!.id);
    expect(second!.left).toBe(0);
    expect(pickStageQuestion(pool, new Set(["h-meaning", "h-question"]))).toBeNull();
  });

  it("never carries the answer, and shuffles the 4 options", () => {
    for (let i = 0; i < 20; i++) {
      const s = pickStageQuestion(pool, new Set())!;
      expect(JSON.stringify(s)).not.toMatch(/correctIndex|target|explanation/);
      expect(s.options).toHaveLength(4);
    }
    const last = (max: number) => max - 1; // a fixed RNG: picks the last question, reverses nothing at random
    const s = pickStageQuestion(pool, new Set(), last)!;
    expect(s).toMatchObject({ id: "h-question", type: "question", prompt: "She has been here ___ 2022." });
    expect([...s.options].sort()).toEqual(["at", "for", "from", "since"]);
  });

  it("reveals the answer text (as shown), only for stage questions", () => {
    expect(stageReveal(pool, "h-question")).toEqual({ id: "h-question", answer: "since", explanation: "about h-question" });
    expect(stageReveal(pool, "h-meaning")?.answer).toBe("unwilling");
    expect(stageReveal(pool, "h-pronounce")).toBeNull();
    expect(stageReveal(pool, "m-meaning")).toBeNull();
    expect(stageReveal(pool, "nope")).toBeNull();
  });
});
