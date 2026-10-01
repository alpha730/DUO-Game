/** Compiled from the 10 posters; target index = posterIndex (SPEC §8). Replace the file, not the code. */
export const TARGETS_URL = "/assets/targets.mind";

let cached: Promise<string> | null = null;

/**
 * Downloads targets.mind once and returns a blob: URL for MindAR.
 * We fetch it ourselves because MindAR swallows load errors inside a callback and its start()
 * then never settles — the screen would hang on "Starting camera…".
 */
export function loadTargets(): Promise<string> {
  cached ??= fetch(TARGETS_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Poster data missing (${res.status}).`);
      const blob = await res.blob();
      if (blob.size < 1024) throw new Error("Poster data is broken.");
      return URL.createObjectURL(blob);
    })
    .catch((err: unknown) => {
      cached = null; // retry on the next visit
      throw err instanceof TypeError ? new Error("No internet connection. Check Wi-Fi or mobile data.") : err;
    });
  return cached;
}
