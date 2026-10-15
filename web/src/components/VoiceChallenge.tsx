import { useCallback, useEffect, useRef, useState } from "react";
import type { StartAttemptOutput } from "@shared/types";
import { listen } from "../catch/speech";
import type { Lingo } from "../lib/lingos";
import LingoArt from "./LingoArt";

const STOP_HELP: Record<string, string> = {
  "no-speech": "We didn't hear anything.",
  "audio-capture": "No microphone input.",
  network: "Speech service unreachable — check your internet.",
  "not-allowed": "Microphone blocked.",
  "service-not-allowed": "Speech recognition is turned off on this phone.",
};

export type VoiceState = "idle" | "listening" | "stopped";

/**
 * pronounce / speak as DET "Read aloud" (DET-DESIGN §3): the text to read, a blue waveform pill
 * (Iguana with Macaw bars, moving while it listens), the character in the middle. Recording starts
 * from the card's 🎤 RECORD NOW button (`recordKey` changes); the final transcript is submitted
 * automatically, and whatever was heard is sent if the timer runs out.
 */
export default function VoiceChallenge({
  challenge,
  lingo,
  recordKey,
  onState,
  onTranscript,
  onSubmit,
}: {
  challenge: StartAttemptOutput;
  lingo: Lingo | null;
  /** Bumped by RECORD NOW: each new value starts listening. */
  recordKey: number;
  onState: (s: VoiceState) => void;
  /** Latest text heard — submitted as-is if the timer runs out. */
  onTranscript: (text: string) => void;
  onSubmit: (transcript: string) => void;
}) {
  const [heard, setHeard] = useState("");
  const [state, setState] = useState<VoiceState>("idle");
  const [stopped, setStopped] = useState<string | null>(null);
  const cancel = useRef<() => void>(() => {});

  const update = useCallback(
    (s: VoiceState) => {
      setState(s);
      onState(s);
    },
    [onState],
  );

  const start = useCallback(() => {
    setStopped(null);
    update("listening");
    cancel.current = listen({
      onInterim: (t) => {
        setHeard(t);
        onTranscript(t);
      },
      onFinal: (t) => {
        setHeard(t);
        onTranscript(t);
        update("stopped");
        onSubmit(t);
      },
      onStopped: (err) => {
        update("stopped");
        setStopped(err ?? "no-speech");
      },
    });
  }, [onSubmit, onTranscript, update]);

  useEffect(() => {
    if (recordKey > 0) start();
  }, [recordKey, start]);
  useEffect(() => () => cancel.current(), []);

  const pronounce = challenge.type === "pronounce";
  const listening = state === "listening";
  return (
    <div className="stack challenge voice" data-listening={listening}>
      <p className={pronounce ? "say-word" : "say-phrase"}>{pronounce ? challenge.word : challenge.phrase}</p>
      {lingo && (
        <div className="voice-character" aria-hidden="true">
          <LingoArt lingo={lingo} mood={listening ? "wow" : "happy"} />
        </div>
      )}
      <div className="wave-pill" data-listening={listening} aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => (
          <i key={i} style={{ "--i": i, "--h": `${8 + ((i * 7) % 22)}px` } as React.CSSProperties} />
        ))}
      </div>
      <div className="heard" aria-live="polite">
        <span className="mic-dot" aria-hidden="true" />
        <span className="heard-text">{heard || (listening ? "Listening…" : "Tap RECORD NOW and read it out loud")}</span>
      </div>
      {stopped && (
        <p className="mic-help" role="status">
          {STOP_HELP[stopped] ?? "Recognition stopped."} Tap RECORD NOW to try again.
        </p>
      )}
    </div>
  );
}
