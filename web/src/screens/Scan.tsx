import { useEffect, useRef, useState } from "react";
import { LINGO_COUNT } from "@shared/types";
import { createScanner, type Scanner } from "../ar/scanner";

type Status = "starting" | "scanning" | "found" | "error";

// Lazy-loaded route: MindAR + three.js live in this chunk only.
export default function Scan() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [found, setFound] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let scanner: Scanner | null = null;
    let cancelled = false;

    scanner = createScanner(
      container.current!,
      Array.from({ length: LINGO_COUNT }, (_, i) => i),
      {
        onFound: (i) => {
          setFound(i);
          setStatus("found");
        },
        onLost: (i) => {
          setFound((cur) => (cur === i ? null : cur));
          setStatus("scanning");
        },
      },
    );

    scanner
      .start()
      .then(() => {
        if (cancelled) scanner?.stop();
        else setStatus("scanning");
      })
      .catch((err: unknown) => {
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
      <div ref={container} className="ar-stage" data-status={status} data-found={found ?? ""} />
      <div className="ar-overlay">
        {status === "starting" && (
          <div className="ar-hint">
            <div className="spinner" />
            <p>Starting camera…</p>
          </div>
        )}
        {status === "scanning" && <p className="ar-hint">Point your camera at a poster</p>}
        {status === "found" && found !== null && <p className="ar-hint">Poster {found + 1} found</p>}
        {status === "error" && (
          <div className="ar-hint error" role="alert">
            Couldn't start the camera. {error}
          </div>
        )}
      </div>
    </main>
  );
}
