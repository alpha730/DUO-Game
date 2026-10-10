import type { StartAttemptOutput } from "@shared/types";

const LETTERS = ["A", "B", "C", "D"];

/** The sentence with its blank ("__" / "___") drawn as a DET-style underline gap. */
function WithBlank({ text }: { text: string }) {
  const parts = text.split(/_{2,}/);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="q-blank" aria-label="blank" />}
        </span>
      ))}
    </>
  );
}

export const hasBlank = (c: StartAttemptOutput) => /_{2,}/.test(c.prompt ?? "");

/**
 * meaning / question as a DET practice question: an instruction line, the word or sentence, then 4
 * answer tiles. A tap only selects (light-blue tile); the card's SUBMIT button sends it.
 */
export default function ChoiceChallenge({
  challenge,
  picked,
  onPick,
  locked,
}: {
  challenge: StartAttemptOutput;
  picked: number | null;
  onPick: (choice: number) => void;
  /** Answer sent: no more changes. */
  locked: boolean;
}) {
  const meaning = challenge.type === "meaning";
  const blank = hasBlank(challenge);
  return (
    <div className="stack challenge">
      <div className="q-prompt">
        <p className="q-instruction">
          {meaning ? "Select the closest meaning of the word" : blank ? "Select the best word to fill in the blank" : "Select the best answer"}
        </p>
        {meaning ? <p className="say-word">{challenge.word}</p> : <p className="say-phrase">{blank ? <WithBlank text={challenge.prompt ?? ""} /> : challenge.prompt}</p>}
      </div>
      <div className="choices" role="radiogroup" aria-label="Answers">
        {(challenge.options ?? []).map((opt, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={picked === i}
            className="choice"
            data-picked={picked === i}
            disabled={locked}
            onClick={() => onPick(i)}
          >
            <span className="choice-letter" aria-hidden="true">
              {LETTERS[i]}
            </span>
            <span className="choice-text">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
