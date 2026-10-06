import { useState } from "react";
import type { StartAttemptOutput } from "@shared/types";

const LETTERS = ["A", "B", "C", "D"];

/** meaning / question (PLAN 3.7): the Lingo asks in a speech bubble; 4 big 3D buttons, a tap submits. */
export default function ChoiceChallenge({
  challenge,
  onChoose,
}: {
  challenge: StartAttemptOutput;
  onChoose: (choice: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const meaning = challenge.type === "meaning";

  return (
    <div className="stack challenge">
      <div className="bubble">
        {meaning ? (
          <>
            <p className="bubble-ask">What is the closest meaning of</p>
            <p className="say-word">{challenge.word}</p>
          </>
        ) : (
          <>
            {/_{2,}/.test(challenge.prompt ?? "") && <p className="bubble-ask">Fill in the blank</p>}
            <p className="say-phrase">{challenge.prompt}</p>
          </>
        )}
      </div>
      <div className="choices" role="group" aria-label="Answers">
        {(challenge.options ?? []).map((opt, i) => (
          <button
            key={i}
            className="choice"
            data-picked={picked === i}
            disabled={picked !== null}
            onClick={() => {
              setPicked(i);
              onChoose(i);
            }}
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
