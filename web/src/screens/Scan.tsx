import { BRAND, lingoName } from "../config/brand";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LINGO_COUNT, type GetMyStateOutput } from "@shared/types";
import type { Object3D } from "three";
import { CameraError } from "../ar/cameraError";
import type { Scanner } from "../ar/scanner";
import { loadTargets } from "../ar/targets";
import CameraHelp, { type ScanProblem } from "../components/CameraHelp";
import { CloseIcon, CoinIcon } from "../components/Icons";
import ScanOverlay from "../components/ScanOverlay";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { inAppBrowser } from "../lib/browser";
import { haptic, play } from "../lib/feedback";
import { catchStatus } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";
import { raidPhase, useOpenRaids } from "../lib/raids";
import { fmt } from "../lib/trainer";

type Status = "starting" | "scanning" | "problem";

declare const __TARGETS_VERSION__: string;

const IN_APP = inAppBrowser();

// Lazy-loaded route: MindAR + three.js live in this chunk only.
/**
 * @param testMode `/ar-test`: no sign-in, no server calls, catching off — for camera/tracking tests
 *   on real phones before the game backend is live.
 */
export default function Scan({ testMode = false }: { testMode?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null); // the scan ring; follows the tracked poster
  const { profile } = useAuth();
  const [found, setFound] = useState(0); // bumps on every "poster found" (restarts the sparkle burst)
  const [status, setStatus] = useState<Status>("starting");
  const [problem, setProblem] = useState<ScanProblem | null>(IN_APP ? { kind: "inApp", app: IN_APP } : null);
  const [run, setRun] = useState(0); // bump to retry
  const [lingo, setLingo] = useState<Lingo | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [me, setMe] = useState<GetMyStateOutput | null>(null);
  const [meState, setMeState] = useState<"loading" | "ok" | "error">("loading");
  const [meRun, setMeRun] = useState(0); // bump to retry getMyState
  const raids = useOpenRaids(!testMode); // polled (cost rules), for the "Join raid" button
  // Poster recognised but the `lingos` collection is empty (game data not seeded yet).
  const [bareposter, setBarePoster] = useState<number | null>(null);

  // Today's catches + attempts left; also auto-forfeits any open attempt (SPEC §3.5).
  useEffect(() => {
    if (testMode) return;
    let cancelled = false;
    setMeState("loading");
    api
      .getMyState({})
      .then((s) => {
        if (cancelled) return;
        setMe(s);
        setMeState("ok");
      })
      .catch((err) => {
        console.warn("getMyState failed", err);
        if (!cancelled) setMeState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [meRun, testMode]);

  const blocked = problem !== null;

  useEffect(() => {
    if (blocked) return;
    let scanner: Scanner | null = null;
    let cancelled = false;
    const loaded = new Set<number>();
    let current: number | null = null; // posterIndex in view
    setStatus("starting");

    (async () => {
      let lingos: Lingo[];
      let targets: string;
      let ar: [typeof import("../ar/scanner"), typeof import("../ar/models")];
      try {
        // Test mode is signed out, so lingos may be unreadable: track bare posters instead.
        const lingosP = testMode ? loadLingos().catch(() => [] as Lingo[]) : loadLingos();
        // Day 8: the AR code (three.js + MindAR, ~470 KB) downloads in parallel with the targets and
        // Lingos instead of before the Scan screen can draw (camera prompt and help show at once).
        const arP = Promise.all([import("../ar/scanner"), import("../ar/models")]);
        [lingos, targets, ar] = await Promise.all([lingosP, loadTargets(), arP]);
      } catch (err) {
        throw Object.assign(new Error((err as Error).message), { data: true });
      }
      if (cancelled) return;
      const [{ createScanner }, { cachedModel, loadModel }] = ar;
      const byPoster = new Map(lingos.map((l) => [l.posterIndex, l]));
      // DECISION: with no game data yet (e.g. production before seeding), still track every poster
      // so the camera and tracking can be tested; the card says the game isn't set up.
      const posters = byPoster.size ? [...byPoster.keys()] : Array.from({ length: LINGO_COUNT }, (_, i) => i);

      const s = createScanner(container.current!, targets, posters, {
        onFound: (i) => {
          current = i;
          haptic.found();
          play("found");
          setFound((n) => n + 1);
          const l = byPoster.get(i);
          if (!l) {
            setBarePoster(i);
            // DECISION: /ar-test is signed out, so the lingos collection can't be read; show the model
            // by the file naming convention (poster i → lingo-<2016+i>.glb) so tracking + model can be
            // checked on real phones.
            if (testMode && !loaded.has(i)) {
              const url = `/assets/models/lingo-${2016 + i}.glb`;
              const cached = cachedModel(url);
              const place = (m: Object3D) => {
                if (cancelled) return;
                s.setModel(i, m);
                loaded.add(i);
                if (current === i) setModelReady(true);
              };
              if (cached) place(cached);
              else loadModel(url).then(place, (err) => console.error(`model ${url}`, err));
            }
            setModelReady(loaded.has(i));
            return;
          }
          setLingo(l);
          if (!loaded.has(i)) {
            const cached = cachedModel(l.modelUrl); // loaded on an earlier visit → instant
            if (cached) {
              s.setModel(i, cached);
              loaded.add(i);
            }
          }
          setModelReady(loaded.has(i));
          if (loaded.has(i)) return;
          loadModel(l.modelUrl)
            .then((model) => {
              if (cancelled) return;
              s.setModel(i, model);
              loaded.add(i);
              if (current === i) setModelReady(true);
            })
            .catch((err) => console.error(`model ${l.modelUrl}`, err));
        },
        onLost: (i) => {
          if (current !== i) return;
          current = null;
          setLingo(null);
          setBarePoster(null);
        },
      }, { marker: marker.current });
      scanner = s;
      await s.start();
      if (!cancelled) setStatus("scanning");
    })().catch((err: unknown) => {
      if (cancelled) return;
      console.error(err);
      scanner?.stop();
      setLingo(null);
      setStatus("problem");
      setProblem(
        err instanceof CameraError
          ? { kind: err.problem }
          : (err as { data?: boolean }).data
            ? { kind: "data", message: (err as Error).message }
            : { kind: "unknown" },
      );
    });

    return () => {
      cancelled = true;
      scanner?.stop();
    };
  }, [blocked, run]);

  const retry = () => {
    setProblem(null);
    setRun((n) => n + 1);
  };

  const tracking = status === "scanning" && (lingo !== null || bareposter !== null);
  // Poster lost → the ring floats back to the centre (the scanner only moves it while tracking).
  useEffect(() => {
    if (!tracking && marker.current) marker.current.style.transform = "";
  }, [tracking]);
  const caught = lingo ? me?.catches.find((c) => c.lingoId === lingo.id && c.timesCaught > 0) : undefined;

  return (
    <main className="ar-screen no-nav" data-tracking={tracking}>
      {testMode && <p className="ar-test-banner">AR test mode · {__TARGETS_VERSION__}</p>}
      <div
        ref={container}
        className="ar-stage"
        data-status={problem ? "problem" : status}
        data-found={lingo?.posterIndex ?? bareposter ?? ""}
        data-lingo={lingo?.id ?? ""}
        data-model={modelReady ? "ready" : ""}
      />
      {!problem && (
        <div className="scan-reticle" aria-hidden="true">
          <div ref={marker} className="scan-marker" data-locked={tracking}>
            <span className="scan-ring" />
            <span className="scan-ring inner" />
            {tracking && (
              <span key={found} className="sparkles">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} style={{ "--i": i } as React.CSSProperties} />
                ))}
              </span>
            )}
          </div>
        </div>
      )}
      {!testMode && (
        <header className="scan-top">
          <span className="hud-chip scan-chip" aria-label={`${fmt(profile?.points ?? 0)} points`}>
            <CoinIcon />
            <span>{fmt(profile?.points ?? 0)}</span>
          </span>
          {me && (
            <span className="hud-chip scan-chip" data-left={me.attemptsLeft} title="Lingos left today">
              <span className="hud-left-label">Lingos left </span>
              <strong>
                {me.attemptsLeft}/{me.attemptsPerDay}
              </strong>
            </span>
          )}
          <Link to="/home" className="scan-close" aria-label="Close scanner">
            <CloseIcon />
          </Link>
        </header>
      )}
      <div className="ar-overlay">
        {problem ? (
          <CameraHelp
            problem={problem}
            onRetry={retry}
            onTryAnyway={problem.kind === "inApp" ? retry : undefined}
          />
        ) : (
          <>
            {status === "starting" && (
              <div className="ar-hint">
                <div className="spinner" />
                <p>Starting camera…</p>
              </div>
            )}
            {status === "scanning" && !lingo && bareposter === null && (
              <p className="ar-hint">Point at a {BRAND.appName} poster</p>
            )}
            {status === "scanning" && bareposter !== null && (
              <section className="scan-card" role="status" data-kind="noGameData">
                <h2 style={{ margin: 0 }}>Poster {bareposter + 1} recognised</h2>
                <p className="done">
                  {testMode ? "Test mode — catching is off." : "The game isn't set up yet — check back when it starts."}
                </p>
              </section>
            )}
            {status === "scanning" && lingo && !modelReady && (
              <div className="ar-hint model-loading" aria-live="polite">
                <div className="spinner" />
                <p>{lingoName(lingo)} is appearing…</p>
              </div>
            )}
            {status === "scanning" && lingo && testMode && (
              <section className="scan-card" role="status" data-kind="test">
                <h2 style={{ margin: 0 }}>
                  {lingoName(lingo)} · poster {lingo.posterIndex + 1}
                </h2>
                <p className="done">Test mode — catching is off.</p>
              </section>
            )}
            {status === "scanning" && lingo && !testMode && (
              <ScanOverlay
                key={lingo.id}
                lingo={lingo}
                level={caught?.level ?? null}
                status={catchStatus(lingo.id, me)}
                server={meState}
                onRetryServer={() => setMeRun((n) => n + 1)}
                raid={raids.find((r) => r.posterIndex === lingo.posterIndex && raidPhase(r, Date.now()) === "active") ?? null}
                attemptsLeft={me?.attemptsLeft ?? null}
                attemptsPerDay={me?.attemptsPerDay ?? null}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
