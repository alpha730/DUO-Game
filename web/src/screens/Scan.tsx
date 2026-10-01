import { useEffect, useRef, useState } from "react";
import type { GetMyStateOutput } from "@shared/types";
import { loadModel } from "../ar/models";
import { createScanner, type Scanner } from "../ar/scanner";
import ScanOverlay from "../components/ScanOverlay";
import { api } from "../lib/api";
import { catchStatus } from "../lib/catchStatus";
import { loadLingos, type Lingo } from "../lib/lingos";

type Status = "starting" | "scanning" | "error";

// Lazy-loaded route: MindAR + three.js live in this chunk only.
export default function Scan() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [lingo, setLingo] = useState<Lingo | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState("");
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

  useEffect(() => {
    let scanner: Scanner | null = null;
    let cancelled = false;
    const loaded = new Set<number>();
    let current: number | null = null; // posterIndex in view

    (async () => {
      const lingos = await loadLingos();
      if (cancelled) return;
      const byPoster = new Map(lingos.map((l) => [l.posterIndex, l]));

      const s = createScanner(container.current!, [...byPoster.keys()], {
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
      if (cancelled) s.stop();
      else setStatus("scanning");
    })().catch((err: unknown) => {
      if (cancelled) return;
      console.error(err);
      setError(String((err as Error)?.message ?? err));
      setStatus("error");
    });

    return () => {
      cancelled = true;
      scanner?.stop();
    };
  }, []);

  return (
    <main className="ar-screen">
      <div
        ref={container}
        className="ar-stage"
        data-status={status}
        data-found={lingo?.posterIndex ?? ""}
        data-lingo={lingo?.id ?? ""}
        data-model={modelReady ? "ready" : ""}
      />
      <div className="ar-overlay">
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
        {status === "error" && (
          <div className="ar-hint error" role="alert">
            Couldn't start the camera. {error}
          </div>
        )}
      </div>
    </main>
  );
}
