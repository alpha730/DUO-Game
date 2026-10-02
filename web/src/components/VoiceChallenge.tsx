import { useCallback, useEffect, useRef, useState } from "react";
import type { StartAttemptOutput } from "@shared/types";
import { listen } from "../catch/speech";

const STOP_HELP: Record<string, string> = {
  "no-speech": "We didn't hear anything.",
  "audio-capture": "No microphone input.",
  network: "Speech service unreachable — check your internet.",
  "not-allowed": "Microphone blocked.",
  "service-not-allowed": "Speech recognition is turned off on this phone.",
};

/** pronounce / speak (PLAN 3.6): say it; the final transcript is submitted. */
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
    <div className="stack voice" data-listening={listening}>
      <p className="small muted" style={{ margin: 0 }}>
        {pronounce ? "Say this word clearly:" : "Say this sentence:"}
      </p>
      <p className={pronounce ? "say-word" : "say-phrase"}>{pronounce ? challenge.word : challenge.phrase}</p>

      <div className="heard" aria-live="polite">
        <span className="mic-dot" aria-hidden="true" />
        <span className="heard-text">{heard || (listening ? "Listening…" : "…")}</span>
      </div>

      {stopped && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {STOP_HELP[stopped] ?? "Recognition stopped."}
          </p>
          <button className="btn" onClick={start}>
            🎤 Tap to speak again
          </button>
        </>
      )}
    </div>
  );
}
