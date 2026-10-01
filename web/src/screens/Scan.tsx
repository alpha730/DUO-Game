import Placeholder from "../components/Placeholder";

// Lazy-loaded route: MindAR + three.js land here on Day 2 so other screens stay light.
export default function Scan() {
  return (
    <main className="screen with-nav stack">
      <h1>Scan</h1>
      <p className="muted">Point your camera at a Decade Hunt poster.</p>
      <Placeholder day={2}>AR camera and Lingo models</Placeholder>
    </main>
  );
}
