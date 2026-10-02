import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  isVoiceChallenge,
  type GetMyStateOutput,
  type StartAttemptOutput,
  type SubmitAttemptInput,
  type SubmitAttemptOutput,
} from "@shared/types";
import { activeAttempt, sendForfeit } from "../catch/forfeit";
import { requestLocation, requestMic, type CheckState, type Position } from "../catch/preflight";
import { speechSupported } from "../catch/speech";
import { useCountdown } from "../catch/useCountdown";
import ChoiceChallenge from "../components/ChoiceChallenge";
import { OpenInBrowser } from "../components/CameraHelp";
import Preflight from "../components/Preflight";
import Result from "../components/Result";
import TimerBar from "../components/TimerBar";
import VoiceChallenge from "../components/VoiceChallenge";
import { api, apiErrorMessage } from "../lib/api";
import { auth } from "../lib/firebase";
import { loadLingos, type Lingo } from "../lib/lingos";

type Phase = "preflight" | "ready" | "starting" | "active" | "submitting" | "done";
type Answer = Omit<SubmitAttemptInput, "attemptId">;
export type Outcome =
  | { kind: "won" | "failed"; data: SubmitAttemptOutput }
  | { kind: "late" }
  | { kind: "forfeit" }
  | { kind: "error"; message: string };

/** The running challenge: timer + (from 3.6/3.7) the answer UI. */
function Active({ challenge, onSubmit }: { challenge: StartAttemptOutput; onSubmit: (a: Answer) => void }) {
  const answer = useRef<Answer>({});
  // Time's up → submit whatever we have; the server decides (and rejects anything past the grace).
  const { leftMs, totalMs } = useCountdown(challenge.expiresAt, challenge.serverNow, () => onSubmit(answer.current));
  // Stable callbacks: a new function each render would restart speech recognition.
  const onTranscript = useCallback((t: string) => {
    answer.current = { transcript: t };
  }, []);
  const onVoice = useCallback((t: string) => onSubmit({ transcript: t }), [onSubmit]);

  return (
    <section className="card stack" data-type={challenge.type}>
      <TimerBar leftMs={leftMs} totalMs={totalMs} />
      {isVoiceChallenge(challenge.type) ? (
        <VoiceChallenge challenge={challenge} onTranscript={onTranscript} onSubmit={onVoice} />
      ) : (
        <ChoiceChallenge challenge={challenge} onChoose={(choice) => onSubmit({ choice })} />
      )}
    </section>
  );
}

// An attempt that was running when the page was reloaded/closed (read once per page load).
let reloadedAttempt = activeAttempt.take();

export default function Catch() {
  const { lingoId = "" } = useParams();
  // Reload mid-attempt → the pagehide forfeit already went out: show "Chance lost" straight away.
  const [reloaded] = useState(() => (reloadedAttempt?.lingoId === lingoId ? reloadedAttempt : null));
  const [lingo, setLingo] = useState<Lingo | null>(null);
  const [me, setMeRaw] = useState<GetMyStateOutput | null>(null);
  // Latest server count of attempts left today (getMyState, then each startAttempt).
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const setMe = useCallback((s: GetMyStateOutput) => {
    setMeRaw(s);
    setAttemptsLeft(s.attemptsLeft);
  }, []);
  const [phase, setPhase] = useState<Phase>(reloaded ? "done" : "preflight");
  const [mic, setMic] = useState<CheckState>("idle");
  const [loc, setLoc] = useState<CheckState>("idle");
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState("");
  const [needsSpeech, setNeedsSpeech] = useState(false);
  const [challenge, setChallenge] = useState<StartAttemptOutput | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(reloaded ? { kind: "forfeit" } : null);
  const token = useRef<string | null>(null);
  const submitted = useRef(false);
  const lastAnswer = useRef<Answer>({});

  // Mount: auto-forfeit any open attempt (SPEC §3.5) + attempts left; Lingo name/colour.
  useEffect(() => {
    if (reloaded) reloadedAttempt = null; // show it once
    api.getMyState({}).then(setMe, () => {});
    loadLingos().then((ls) => setLingo(ls.find((l) => l.id === lingoId) ?? null), () => {});
  }, [lingoId, reloaded, setMe]);

  // One-chance rule (SPEC §3.4): hiding the page (tab switch, lock screen, call, app switch) or
  // closing/reloading it while the challenge runs forfeits it. Not `blur` — that fires on harmless things.
  useEffect(() => {
    if (phase !== "active" || !challenge) return;
    activeAttempt.set(lingoId, challenge.attemptId);
    const lose = () => {
      if (submitted.current) return; // answer already on its way
      submitted.current = true;
      sendForfeit(token.current, challenge.attemptId);
      setOutcome({ kind: "forfeit" });
      setPhase("done");
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") lose();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", lose);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", lose);
    };
  }, [phase, challenge, lingoId]);

  // Leaving the Catch screen inside the app mid-challenge also loses it (no peeking and coming back).
  const running = useRef<string | null>(null);
  running.current = phase === "active" && challenge ? challenge.attemptId : null;
  useEffect(
    () => () => {
      if (running.current && !submitted.current) {
        submitted.current = true;
        sendForfeit(token.current, running.current);
      }
      activeAttempt.clear();
    },
    [],
  );

  // Pre-flight: mic, then location — one prompt at a time, all before Start.
  const preflightRunning = useRef(false);
  const runPreflight = useCallback(async () => {
    if (preflightRunning.current) return; // StrictMode double mount / double tap: never two prompts
    preflightRunning.current = true;
    setError("");
    setMic("asking");
    const m = await requestMic();
    setMic(m);
    setLoc("asking");
    const l = await requestLocation();
    setLoc(l.state);
    if (l.position) setPosition(l.position);
    setPhase(m === "ok" && l.state === "ok" ? "ready" : "preflight");
    preflightRunning.current = false;
  }, []);

  useEffect(() => {
    if (!reloaded) void runPreflight();
  }, [runPreflight, reloaded]);

  async function start() {
    if (!position) return;
    setPhase("starting");
    setError("");
    try {
      // Cache the ID token now so the one-chance forfeit needs no async work later (SPEC §3.4).
      token.current = (await auth.currentUser?.getIdToken()) ?? null;
      // No SpeechRecognition here → the server refuses voice challenges up front (no attempt used).
      const out = await api.startAttempt({ lingoId, lat: position.lat, lng: position.lng, speech: speechSupported() });
      submitted.current = false;
      setAttemptsLeft(out.attemptsLeft);
      setChallenge(out);
      setPhase("active");
    } catch (err) {
      setNeedsSpeech((err as { details?: { code?: string } }).details?.code === "needs-speech");
      setError(apiErrorMessage(err));
      setPhase("ready");
    }
  }

  const submit = useCallback(
    async (answer: Answer) => {
      if (!challenge || submitted.current) return; // one answer per attempt (timer vs. tap race)
      submitted.current = true;
      lastAnswer.current = answer;
      setPhase("submitting");
      try {
        const data = await api.submitAttempt({ attemptId: challenge.attemptId, ...answer });
        activeAttempt.clear(); // answered: a reload now is harmless
        setOutcome({ kind: data.result, data });
      } catch (err) {
        const code = (err as { details?: { code?: string } }).details?.code;
        setOutcome(
          code === "too-late"
            ? { kind: "late" }
            : code === "not-open"
              ? { kind: "forfeit" }
              : { kind: "error", message: apiErrorMessage(err) },
        );
      }
      setPhase("done");
    },
    [challenge],
  );

  function retry() {
    setChallenge(null);
    setOutcome(null);
    lastAnswer.current = {};
    submitted.current = false;
    activeAttempt.clear();
    api.getMyState({}).then(setMe, () => {});
    if (mic === "ok" && loc === "ok") setPhase("ready");
    else void runPreflight();
  }

  const name = lingo?.name ?? "this Lingo";

  return (
    <main className="screen stack" data-phase={phase}>
      <header className="catch-head">
        <span className="swatch" style={{ background: lingo?.color ?? "var(--surface-2)" }} aria-hidden="true" />
        <div>
          <h1 style={{ margin: 0 }}>Catch {name}</h1>
          {me && attemptsLeft !== null && (phase === "preflight" || phase === "ready" || phase === "starting") && (
            <p className="small muted" style={{ margin: 0 }}>
              Attempts left today: {attemptsLeft}/{me.attemptsPerDay}
            </p>
          )}
        </div>
      </header>

      {(phase === "preflight" || phase === "ready" || phase === "starting") && (
        <>
          <Preflight mic={mic} location={loc} onRetry={runPreflight} />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {needsSpeech && <OpenInBrowser />}
          {phase !== "preflight" && !needsSpeech && (
            <button className="btn" onClick={start} disabled={phase === "starting"}>
              {phase === "starting" ? "Starting…" : "Start"}
            </button>
          )}
          <Link className="btn link" to="/scan">
            Back to scanning
          </Link>
        </>
      )}

      {phase === "active" && challenge && <Active challenge={challenge} onSubmit={submit} />}

      {phase === "submitting" && (
        <div className="center" style={{ padding: 24 }}>
          <div className="spinner" />
          <p className="muted">Checking your answer…</p>
        </div>
      )}

      {phase === "done" && outcome && (
        <Result
          outcome={outcome}
          lingoName={name}
          type={challenge?.type ?? null}
          heard={lastAnswer.current.transcript}
          attemptsLeft={attemptsLeft}
          attemptsPerDay={me?.attemptsPerDay ?? null}
          onRetry={retry}
          prevLevel={me?.catches.find((x) => x.lingoId === lingoId && x.timesCaught > 0)?.level ?? null}
        />
      )}
    </main>
  );
}
