import { BRAND, lingoName } from "../config/brand";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
import ChoiceChallenge, { choiceInstruction, hasBlank } from "../components/ChoiceChallenge";
import EmptyState from "../components/EmptyState";
import { OpenInBrowser } from "../components/CameraHelp";
import Preflight from "../components/Preflight";
import Result from "../components/Result";
import LingoArt from "../components/LingoArt";
import { QuestionTimer } from "../components/QuestionTimer";
import { MicIcon } from "../components/Icons";
import VoiceChallenge, { type VoiceState } from "../components/VoiceChallenge";
import { api, apiErrorMessage } from "../lib/api";
import { haptic, play } from "../lib/feedback";
import { triesLeft, triesUsed } from "../lib/catchStatus";
import { appCheckToken, auth } from "../lib/firebase";
import { loadLingos, type Lingo } from "../lib/lingos";
import { recordAnswer } from "../lib/skills";

type Phase = "preflight" | "ready" | "starting" | "active" | "submitting" | "done";
type Answer = Omit<SubmitAttemptInput, "attemptId">;
export type Outcome =
  | { kind: "won" | "failed"; data: SubmitAttemptOutput }
  | { kind: "late" }
  | { kind: "forfeit" }
  | { kind: "error"; message: string };

/** DET task names for our challenge types. */
function taskName(c: StartAttemptOutput): string {
  if (c.type === "meaning") return "Choose the Meaning";
  if (c.type === "question") return hasBlank(c) ? "Fill in the Blanks" : "Choose the Answer";
  return "Read Aloud"; // pronounce + speak
}

/**
 * The running challenge as a DET test item (DET-DESIGN §3): a Snow card on the Polar page —
 * header "⏱ 0:20 for this question" (+ the small Lingo), Swan divider, the task + a bold centred
 * instruction, the item, Swan divider, and CONTINUE bottom-right (🎤 RECORD NOW for Read aloud).
 * Calm: no confetti or bright colours inside the question.
 */
function Active({
  challenge,
  lingo,
  checking,
  onSubmit,
}: {
  challenge: StartAttemptOutput;
  lingo: Lingo | null;
  /** Answer sent, waiting for the server. */
  checking: boolean;
  onSubmit: (a: Answer) => void;
}) {
  const answer = useRef<Answer>({});
  const [picked, setPicked] = useState<number | null>(null);
  const [heard, setHeard] = useState("");
  const [recordKey, setRecordKey] = useState(0);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  // Time's up → submit whatever we have (the selected option or what was heard); the server decides
  // (and rejects anything past the grace).
  const { leftMs, totalMs, seconds } = useCountdown(challenge.expiresAt, challenge.serverNow, () => onSubmit(answer.current));
  // Last 5 seconds: tick + buzz once per second.
  useEffect(() => {
    if (checking || seconds > 5 || seconds <= 0) return;
    play("tick");
    haptic.tick();
  }, [seconds, checking]);
  // Stable callbacks: a new function each render would restart speech recognition.
  const onTranscript = useCallback((t: string) => {
    answer.current = { transcript: t };
    setHeard(t);
  }, []);
  const onVoice = useCallback((t: string) => onSubmit({ transcript: t }), [onSubmit]);
  const pick = (choice: number) => {
    answer.current = { choice };
    setPicked(choice);
  };
  const voice = isVoiceChallenge(challenge.type);
  const canContinue = !checking && (voice ? heard.trim() !== "" && voiceState !== "listening" : picked !== null);

  return (
    <section className="arena q-card" data-type={challenge.type} data-checking={checking} style={{ "--lingo": lingo?.color } as React.CSSProperties}>
      <header className="q-top">
        <QuestionTimer leftMs={leftMs} totalMs={totalMs} label={voice ? "to speak" : "for this question"} />
        {lingo && <LingoArt lingo={lingo} mood={checking ? "wow" : "happy"} className="arena-lingo" />}
      </header>
      <div className="q-body">
        <p className="q-type" data-task>
          {taskName(challenge)}
        </p>
        <p className="q-instruction">{voice ? (challenge.type === "pronounce" ? "Read this word aloud" : "Read this sentence aloud") : choiceInstruction(challenge)}</p>
        {challenge.level === "hard" && (
          <span className="hard-badge" data-level="hard">
            🔥 Hard question — your streak is on fire
          </span>
        )}
        {voice ? (
          <VoiceChallenge challenge={challenge} lingo={lingo} recordKey={recordKey} onState={setVoiceState} onTranscript={onTranscript} onSubmit={onVoice} />
        ) : (
          <ChoiceChallenge challenge={challenge} picked={picked} onPick={pick} locked={checking} />
        )}
      </div>
      <footer className="q-foot">
        {checking ? (
          <div className="arena-checking" role="status">
            <div className="spinner" />
            <p>Checking your answer…</p>
          </div>
        ) : voice && !canContinue ? (
          <button className="btn q-record" disabled={voiceState === "listening"} onClick={() => setRecordKey((k) => k + 1)} data-record>
            <MicIcon size={20} /> {voiceState === "listening" ? "Listening…" : voiceState === "stopped" ? "Record again" : "Record now"}
          </button>
        ) : (
          <button className="btn q-submit" disabled={!canContinue} onClick={() => onSubmit(answer.current)}>
            Continue
          </button>
        )}
      </footer>
    </section>
  );
}

// An attempt that was running when the page was reloaded/closed (read once per page load).
let reloadedAttempt = activeAttempt.take();

export default function Catch() {
  const { lingoId = "" } = useParams();
  // Owl Raid try (from the raid waiting room): the raid's own challenge, outside the daily 4, one try.
  const raidId = useSearchParams()[0].get("raid") ?? undefined;
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
  const [errorCode, setErrorCode] = useState("");
  // Refused for good today (Lingo already tried / 4 Lingos tried / raid over…): no Start button.
  const [closed, setClosed] = useState(false);
  const [challenge, setChallenge] = useState<StartAttemptOutput | null>(null);
  // Tries left on this Lingo today after the latest start (2 a day; null until a try starts).
  const [lingoTriesLeft, setLingoTriesLeft] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(reloaded ? { kind: "forfeit" } : null);
  const token = useRef<string | null>(null);
  const appCheckTok = useRef<string | null>(null); // cached with the ID token for the forfeit request
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
      sendForfeit(token.current, challenge.attemptId, appCheckTok.current);
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
        sendForfeit(token.current, running.current, appCheckTok.current);
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
      [token.current, appCheckTok.current] = await Promise.all([auth.currentUser?.getIdToken() ?? null, appCheckToken()]);
      // No SpeechRecognition here → the server refuses voice challenges up front (no attempt used).
      const out = await api.startAttempt({ lingoId, lat: position.lat, lng: position.lng, speech: speechSupported(), ...(raidId ? { raidId } : {}) });
      submitted.current = false;
      setAttemptsLeft(out.attemptsLeft);
      if (out.lingoTriesLeft !== undefined) setLingoTriesLeft(out.lingoTriesLeft);
      setChallenge(out);
      setPhase("active");
    } catch (err) {
      const code = (err as { details?: { code?: string } }).details?.code;
      setNeedsSpeech(code === "needs-speech");
      setErrorCode(code ?? (err as { code?: string }).code ?? "");
      setClosed(["raid-tried", "raid-ended", "not-joined", "already-caught", "already-tried", "no-attempts", "disabled", "unverified"].includes(code ?? ""));
      setError(apiErrorMessage(err)); // names the Lingo by its stored name (= the brand's display name)
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
        recordAnswer(auth.currentUser?.uid, challenge.type, data.result === "won"); // Me → Your skills
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


  // Second try after a miss (SPEC §2): a fresh question; the same Lingo, so no other of the daily 4 is used.
  const retry = () => {
    setChallenge(null);
    setOutcome(null);
    setError("");
    setErrorCode("");
    submitted.current = false;
    lastAnswer.current = {};
    if (position) setPhase("ready");
    else void runPreflight(); // came here from a reload: no location yet
    api.getMyState({}).then(setMe, () => {});
  };

  const name = lingo ? lingoName(lingo) : `this ${BRAND.creatureName}`;
  const triesPerLingo = me?.triesPerLingo ?? 2;
  // Tries already used on this Lingo today (from the last start, else from getMyState).
  const used = lingoTriesLeft !== null ? triesPerLingo - lingoTriesLeft : triesUsed(lingoId, me);

  return (
    <main className="screen stack catch" data-phase={phase}>
      {(phase === "preflight" || phase === "ready" || phase === "starting") && lingo && (
        <div className="catch-spotlight" style={{ "--lingo": lingo.color } as React.CSSProperties} aria-hidden="true">
          <LingoArt lingo={lingo} />
        </div>
      )}
      <header className="catch-head">
        <div>
          <h1 style={{ margin: 0 }}>{raidId ? `${BRAND.raidName} · ${name}` : `Catch ${name}`}</h1>
          {raidId && (phase === "preflight" || phase === "ready" || phase === "starting") && (
            <p className="small muted" style={{ margin: 0 }} data-raid-try>
              One try · doesn't use your daily attempts
            </p>
          )}
          {!raidId && me && attemptsLeft !== null && (phase === "preflight" || phase === "ready" || phase === "starting") && (
            <p className="small muted" style={{ margin: 0 }}>
              Lingos left today: {attemptsLeft}/{me.attemptsPerDay}
            </p>
          )}
          {!raidId && me && used > 0 && used < triesPerLingo && (phase === "preflight" || phase === "ready" || phase === "starting") && (
            <p className="small muted" style={{ margin: 0 }} data-try-number>
              Try {used + 1} of {triesPerLingo} · a new question
            </p>
          )}
        </div>
      </header>

      {(phase === "preflight" || phase === "ready" || phase === "starting") && (
        <>
          <Preflight mic={mic} location={loc} onRetry={runPreflight} />
          {error && errorCode === "off-campus" ? (
            <EmptyState mood="lost" badge="📍" title="You're off campus" role="alert" data-empty="off-campus">
              <p className="muted">{error} Head back to {BRAND.campusName} and find a poster — then tap Start again.</p>
            </EmptyState>
          ) : error && (errorCode === "functions/unavailable" || errorCode === "functions/deadline-exceeded") ? (
            <EmptyState badge="📶" title="You're offline" role="alert" data-empty="offline">
              <p className="muted">{error}</p>
            </EmptyState>
          ) : (
            error && (
              <p className="error" role="alert">
                {error}
              </p>
            )
          )}
          {needsSpeech && <OpenInBrowser />}
          {phase !== "preflight" && !needsSpeech && !closed && (
            <button className="btn big" onClick={start} disabled={phase === "starting"}>
              {phase === "starting" ? "Starting…" : "Start"}
            </button>
          )}
          <Link className="btn link" to="/scan">
            Back to scanning
          </Link>
        </>
      )}

      {(phase === "active" || phase === "submitting") && challenge && (
        <Active challenge={challenge} lingo={lingo} checking={phase === "submitting"} onSubmit={submit} />
      )}

      {phase === "done" && outcome && (
        <Result
          outcome={outcome}
          lingoName={name}
          lingo={lingo}
          type={challenge?.type ?? null}
          heard={lastAnswer.current.transcript}
          attemptsLeft={raidId ? null : attemptsLeft}
          attemptsPerDay={me?.attemptsPerDay ?? null}
          raid={!!raidId}
          triesLeft={raidId ? null : (lingoTriesLeft ?? (me ? triesLeft(lingoId, me) : null))}
          onRetry={retry}
          prevLevel={me?.catches.find((x) => x.lingoId === lingoId && x.timesCaught > 0)?.level ?? null}
        />
      )}
    </main>
  );
}
