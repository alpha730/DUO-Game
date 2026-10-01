// AR engine for the Scan screen. Only imported from screens/Scan.tsx (lazy route), so MindAR,
// TensorFlow.js and three.js never land in the bundle for other screens.
// DECISION: three is pinned to 0.151.3 — mind-ar 1.2.5 imports `sRGBEncoding`, removed in three r152.
import { MindARThree, type MindARAnchor } from "mind-ar/dist/mindar-image-three.prod.js";

/** Compiled from the 10 posters; target index = posterIndex (SPEC §8). Replace the file, not the code. */
export const TARGETS_URL = "/assets/targets.mind";

export interface ScannerEvents {
  onFound(posterIndex: number): void;
  onLost(posterIndex: number): void;
}

export interface Scanner {
  start(): Promise<void>;
  stop(): void;
  /** Anchor group for a poster; add the Lingo model here. */
  anchor(posterIndex: number): MindARAnchor;
  readonly mindar: MindARThree;
}

/**
 * @param posterIndexes which targets to track (one anchor each) — from the `lingos` collection.
 */
export function createScanner(container: HTMLElement, posterIndexes: number[], events: ScannerEvents): Scanner {
  // Each scanner gets its own root so stopping one (e.g. React StrictMode's double mount) never
  // removes another scanner's video/canvas.
  const root = document.createElement("div");
  root.className = "ar-root";
  container.append(root);

  const mindar = new MindARThree({
    container: root,
    imageTargetSrc: TARGETS_URL,
    maxTrack: 1,
    uiLoading: "no",
    uiScanning: "no",
    uiError: "no",
    // Smoother pose on cheap phones (less jitter, slightly more lag).
    filterMinCF: 0.0001,
    filterBeta: 0.001,
  });

  const anchors = new Map<number, MindARAnchor>();
  for (const i of posterIndexes) {
    const anchor = mindar.addAnchor(i);
    anchor.onTargetFound = () => events.onFound(i);
    anchor.onTargetLost = () => events.onLost(i);
    anchors.set(i, anchor);
  }

  let running = false;

  return {
    mindar,
    anchor: (i) => anchors.get(i)!,
    async start() {
      await mindar.start();
      running = true;
      mindar.renderer.setAnimationLoop(() => mindar.renderer.render(mindar.scene, mindar.camera));
    },
    stop() {
      if (running) {
        running = false;
        mindar.renderer.setAnimationLoop(null);
        mindar.stop();
      }
      // MindAR appends its video + canvases to the root; remove them with it.
      root.remove();
    },
  };
}
