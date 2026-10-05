import { useCallback, useEffect, useRef, useState } from "react";
import type { StartAttemptOutput } from "@shared/types";
import { listen } from "../catch/speech";
import { MicIcon } from "./Icons";

const STOP_HELP: Record<string, string> = {
  "no-speech": "We didn't hear anything.",
  "audio-capture": "No microphone input.",
  network: "Speech service unreachable — check your internet.",
  "not-allowed": "Microphone blocked.",
  "service-not-allowed": "Speech recognition is turned off on this phone.",
};

/** pronounce / speak (PLAN 3.6): say it into the giant mic; the final transcript is submitted. */
export default function VoiceChallenge({
  challenge,
  onTranscript,
  onSubmit,
}: {
  challenge: StartAttemptOutput;
  /** Latest text heard — submitted as-is if the timer runs out. */
  onTranscript: (text: string) => void;
  onSubmit: (transcript: string) => void;
}) {
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [stopped, setStopped] = useState<string | null>(null);
  const cancel = useRef<() => void>(() => {});

  const start = useCallback(() => {
    setStopped(null);
    setListening(true);
    cancel.current = listen({
      onInterim: (t) => {
        setHeard(t);
        onTranscript(t);
      },
      onFinal: (t) => {
        setHeard(t);
        onTranscript(t);
        setListening(false);
        onSubmit(t);
      },
      onStopped: (err) => {
        setListening(false);
        setStopped(err ?? "no-speech");
      },
    });
  }, [onSubmit, onTranscript]);

  useEffect(() => {
    start();
    return () => cancel.current();
  }, [start]);

  const pronounce = challenge.type === "pronounce";
  return (
    <div className="stack challenge voice" data-listening={listening}>
      <div className="bubble">
        <p className="bubble-ask">{pronounce ? "Say this word clearly:" : "Say this sentence:"}</p>
        <p className={pronounce ? "say-word" : "say-phrase"}>{pronounce ? challenge.word : challenge.phrase}</p>
      </div>

      <div className="mic-area">
        <button
          className="mic-button"
          data-listening={listening}
          onClick={start}
          disabled={listening}
          aria-label={listening ? "Listening" : "Tap to speak again"}
        >
          <span className="mic-pulse" aria-hidden="true" />
          <MicIcon size={44} />
        </button>
        <div className="wave" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
      </div>

      <div className="heard" aria-live="polite">
        <span className="mic-dot" aria-hidden="true" />
        <span className="heard-text">{heard || (listening ? "Listening…" : "…")}</span>
      </div>

      {stopped && (
        <p className="mic-help" role="status">
          {STOP_HELP[stopped] ?? "Recognition stopped."} Tap the mic to speak again.
        </p>
      )}
    </div>
  );
}
