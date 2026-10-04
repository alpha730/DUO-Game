// Big AR files stay on the phone (Day 8): targets.mind and the .glb models are kept in Cache Storage
// after the first download, so later scans (even days later, after the browser has evicted its
// HTTP cache) don't download them again. Files are byte-identical — nothing is re-encoded.
//
// Only content-hash URLs (`?v=<hash>`) are cached: a new file (e.g. the final posters) gets a new
// hash, is downloaded once, and replaces the old version of the same path.

export const ASSET_CACHE = "decade-hunt-assets";

async function openCache(): Promise<Cache | null> {
  try {
    // Missing on plain-http LAN testing (not a secure context) and in some private modes.
    return typeof caches === "undefined" ? null : await caches.open(ASSET_CACHE);
  } catch {
    return null;
  }
}

/** fetch() that answers from / fills the asset cache for versioned URLs. */
export async function cachedFetch(url: string): Promise<Response> {
  const abs = new URL(url, location.href);
  const versioned = abs.searchParams.has("v") && abs.searchParams.get("v") !== "missing";
  const cache = versioned ? await openCache() : null;
  if (cache) {
    const hit = await cache.match(abs.href).catch(() => undefined);
    if (hit) return hit;
  }
  const res = await fetch(abs.href);
  // The SPA rewrite answers a missing file with index.html (200): never cache that.
  if (cache && res.ok && !res.headers.get("content-type")?.includes("text/html")) {
    try {
      await cache.put(abs.href, res.clone());
      // Keep only this version of the file: drop the same path with any other ?v=.
      for (const req of await cache.keys()) {
        const u = new URL(req.url);
        if (u.pathname === abs.pathname && u.href !== abs.href) await cache.delete(req);
      }
    } catch {
      // Storage full or blocked: the file still works this time, it just isn't kept.
    }
  }
  return res;
}
