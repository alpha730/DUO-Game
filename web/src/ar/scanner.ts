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

export interface ScannerOptions {
  /**
   * Element that follows the tracked poster on screen: each frame gets
   * `transform: translate(x, y)` (poster centre, px) and `--poster-w` (poster width, px).
   * Written straight to the DOM — no React render per frame.
   */
  marker?: HTMLElement | null;
}

export interface Scanner {
  start(): Promise<void>;
  stop(): void;
  /** Places `model` on the poster's anchor (replacing anything there). */
  setModel(posterIndex: number, model: Object3D): void;
}

// MindAR binds window "resize" to this.resize in its constructor and never removes it; after a failed
// start (camera denied) or a stop it throws on the next resize/rotation. Guard it on the prototype, so
// the bound copy each instance makes is the guarded one.
type ResizeGuard = { resize(): void; controller?: unknown; __stopped?: boolean };
const proto = MindARThree.prototype as unknown as ResizeGuard;
const mindarResize = proto.resize;
proto.resize = function (this: ResizeGuard) {
  if (this.controller && !this.__stopped) mindarResize.call(this);
};

// Anchor space: the poster is the XY plane, 1 unit = poster width, +Z points at the camera.
const MODEL_SIZE = 0.45;
const HOVER_Z = 0.3;
const BOB_HEIGHT = 0.04;
/** Pop-in when a Lingo appears: 0 → full size with a little overshoot. */
const POP_MS = 520;
const popScale = (k: number) => (k >= 1 ? 1 : 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2);

/**
 * @param targetsSrc URL of the compiled targets (from loadTargets()).
 * @param posterIndexes which targets to track (one anchor each) — from the `lingos` collection.
 */
export function createScanner(
  container: HTMLElement,
  targetsSrc: string,
  posterIndexes: number[],
  events: ScannerEvents,
  options: ScannerOptions = {},
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
  const popAt = new Map<number, number>(); // posterIndex → performance.now() when its pop-in started
  for (const i of posterIndexes) {
    const anchor = mindar.addAnchor(i);
    anchor.onTargetFound = () => {
      popAt.set(i, performance.now());
      events.onFound(i);
    };
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

    // MindAR's window "resize" listener can't be removed; the prototype guard above makes it a no-op.
    (mindar as unknown as ResizeGuard).__stopped = true;
    // Each MindAR instance adds its UI <style> to <head>; drop them so visits don't pile up.
    for (const s of document.head.querySelectorAll("style")) {
      if (s.textContent?.startsWith(".mindar-ui-overlay")) s.remove();
    }

    // MindAR appends its canvases to the root; remove them with it.
    root.remove();
  }

  const centre = new Vector3();
  const edge = new Vector3();
  function placeMarker() {
    const marker = options.marker;
    if (!marker) return;
    const tracked = [...anchors.values()].find((a) => a.group.visible);
    if (!tracked) return;
    const w = root.clientWidth;
    const h = root.clientHeight;
    tracked.group.localToWorld(centre.set(0, 0, 0)).project(mindar.camera);
    tracked.group.localToWorld(edge.set(0.5, 0, 0)).project(mindar.camera);
    const x = ((centre.x + 1) / 2) * w;
    const y = ((1 - centre.y) / 2) * h;
    const half = Math.hypot(((edge.x - centre.x) / 2) * w, ((edge.y - centre.y) / 2) * h);
    marker.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    marker.style.setProperty("--poster-w", `${Math.min(Math.max(half * 2, 80), Math.max(w, h)).toFixed(0)}px`);
  }

  function animate() {
    const t = clock.getElapsedTime();
    const now = performance.now();
    // Pop-in, then a gentle idle bob + sway on every model; MindAR hides anchors that aren't tracked.
    for (const [i, model] of models) {
      const k = Math.min(1, (now - (popAt.get(i) ?? 0)) / POP_MS);
      model.scale.setScalar(MODEL_SIZE * Math.max(0.001, popScale(k)));
      model.position.z = HOVER_Z + Math.sin(t * 2.2) * BOB_HEIGHT;
      model.rotation.y = Math.sin(t * 0.9) * 0.35 + (1 - k) * Math.PI * 1.5;
    }
    placeMarker();
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
      popAt.set(i, performance.now()); // the model just arrived (it may have loaded after the poster was found)
    },
  };
}
