// AR engine for the Scan screen. Only imported from screens/Scan.tsx (lazy route), so MindAR,
// TensorFlow.js and three.js never land in the bundle for other screens.
// DECISION: three is pinned to 0.151.3 — mind-ar 1.2.5 imports `sRGBEncoding`, removed in three r152.
import { MindARThree, type MindARAnchor } from "mind-ar/dist/mindar-image-three.prod.js";
import { Clock, DirectionalLight, HemisphereLight, Texture, Vector3, type Mesh, type Object3D } from "three";
import { withCameraErrors } from "./cameraError";

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
 * @param targetsSrc URL of the compiled targets (from loadTargets()).
 * @param posterIndexes which targets to track (one anchor each) — from the `lingos` collection.
 */
export function createScanner(
  container: HTMLElement,
  targetsSrc: string,
  posterIndexes: number[],
  events: ScannerEvents,
): Scanner {
  // Each scanner gets its own root so stopping one (e.g. React StrictMode's double mount) never
  // removes another scanner's video/canvas.
  const root = document.createElement("div");
  root.className = "ar-root";
  container.append(root);

  const mindar = new MindARThree({
    container: root,
    imageTargetSrc: targetsSrc,
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
  let starting = false;
  let stopped = false;

  // Dev-only probe for automated tracking tests (which poster is tracked, where it is on screen).
  if (import.meta.env.DEV) {
    const v = new Vector3();
    (window as unknown as { __arDebug?: unknown }).__arDebug = {
      tracked: () => [...anchors].filter(([, a]) => a.group.visible).map(([i]) => i),
      screen: (i: number) => {
        anchors.get(i)!.group.getWorldPosition(v).project(mindar.camera);
        return [((v.x + 1) / 2) * root.clientWidth, ((1 - v.y) / 2) * root.clientHeight];
      },
    };
  }

  /** Camera off + everything freed. Safe in any state, including after a failed start. */
  function teardown() {
    mindar.renderer.setAnimationLoop(null);
    // Not mindar.stop(): it throws if start() failed after opening the camera (no controller yet),
    // which would leave the camera light on.
    mindar.controller?.stopProcessVideo();
    const stream = mindar.video?.srcObject as MediaStream | null | undefined;
    stream?.getTracks().forEach((t) => t.stop());
    mindar.video?.remove();
    dispose();
  }

  /** Frees everything MindAR's own stop() leaves behind (SPEC §8: dispose the scene on leave). */
  function dispose() {
    // The image-matching worker: MindAR's dispose() only messages it, so terminate it ourselves.
    const controller = mindar.controller;
    controller?.dispose();
    controller?.worker?.terminate();

    mindar.scene.traverse((obj) => {
      const mesh = obj as Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const m of materials) {
        for (const value of Object.values(m)) if (value instanceof Texture) value.dispose();
        m.dispose();
      }
    });
    mindar.scene.clear();
    models.clear();

    // Phones allow only a few WebGL contexts; release ours instead of waiting for GC.
    mindar.renderer.dispose();
    mindar.renderer.forceContextLoss();

    // MindAR registers window "resize" with an anonymous bound function we can't remove; neuter it.
    mindar.resize = () => {};
    // Each MindAR instance adds its UI <style> to <head>; drop them so visits don't pile up.
    for (const s of document.head.querySelectorAll("style")) {
      if (s.textContent?.startsWith(".mindar-ui-overlay")) s.remove();
    }

    // MindAR appends its canvases to the root; remove them with it.
    root.remove();
  }

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
      starting = true;
      try {
        await withCameraErrors(() => mindar.start());
      } finally {
        starting = false;
        // Left the screen while the camera was starting: finish the stop now that it's open.
        if (stopped) teardown();
      }
      if (stopped) return;
      clock.start();
      mindar.renderer.setAnimationLoop(animate);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (!starting) teardown(); // otherwise start() tears down when the camera finishes opening
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
