import { useEffect, useRef, useState } from "react";
import { LINGO_COUNT, type GetMyStateOutput } from "@shared/types";
import type { Object3D } from "three";
import { CameraError } from "../ar/cameraError";
import { cachedModel, loadModel } from "../ar/models";
import { createScanner, type Scanner } from "../ar/scanner";
import { loadTargets } from "../ar/targets";
import CameraHelp, { type ScanProblem } from "../components/CameraHelp";
import ScanOverlay from "../components/ScanOverlay";
import { api } from "../lib/api";
import { inAppBrowser } from "../lib/browser";
import { catchStatus } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";

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
  const [status, setStatus] = useState<Status>("starting");
  const [problem, setProblem] = useState<ScanProblem | null>(IN_APP ? { kind: "inApp", app: IN_APP } : null);
  const [run, setRun] = useState(0); // bump to retry
  const [lingo, setLingo] = useState<Lingo | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [me, setMe] = useState<GetMyStateOutput | null>(null);
  const [meState, setMeState] = useState<"loading" | "ok" | "error">("loading");
  const [meRun, setMeRun] = useState(0); // bump to retry getMyState
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
      try {
        // Test mode is signed out, so lingos may be unreadable: track bare posters instead.
        const lingosP = testMode ? loadLingos().catch(() => [] as Lingo[]) : loadLingos();
        [lingos, targets] = await Promise.all([lingosP, loadTargets()]);
      } catch (err) {
        throw Object.assign(new Error((err as Error).message), { data: true });
      }
      if (cancelled) return;
      const byPoster = new Map(lingos.map((l) => [l.posterIndex, l]));
      // DECISION: with no game data yet (e.g. production before seeding), still track every poster
      // so the camera and tracking can be tested; the card says the game isn't set up.
      const posters = byPoster.size ? [...byPoster.keys()] : Array.from({ length: LINGO_COUNT }, (_, i) => i);

      const s = createScanner(container.current!, targets, posters, {
        onFound: (i) => {
          current = i;
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
      });
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

  return (
    <main className={testMode ? "ar-screen no-nav" : "ar-screen"}>
      {testMode && <p className="ar-test-banner">AR test mode · {__TARGETS_VERSION__}</p>}
      <div
        ref={container}
        className="ar-stage"
        data-status={problem ? "problem" : status}
        data-found={lingo?.posterIndex ?? bareposter ?? ""}
        data-lingo={lingo?.id ?? ""}
        data-model={modelReady ? "ready" : ""}
      />
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
              <p className="ar-hint">Point your camera at a poster</p>
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
                <p>{lingo.name} is appearing…</p>
              </div>
            )}
            {status === "scanning" && lingo && testMode && (
              <section className="scan-card" role="status" data-kind="test">
                <h2 style={{ margin: 0 }}>
                  {lingo.name} · poster {lingo.posterIndex + 1}
                </h2>
                <p className="done">Test mode — catching is off.</p>
              </section>
            )}
            {status === "scanning" && lingo && !testMode && (
              <ScanOverlay
                lingo={lingo}
                status={catchStatus(lingo.id, me)}
                server={meState}
                onRetryServer={() => setMeRun((n) => n + 1)}
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
