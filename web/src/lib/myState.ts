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

// setTimeout's limit (~24.8 days); a later boundary is re-checked on the next fetch anyway.
const MAX_DELAY_MS = 2 ** 31 - 1;
/** Fetch a little after the boundary, so the server (the timer) is surely past it. */
const BOUNDARY_SLACK_MS = 1500;

/**
 * One-day event: calls `reload` when the round in `state` ends, or when the next one starts (server
 * time, via the serverNow offset), so "Round 1 of 3 · until 11:30" turns into "Round 2 starts at
 * 12:30" and then "Round 2 of 3 · until 14:00" without a manual refresh. Each new answer re-arms it.
 * Nothing to do for the multi-day game (round = null) or after the last round.
 */
export function useRoundRefresh(state: GetMyStateOutput | null, reload: () => void): void {
  const round = state?.round;
  const serverAt = state?.serverNow;
  useEffect(() => {
    if (!round) return;
    const now = Date.now() + serverOffsetMs();
    const next = round.active ? round.endAt : now < round.startAt ? round.startAt : null;
    if (next === null) return;
    const t = setTimeout(reload, Math.min(Math.max(next - now, 0) + BOUNDARY_SLACK_MS, MAX_DELAY_MS));
    return () => clearTimeout(t);
  }, [round, serverAt, reload]);
}
