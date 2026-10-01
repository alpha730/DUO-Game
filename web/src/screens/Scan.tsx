import { useRef } from "react";
import { createScanner } from "../ar/scanner";
import Placeholder from "../components/Placeholder";

// Lazy-loaded route: MindAR + three.js live in this chunk only.
export default function Scan() {
  const container = useRef<HTMLDivElement>(null);
  return (
    <main className="screen with-nav stack">
      <h1>Scan</h1>
      <p className="muted">Point your camera at a Decade Hunt poster.</p>
      <div ref={container} data-ar-ready={typeof createScanner === "function"} />
      <Placeholder day={2}>AR camera and Lingo models</Placeholder>
    </main>
  );
}
