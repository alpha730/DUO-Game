import type { ChallengeDoc, StartAttemptOutput } from "../shared/types";

export type PublicChallenge = Pick<StartAttemptOutput, "type" | "word" | "phrase" | "prompt" | "options">;

/**
 * The part of a challenge the player may see before answering. Builds a new object field by field
 * (no spreading), so `accept` and `correctIndex` can never leak (CLAUDE.md rule 4).
 */
export function publicChallenge(ch: ChallengeDoc): PublicChallenge {
  switch (ch.type) {
    case "pronounce":
      return { type: "pronounce", word: ch.word };
    case "speak":
      return { type: "speak", phrase: ch.phrase };
    case "meaning":
      return { type: "meaning", word: ch.word, options: [...ch.options] };
    case "question":
      return { type: "question", prompt: ch.prompt, options: [...ch.options] };
  }
}

const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

/**
 * Validates a challenge from an admin (raid form now, challenge upload on Day 7): known type, its
 * fields present, exactly 4 distinct options and correctIndex 0–3 for choice types. Pure — returns
 * the clean document to store, or null.
 */
export function parseChallenge(input: unknown): ChallengeDoc | null {
  const d = (input ?? {}) as Record<string, unknown>;
  switch (d.type) {
    case "pronounce": {
      const word = text(d.word, 40);
      if (!word) return null;
      if (d.accept === undefined) return { type: "pronounce", word };
      if (!Array.isArray(d.accept) || d.accept.length > 10) return null;
      const accept = d.accept.map((a) => text(a, 40));
      return accept.every((a): a is string => a !== null) ? { type: "pronounce", word, accept } : null;
    }
    case "speak": {
      const phrase = text(d.phrase, 200);
      return phrase ? { type: "speak", phrase } : null;
    }
    case "meaning":
    case "question": {
      const options = Array.isArray(d.options) ? d.options.map((o) => text(o, 120)) : [];
      if (options.length !== 4 || options.some((o) => o === null) || new Set(options).size !== 4) return null;
      const opts = options as [string, string, string, string];
      if (!Number.isInteger(d.correctIndex) || (d.correctIndex as number) < 0 || (d.correctIndex as number) > 3) return null;
      const correctIndex = d.correctIndex as 0 | 1 | 2 | 3;
      if (d.type === "meaning") {
        const word = text(d.word, 40);
        return word ? { type: "meaning", word, options: opts, correctIndex } : null;
      }
      const prompt = text(d.prompt, 300);
      return prompt ? { type: "question", prompt, options: opts, correctIndex } : null;
    }
    default:
      return null;
  }
}
