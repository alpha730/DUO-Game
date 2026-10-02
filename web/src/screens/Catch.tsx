import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { GetMyStateOutput, StartAttemptOutput, SubmitAttemptInput, SubmitAttemptOutput } from "@shared/types";
import { requestLocation, requestMic, type CheckState, type Position } from "../catch/preflight";
import { useCountdown } from "../catch/useCountdown";
import Preflight from "../components/Preflight";
import TimerBar from "../components/TimerBar";
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
  return (
    <section className="card stack" data-type={challenge.type}>
      <TimerBar leftMs={leftMs} totalMs={totalMs} />
      <p className="small muted">Challenge: {challenge.type}</p>
    </section>
  );
}

export default function Catch() {
  const { lingoId = "" } = useParams();
  const [lingo, setLingo] = useState<Lingo | null>(null);
  const [me, setMe] = useState<GetMyStateOutput | null>(null);
  const [phase, setPhase] = useState<Phase>("preflight");
  const [mic, setMic] = useState<CheckState>("idle");
  const [loc, setLoc] = useState<CheckState>("idle");
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<StartAttemptOutput | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const token = useRef<string | null>(null);
  const submitted = useRef(false);

  // Mount: auto-forfeit any open attempt (SPEC §3.5) + attempts left; Lingo name/colour.
  useEffect(() => {
    api.getMyState({}).then(setMe, () => {});
    loadLingos().then((ls) => setLingo(ls.find((l) => l.id === lingoId) ?? null), () => {});
  }, [lingoId]);

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
    void runPreflight();
  }, [runPreflight]);

  async function start() {
    if (!position) return;
    setPhase("starting");
    setError("");
    try {
      // Cache the ID token now so the one-chance forfeit needs no async work later (SPEC §3.4).
      token.current = (await auth.currentUser?.getIdToken()) ?? null;
      const out = await api.startAttempt({ lingoId, lat: position.lat, lng: position.lng });
      submitted.current = false;
      setChallenge(out);
      setPhase("active");
    } catch (err) {
      setError(apiErrorMessage(err));
      setPhase("ready");
    }
  }

  const submit = useCallback(
    async (answer: Answer) => {
      if (!challenge || submitted.current) return; // one answer per attempt (timer vs. tap race)
      submitted.current = true;
      setPhase("submitting");
      try {
        const data = await api.submitAttempt({ attemptId: challenge.attemptId, ...answer });
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

  const name = lingo?.name ?? "this Lingo";

  return (
    <main className="screen stack" data-phase={phase}>
      <header className="catch-head">
        <span className="swatch" style={{ background: lingo?.color ?? "var(--surface-2)" }} aria-hidden="true" />
        <div>
          <h1 style={{ margin: 0 }}>Catch {name}</h1>
          {me && phase !== "active" && (
            <p className="small muted" style={{ margin: 0 }}>
              Attempts left today: {me.attemptsLeft}/{me.attemptsPerDay}
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
          {phase !== "preflight" && (
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
        <section className="card" data-outcome={outcome.kind}>
          <p>Result: {outcome.kind}</p>
        </section>
      )}
    </main>
  );
}
