import type { CheckState } from "../catch/preflight";
import { platform } from "../lib/browser";

const ICON: Record<CheckState, string> = { idle: "○", asking: "…", ok: "✓", denied: "✕", unavailable: "!" };

function Row({ label, state, help }: { label: string; state: CheckState; help: string }) {
  return (
    <li className="check-row" data-state={state}>
      <span className="check-icon" aria-hidden="true">
        {ICON[state]}
      </span>
      <div>
        <strong>{label}</strong>
        {(state === "denied" || state === "unavailable") && <p className="small muted">{help}</p>}
      </div>
    </li>
  );
}

/** Mic + location checklist shown before the Start button (SPEC §3.1). */
export default function Preflight({
  mic,
  location,
  onRetry,
}: {
  mic: CheckState;
  location: CheckState;
  onRetry: () => void;
}) {
  const ios = platform() === "ios";
  const micHelp =
    mic === "denied"
      ? ios
        ? "Tap “aA” in the address bar → Website Settings → Microphone → Allow."
        : "Tap the 🔒 icon left of the address → Permissions → Microphone → Allow."
      : "No microphone found. Close other apps using it and try again.";
  const locHelp =
    location === "denied"
      ? ios
        ? "Tap “aA” → Website Settings → Location → Allow. Also check Settings → Privacy → Location Services → Safari."
        : "Tap the 🔒 icon → Permissions → Location → Allow, and make sure location (GPS) is on."
      : "Couldn't get your location. Turn on location/GPS, step outside if you can, and try again.";

  const stuck = [mic, location].some((s) => s === "denied" || s === "unavailable");
  // Plain http (e.g. testing on a laptop's Wi-Fi address): phones block the mic and location outright.
  const insecure = typeof window !== "undefined" && !window.isSecureContext;
  return (
    <section className="card stack" aria-live="polite">
      <h2 style={{ margin: 0 }}>Before you start</h2>
      <p className="small muted" style={{ margin: 0 }}>
        You get one chance — leaving the app during the challenge loses it.
      </p>
      <ul className="checklist">
        <Row label="Microphone" state={mic} help={micHelp} />
        <Row label="Location (on campus)" state={location} help={locHelp} />
      </ul>
      {stuck && insecure && (
        <p className="error" role="alert" data-insecure>
          This link isn't secure (http), so the phone blocks the microphone and location. Open the game from its https link.
        </p>
      )}
      {stuck && (
        <button className="btn secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}
