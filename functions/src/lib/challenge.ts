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
