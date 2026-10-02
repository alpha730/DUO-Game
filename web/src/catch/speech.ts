// Browser speech recognition (Chrome: SpeechRecognition / webkitSpeechRecognition; Safari: webkit…).

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => ctor() !== null;

export interface ListenHandlers {
  /** Live text while the player is speaking. */
  onInterim(text: string): void;
  /** Final text for this utterance — submit it. */
  onFinal(text: string): void;
  /** Recognition stopped without a final result (silence, error). `error` is the browser's code. */
  onStopped(error?: string): void;
}

/** Starts one utterance of recognition (en-IN). Returns a function that cancels it. */
export function listen(handlers: ListenHandlers): () => void {
  const Rec = ctor();
  if (!Rec) {
    handlers.onStopped("unsupported");
    return () => {};
  }
  const rec = new Rec();
  rec.lang = "en-IN";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  let finalText: string | null = null;
  let lastError: string | undefined;
  let cancelled = false;

  rec.onresult = (e) => {
    let text = "";
    let isFinal = false;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (e.results[i].isFinal) isFinal = true;
    }
    text = text.trim();
    if (isFinal) finalText = text;
    else handlers.onInterim(text);
  };
  rec.onerror = (e) => {
    lastError = e.error;
  };
  rec.onend = () => {
    if (cancelled) return;
    if (finalText !== null) handlers.onFinal(finalText);
    else handlers.onStopped(lastError ?? "no-speech");
  };

  try {
    rec.start();
  } catch {
    handlers.onStopped("start-failed");
  }
  return () => {
    cancelled = true;
    try {
      rec.abort();
    } catch {
      /* already stopped */
    }
  };
}
