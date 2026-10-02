import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { GetMyStateOutput, StartAttemptOutput } from "@shared/types";
import { requestLocation, requestMic, type CheckState, type Position } from "../catch/preflight";
import Preflight from "../components/Preflight";
import { api, apiErrorMessage } from "../lib/api";
import { auth } from "../lib/firebase";
import { loadLingos, type Lingo } from "../lib/lingos";

type Phase = "preflight" | "ready" | "starting" | "active";

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
  const [, setToken] = useState<string | null>(null);

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
      setToken((await auth.currentUser?.getIdToken()) ?? null);
      const out = await api.startAttempt({ lingoId, lat: position.lat, lng: position.lng });
      setChallenge(out);
      setPhase("active");
    } catch (err) {
      setError(apiErrorMessage(err));
      setPhase("ready");
    }
  }

  const name = lingo?.name ?? "this Lingo";

  return (
    <main className="screen stack" data-phase={phase}>
      <header className="catch-head">
        <span className="swatch" style={{ background: lingo?.color ?? "var(--surface-2)" }} aria-hidden="true" />
        <div>
          <h1 style={{ margin: 0 }}>Catch {name}</h1>
          {me && (
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

      {phase === "active" && challenge && (
        <section className="card" data-type={challenge.type}>
          <p className="small muted">Challenge: {challenge.type}</p>
        </section>
      )}
    </main>
  );
}
