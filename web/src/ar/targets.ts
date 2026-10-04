import { cachedFetch } from "../lib/assetCache";

declare const __TARGETS_VERSION__: string;

/**
 * Compiled from the 10 posters; target index = posterIndex (SPEC §8). Replace the file, not the code.
 * The ?v= content hash (vite.config.ts) lets Hosting cache it for 30 days.
 */
export const TARGETS_URL = `/assets/targets.mind?v=${__TARGETS_VERSION__}`;
/** Same file gzipped (~half the size): Hosting doesn't compress .mind files itself. */
export const TARGETS_GZ_URL = `/assets/targets.mind.gz?v=${__TARGETS_VERSION__}`;

const canGunzip = typeof DecompressionStream === "function";

/** gzip magic bytes 1f 8b (absent if a server/browser already undid the compression). */
async function unpack(blob: Blob): Promise<Blob> {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (head[0] !== 0x1f || head[1] !== 0x8b) return blob;
  return new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).blob();
}

let cached: Promise<string> | null = null;

/**
 * Downloads targets.mind once and returns a blob: URL for MindAR.
 * We fetch it ourselves because MindAR swallows load errors inside a callback and its start()
 * then never settles — the screen would hang on "Starting camera…".
 */
export function loadTargets(): Promise<string> {
  // Browsers without DecompressionStream (iOS < 16.4) download the raw file.
  // Kept on the phone after the first download (lib/assetCache.ts).
  cached ??= cachedFetch(canGunzip ? TARGETS_GZ_URL : TARGETS_URL)
    .then(async (res) => {
      // The SPA rewrite answers a missing file with index.html (200), so check the type too.
      if (!res.ok || res.headers.get("content-type")?.includes("text/html")) {
        throw new Error(`Poster data missing (${res.status}).`);
      }
      const blob = canGunzip ? await unpack(await res.blob()) : await res.blob();
      if (blob.size < 1024) throw new Error("Poster data is broken.");
      return URL.createObjectURL(blob);
    })
    .catch((err: unknown) => {
      cached = null; // retry on the next visit
      throw err instanceof TypeError ? new Error("No internet connection. Check Wi-Fi or mobile data.") : err;
    });
  return cached;
}
