import type { Object3D } from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cachedFetch } from "../lib/assetCache";

declare const __MODEL_VERSIONS__: Record<string, string>;
declare const __THREE_REV__: string;

// Models are Draco-compressed (< 500 KB, CLAUDE.md cost rules). The decoder (~250 KB wasm) is only
// fetched the first time a compressed model loads; it lives in a three-revision folder so the
// 30-day /assets cache can't serve a mismatched one.
const draco = new DRACOLoader();
draco.setDecoderPath(`/assets/draco/r${__THREE_REV__}/`);
draco.setDecoderConfig({ type: "wasm" });

const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

const pending = new Map<string, Promise<GLTF>>();
const ready = new Map<string, GLTF>();

/** /assets/models/x.glb → /assets/models/x.glb?v=<content hash> so a replaced model beats the 30-day cache. */
export function versionedUrl(url: string): string {
  const file = url.split("/").pop() ?? "";
  const v = __MODEL_VERSIONS__[file];
  return v && !url.includes("?") ? `${url}?v=${v}` : url;
}

/** Starts (or reuses) the download + parse of a .glb. Kept for the whole app session. */
function load(url: string): Promise<GLTF> {
  let p = pending.get(url);
  if (!p) {
    // Bytes come from the phone's asset cache after the first download (lib/assetCache.ts).
    p = cachedFetch(versionedUrl(url))
      .then((res) => {
        if (!res.ok) throw new Error(`Model ${url}: HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => loader.parseAsync(buf, url.slice(0, url.lastIndexOf("/") + 1)))
      .then(
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
