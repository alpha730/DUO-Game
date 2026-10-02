import type { ChallengeDoc, GameRules } from "../shared/types";
import { matchPhrase, matchWord } from "./match";

export interface ScoreResult {
  won: boolean;
  /** 0–1 word match for speak, else 0/1 */
  score: number;
  missedWords?: string[];
}

/** Scores an answer against its challenge (SPEC §2 pass marks). Pure. */
export function scoreAnswer(
  ch: ChallengeDoc,
  answer: { transcript?: string; choice?: number },
  rules: Pick<GameRules, "speakPassRatio">,
): ScoreResult {
  switch (ch.type) {
    case "pronounce": {
      const won = matchWord(ch.word, answer.transcript ?? "", ch.accept ?? []).passed;
      return { won, score: won ? 1 : 0 };
    }
    case "speak": {
      const m = matchPhrase(ch.phrase, answer.transcript ?? "", rules.speakPassRatio);
      return { won: m.passed, score: m.score, missedWords: m.missedWords };
    }
    case "meaning":
    case "question": {
      const won = answer.choice === ch.correctIndex;
      return { won, score: won ? 1 : 0 };
    }
  }
}
