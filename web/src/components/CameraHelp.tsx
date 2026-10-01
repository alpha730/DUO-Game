import { useState } from "react";
import type { CameraProblem } from "../ar/cameraError";
import { openInChromeUrl, platform } from "../lib/browser";

export type ScanProblem = { kind: CameraProblem | "inApp" | "data"; app?: string; message?: string };

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.origin + "/scan");
      setCopied(true);
    } catch {
      prompt("Copy this link:", location.origin + "/scan");
    }
  };
  return (
    <button className="btn secondary" onClick={copy}>
      {copied ? "Link copied ✓" : "Copy link"}
    </button>
  );
}

/** Full-card explanation + next step when the camera can't run (SPEC §8, PLAN 2.7). */
export default function CameraHelp({
  problem,
  onRetry,
  onTryAnyway,
}: {
  problem: ScanProblem;
  onRetry: () => void;
  onTryAnyway?: () => void;
}) {
  const os = platform();
  const openBrowser = (
    <>
      {os === "android" && (
        <a className="btn" href={openInChromeUrl()}>
          Open in Chrome
        </a>
      )}
      <CopyLink />
    </>
  );

  let title: string;
  let body: React.ReactNode;
  let actions: React.ReactNode;

  switch (problem.kind) {
    case "inApp":
      title = "Open in your browser";
      body = (
        <>
          <p>The camera doesn't work properly inside {problem.app ?? "this app"}.</p>
          <p className="muted">
            {os === "ios"
              ? "Tap ••• or the share icon, then “Open in Safari”. Or copy the link and paste it into Safari."
              : "Tap ⋮ at the top, then “Open in Chrome”. Or use the button below."}
          </p>
        </>
      );
      actions = (
        <>
          {openBrowser}
          {onTryAnyway && (
            <button className="btn link" onClick={onTryAnyway}>
              Try here anyway
            </button>
          )}
        </>
      );
      break;
    case "denied":
      title = "Camera is blocked";
      body = (
        <>
          <p>We need your camera to find the Lingos on the posters.</p>
          <p className="muted">
            {os === "ios"
              ? "Tap “aA” in the address bar → Website Settings → Camera → Allow. Then tap Try again."
              : "Tap the 🔒 or ⓘ icon left of the address → Permissions → Camera → Allow. Then tap Try again."}
          </p>
        </>
      );
      actions = (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      );
      break;
    case "busy":
      title = "Camera is busy";
      body = <p>Another app is using the camera. Close it (video call, camera app…) and try again.</p>;
      actions = (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      );
      break;
    case "noCamera":
      title = "No camera found";
      body = <p>This device has no back camera we can use. Try a phone.</p>;
      actions = (
        <button className="btn secondary" onClick={onRetry}>
          Try again
        </button>
      );
      break;
    case "unsupported":
      title = "Camera not supported here";
      body = <p>This browser can't open the camera. Open the game in Chrome (Android) or Safari (iPhone).</p>;
      actions = openBrowser;
      break;
    case "data":
      title = "Couldn't load the posters";
      body = <p>{problem.message ?? "Check your internet connection."}</p>;
      actions = (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      );
      break;
    default:
      title = "Couldn't start the camera";
      body = <p>Close other apps that use the camera, then try again. If it keeps failing, restart the browser.</p>;
      actions = (
        <button className="btn" onClick={onRetry}>
          Try again
        </button>
      );
  }

  return (
    <section className="camera-help" role="alert" data-problem={problem.kind}>
      <h2>{title}</h2>
      {body}
      <div className="stack">{actions}</div>
    </section>
  );
}
