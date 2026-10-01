import { useEffect, useRef, useState } from "react";
import type { GetMyStateOutput } from "@shared/types";
import { CameraError } from "../ar/cameraError";
import { loadModel } from "../ar/models";
import { createScanner, type Scanner } from "../ar/scanner";
import { loadTargets } from "../ar/targets";
import CameraHelp, { type ScanProblem } from "../components/CameraHelp";
import ScanOverlay from "../components/ScanOverlay";
import { api } from "../lib/api";
import { inAppBrowser } from "../lib/browser";
import { catchStatus } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";

type Status = "starting" | "scanning" | "problem";

const IN_APP = inAppBrowser();

// Lazy-loaded route: MindAR + three.js live in this chunk only.
export default function Scan() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [problem, setProblem] = useState<ScanProblem | null>(IN_APP ? { kind: "inApp", app: IN_APP } : null);
  const [run, setRun] = useState(0); // bump to retry
  const [lingo, setLingo] = useState<Lingo | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [me, setMe] = useState<GetMyStateOutput | null>(null);

  // Today's catches + attempts left; also auto-forfeits any open attempt (SPEC §3.5).
  useEffect(() => {
    let cancelled = false;
    api
      .getMyState({})
      .then((s) => !cancelled && setMe(s))
      .catch((err) => console.warn("getMyState failed; overlay falls back to 'Catch it'", err));
    return () => {
      cancelled = true;
    };
  }, []);

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
        [lingos, targets] = await Promise.all([loadLingos(), loadTargets()]);
      } catch (err) {
        throw Object.assign(new Error((err as Error).message), { data: true });
      }
      if (cancelled) return;
      const byPoster = new Map(lingos.map((l) => [l.posterIndex, l]));

      const s = createScanner(container.current!, targets, [...byPoster.keys()], {
        onFound: (i) => {
          current = i;
          const l = byPoster.get(i)!;
          setLingo(l);
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
    <main className="ar-screen">
      <div
        ref={container}
        className="ar-stage"
        data-status={problem ? "problem" : status}
        data-found={lingo?.posterIndex ?? ""}
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
            {status === "scanning" && !lingo && <p className="ar-hint">Point your camera at a poster</p>}
            {status === "scanning" && lingo && (
              <ScanOverlay
                lingo={lingo}
                status={catchStatus(lingo.id, me)}
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
