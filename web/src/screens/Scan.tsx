import { BRAND, lingoName } from "../config/brand";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LINGO_COUNT, type GetMyStateOutput, type Level } from "@shared/types";
import { CameraError } from "../ar/cameraError";
import type { Scanner } from "../ar/scanner";
import { loadTargets } from "../ar/targets";
import CameraHelp, { type ScanProblem } from "../components/CameraHelp";
import { CloseIcon, CoinIcon } from "../components/Icons";
import ScanOverlay from "../components/ScanOverlay";
import { periodWords } from "../lib/period";
import { api } from "../lib/api";
import { useRoundRefresh } from "../lib/myState";
import { useAuth } from "../lib/auth";
import { usingEmulators } from "../lib/firebase";
import { inAppBrowser } from "../lib/browser";
import { haptic, play } from "../lib/feedback";
import { catchStatus } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";
import { raidPhase, useOpenRaids } from "../lib/raids";
import { fmt } from "../lib/trainer";

type Status = "starting" | "scanning" | "problem";

declare const __TARGETS_VERSION__: string;

const IN_APP = inAppBrowser();
// Official brand: each Lingo is its 2D Duo pose as a paper standee (no .glb models are loaded).
// Placeholder brand: the 3D models from the lingos collection.
const STANDEE = BRAND.arMode === "standee";
/** Standee texture for poster i: the 1024 px PNG made at build, else the pose itself. */
const standeeUrl = (lingoId: string) => BRAND.lingoStandee[lingoId] ?? BRAND.lingoArt[lingoId] ?? null;
/** /ar-test?level=1|2|3|MAX previews a level look on every standee (staff only). */
const testLevel = (): Level | null => {
  const v = new URLSearchParams(window.location.search).get("level")?.toUpperCase();
  return v === "MAX" ? "MAX" : v === "1" || v === "2" || v === "3" ? (Number(v) as Level) : null;
};
// E2E tests on the emulators only: a fake scanner driven by window.__posterFound(i) (ar/fakeScanner.ts).
const FAKE_SCANNER = usingEmulators && (window as { __FAKE_SCANNER?: boolean }).__FAKE_SCANNER === true;

// Lazy-loaded route: MindAR + three.js live in this chunk only.
/**
 * @param testMode `/ar-test` (admin / volunteer): no server calls, catching off — for camera/tracking
 *   and level-look tests on real phones.
 */
export default function Scan({ testMode = false }: { testMode?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null); // the scan ring; follows the tracked poster
  const scannerRef = useRef<Scanner | null>(null); // for the standee level look
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
  const bumpMe = useCallback(() => setMeRun((n) => n + 1), []);
  useRoundRefresh(me, bumpMe); // a new round: the 4 Lingos come back
  const raids = useOpenRaids(!testMode); // polled (cost rules), for the "Join raid" button
  // Poster recognised but the `lingos` collection is empty (game data not seeded yet).
  const [bareposter, setBarePoster] = useState<number | null>(null);

  // Today's catches + attempts left; also auto-forfeits any open attempt (SPEC §3.5).
  useEffect(() => {
    if (testMode) return;
    let cancelled = false;
    setMeState((s) => (s === "ok" ? s : "loading")); // a round-boundary refresh keeps the card
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
      let ar: [typeof import("../ar/scanner"), typeof import("../ar/models") | null];
      try {
        // Test mode is signed out, so lingos may be unreadable: track bare posters instead.
        const lingosP = testMode ? loadLingos().catch(() => [] as Lingo[]) : loadLingos();
        // Day 8: the AR code (three.js + MindAR, ~470 KB) downloads in parallel with the targets and
        // Lingos instead of before the Scan screen can draw (camera prompt and help show at once).
        const arP = Promise.all([
          FAKE_SCANNER ? import("../ar/fakeScanner") : import("../ar/scanner"),
          STANDEE ? null : import("../ar/models"),
        ]);
        [lingos, targets, ar] = await Promise.all([lingosP, FAKE_SCANNER ? Promise.resolve("") : loadTargets(), arP]);
      } catch (err) {
        throw Object.assign(new Error((err as Error).message), { data: true });
      }
      if (cancelled) return;
      const [{ createScanner }, models] = ar;
      /** Shows Lingo `id`'s art / model on poster i (once per scanner session). */
      const show = (i: number, id: string, modelUrl: string, s: Scanner) => {
        const place = () => {
          if (cancelled) return;
          loaded.add(i);
          if (current === i) setModelReady(true);
        };
        if (STANDEE || !models) {
          const url = standeeUrl(id);
          if (!url) return;
          s.setStandee(i, url).then(place, (err) => console.error(`standee ${url}`, err));
          return;
        }
        const cached = models.cachedModel(modelUrl); // loaded on an earlier visit → instant
        if (cached) {
          s.setModel(i, cached);
          place();
          return;
        }
        models
          .loadModel(modelUrl)
          .then((model) => {
            if (cancelled) return;
            s.setModel(i, model);
            place();
          })
          .catch((err) => console.error(`model ${modelUrl}`, err));
      };
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
            // DECISION: /ar-test doesn't load the lingos collection; show the art / model by the file
            // naming convention (poster i → lingo-<2016+i>) so tracking + art can be checked on real
            // phones (and with no game data at all).
            setModelReady(loaded.has(i));
            if (testMode && !loaded.has(i)) show(i, `lingo-${2016 + i}`, `/assets/models/lingo-${2016 + i}.glb`, s);
            return;
          }
          setLingo(l);
          setModelReady(loaded.has(i));
          if (!loaded.has(i)) show(i, l.id, l.modelUrl, s);
        },
        onLost: (i) => {
          if (current !== i) return;
          current = null;
          setLingo(null);
          setBarePoster(null);
        },
      }, { marker: marker.current });
      scanner = s;
      scannerRef.current = s;
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
      scannerRef.current = null;
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
  // Standee level look (Lv 1 plain … MAX gold scallop). Re-applied when the art arrives and after a
  // catch levels the Lingo up (getMyState refresh) — a higher level plays the burst.
  const standeeLevel: Level | null = testMode ? testLevel() : (caught?.level ?? null);
  const posterInView = lingo?.posterIndex ?? (testMode ? bareposter : null);
  useEffect(() => {
    if (posterInView !== null) scannerRef.current?.setStandeeLevel(posterInView, standeeLevel);
  }, [posterInView, standeeLevel, modelReady]);

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
            <span className="hud-chip scan-chip" data-left={me.attemptsLeft} title={`Lingos left ${periodWords(me.round).now}`}>
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
              <p className="ar-hint">{BRAND.scanHint}</p>
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
                round={me?.round ?? null}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
