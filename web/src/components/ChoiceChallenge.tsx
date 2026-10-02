import { useState } from "react";
import type { StartAttemptOutput } from "@shared/types";

const LETTERS = ["A", "B", "C", "D"];

/** meaning / question (PLAN 3.7): prompt + 4 big buttons; a tap submits. */
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
    <div className="stack">
      {meaning ? (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            What does this word mean?
          </p>
          <p className="say-word">{challenge.word}</p>
        </>
      ) : (
        <p className="say-phrase">{challenge.prompt}</p>
      )}
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
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
