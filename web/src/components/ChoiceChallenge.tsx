import type { StartAttemptOutput } from "@shared/types";

/**
 * The sentence with its blank ("__" / "___") as a DET slot. Once an option is selected, its word
 * shows in the slot (a preview — nothing is sent until CONTINUE).
 */
function WithBlank({ text, fill }: { text: string; fill: string | null }) {
  const parts = text.split(/_{2,}/);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <span className="q-blank" data-filled={fill !== null} aria-label={fill ? `blank: ${fill}` : "blank"}>
              {fill ?? ""}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

export const hasBlank = (c: StartAttemptOutput) => /_{2,}/.test(c.prompt ?? "");

/** The DET instruction line for a choice question. */
export function choiceInstruction(c: StartAttemptOutput): string {
  if (c.type === "meaning") return "Select the closest meaning of the word";
  return hasBlank(c) ? "Complete the sentence with the correct word" : "Select the best answer";
}

/**
 * meaning / question as a DET test item: the word or sentence, then full-width option cards with a
 * radio circle (DET-DESIGN §3). A tap only selects (Iguana card, Macaw border); CONTINUE sends it.
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
  const options = challenge.options ?? [];
  return (
    <div className="stack challenge">
      {meaning ? (
        <p className="say-word">{challenge.word}</p>
      ) : (
        <p className="say-phrase">{blank ? <WithBlank text={challenge.prompt ?? ""} fill={picked === null ? null : options[picked]} /> : challenge.prompt}</p>
      )}
      <div className="choices" role="radiogroup" aria-label="Answers">
        {options.map((opt, i) => (
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
            <span className="choice-radio" aria-hidden="true" />
            <span className="choice-text">{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
