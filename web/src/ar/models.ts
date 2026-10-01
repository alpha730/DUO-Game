import type { Object3D } from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const pending = new Map<string, Promise<GLTF>>();
const ready = new Map<string, GLTF>();

/** Starts (or reuses) the download + parse of a .glb. Kept for the whole app session. */
function load(url: string): Promise<GLTF> {
  let p = pending.get(url);
  if (!p) {
    p = loader.loadAsync(url).then(
      (gltf) => {
        ready.set(url, gltf);
        return gltf;
      },
      (err: unknown) => {
        pending.delete(url); // let the next scan retry
        throw err;
      },
    );
    pending.set(url, p);
  }
  return p;
}

/** Synchronous copy if this model was already loaded this session (no spinner flash). */
export function cachedModel(url: string): Object3D | null {
  return ready.get(url)?.scene.clone(true) ?? null;
}

/**
 * A fresh copy of the model for one scanner session. The first call downloads and parses it; later
 * calls (even after leaving and re-opening /scan) are instant. Clones share geometry/material data —
 * a scanner's dispose() only frees GPU copies, which the next renderer re-uploads.
 */
export async function loadModel(url: string): Promise<Object3D> {
  const gltf = await load(url);
  return gltf.scene.clone(true);
}
