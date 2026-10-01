// AR engine for the Scan screen. Only imported from screens/Scan.tsx (lazy route), so MindAR,
// TensorFlow.js and three.js never land in the bundle for other screens.
// DECISION: three is pinned to 0.151.3 — mind-ar 1.2.5 imports `sRGBEncoding`, removed in three r152.
import { MindARThree, type MindARAnchor } from "mind-ar/dist/mindar-image-three.prod.js";
import { Clock, DirectionalLight, HemisphereLight, type Object3D } from "three";

/** Compiled from the 10 posters; target index = posterIndex (SPEC §8). Replace the file, not the code. */
export const TARGETS_URL = "/assets/targets.mind";

export interface ScannerEvents {
  onFound(posterIndex: number): void;
  onLost(posterIndex: number): void;
}

export interface Scanner {
  start(): Promise<void>;
  stop(): void;
  /** Places `model` on the poster's anchor (replacing anything there). */
  setModel(posterIndex: number, model: Object3D): void;
}

// Anchor space: the poster is the XY plane, 1 unit = poster width, +Z points at the camera.
const MODEL_SIZE = 0.45;
const HOVER_Z = 0.3;
const BOB_HEIGHT = 0.04;

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

  mindar.scene.add(new HemisphereLight(0xffffff, 0x444466, 1.2));
  const sun = new DirectionalLight(0xffffff, 1);
  sun.position.set(0.5, 1, 2);
  mindar.scene.add(sun);

  const anchors = new Map<number, MindARAnchor>();
  const models = new Map<number, Object3D>();
  for (const i of posterIndexes) {
    const anchor = mindar.addAnchor(i);
    anchor.onTargetFound = () => events.onFound(i);
    anchor.onTargetLost = () => events.onLost(i);
    anchors.set(i, anchor);
  }

  const clock = new Clock();
  let running = false;

  function animate() {
    const t = clock.getElapsedTime();
    // Gentle idle bob + sway on every model; MindAR hides anchors that aren't tracked.
    for (const model of models.values()) {
      model.position.z = HOVER_Z + Math.sin(t * 2.2) * BOB_HEIGHT;
      model.rotation.y = Math.sin(t * 0.9) * 0.35;
    }
    mindar.renderer.render(mindar.scene, mindar.camera);
  }

  return {
    async start() {
      await mindar.start();
      running = true;
      clock.start();
      mindar.renderer.setAnimationLoop(animate);
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
    setModel(i, model) {
      const anchor = anchors.get(i);
      if (!anchor) return;
      const old = models.get(i);
      if (old) anchor.group.remove(old);
      model.scale.setScalar(MODEL_SIZE);
      model.position.set(0, 0, HOVER_Z);
      anchor.group.add(model);
      models.set(i, model);
    },
  };
}
