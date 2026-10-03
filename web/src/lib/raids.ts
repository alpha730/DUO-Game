import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { COL, type RaidDoc, type RaidStatus } from "@shared/types";
import { db } from "./firebase";

export interface Raid {
  id: string;
  posterIndex: number;
  lingoId: string;
  startAt: number;
  endAt: number;
  minPlayers: number;
  joined: number;
  unlocked: boolean;
}

export const toRaid = (id: string, d: RaidDoc): Raid => ({
  id,
  posterIndex: d.posterIndex,
  lingoId: d.lingoId,
  startAt: d.startAt.toMillis(),
  endAt: d.endAt.toMillis(),
  minPlayers: d.minPlayers,
  joined: d.joined,
  unlocked: d.unlocked,
});

/** Phase by time (server time = Date.now() + offsetMs). The stored status only narrows the query. */
export function raidPhase(r: Pick<Raid, "startAt" | "endAt">, now: number): RaidStatus {
  return now < r.startAt ? "scheduled" : now < r.endAt ? "active" : "ended";
}

const POLL_MS = 30_000;

/**
 * Upcoming + live raids, re-fetched every 30 s and when the app comes back to the foreground.
 * DECISION (cost rules): not a live listener — `joined` changes on every join, and a listener on
 * every open Home/Scan screen would re-read the raid on each of them (≈1M reads per raid at 2k
 * screens × 500 joins). Polling costs ≈60k. Only the waiting room listens live.
 */
export function useOpenRaids(enabled = true): Raid[] {
  const [raids, setRaids] = useState<Raid[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () =>
      getDocs(query(collection(db, COL.raids), where("status", "in", ["scheduled", "active"])))
        .then((snap) => !cancelled && setRaids(snap.docs.map((d) => toRaid(d.id, d.data() as RaidDoc))))
        .catch(() => {});
    void load();
    const id = setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return raids;
}

/** Ticks every second; returns server-time now. */
export function useServerNow(offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    setNow(Date.now() + offsetMs);
    const id = setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => clearInterval(id);
  }, [offsetMs]);
  return now;
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
