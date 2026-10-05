import { useCallback, useEffect, useState } from "react";
import type { GetMyStateOutput } from "@shared/types";
import { api } from "./api";

// The latest getMyState answer, shared by the screens with the HUD (Home, Dex, Leaderboard) so a
// tab switch doesn't flash empty numbers. Every api.getMyState() response lands here (api.ts).
let last: { state: GetMyStateOutput; at: number } | null = null;
const listeners = new Set<() => void>();

export function publishMyState(state: GetMyStateOutput): void {
  last = { state, at: Date.now() };
  listeners.forEach((f) => f());
}

/** Server time − phone time, from the latest answer (for countdowns). */
export const serverOffsetMs = () => (last ? last.state.serverNow - last.at : 0);

/**
 * My state for a screen. Fetches on mount when the shared copy is older than `maxAgeMs`
 * (0 = always, e.g. Home after a catch — getMyState also auto-forfeits an open attempt).
 */
export function useMyState(maxAgeMs = 0) {
  const [state, setState] = useState<GetMyStateOutput | null>(last?.state ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const update = () => last && setState(last.state);
    listeners.add(update);
    return () => void listeners.delete(update);
  }, []);

  const reload = useCallback(() => {
    setError(false);
    api.getMyState({}).catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!last || Date.now() - last.at > maxAgeMs) reload();
  }, [maxAgeMs, reload]);

  return { state, error, reload };
}
