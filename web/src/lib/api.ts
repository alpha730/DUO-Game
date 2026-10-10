import { httpsCallable } from "firebase/functions";
import type {
  AdminCreateRaidInput,
  AdminCreateRaidOutput,
  AdminPlayersOutput,
  AdminSetConfigInput,
  AdminStatsOutput,
  AdminUpsertQuestionsInput,
  AdminUpsertQuestionsOutput,
  CompleteProfileInput,
  CompleteProfileOutput,
  GetMyStateInput,
  GetMyStateOutput,
  JoinRaidInput,
  JoinRaidOutput,
  LockGameInput,
  LockGameOutput,
  StartAttemptInput,
  StartAttemptOutput,
  SetFavoritesInput,
  SetFavoritesOutput,
  SubmitAttemptInput,
  SubmitAttemptOutput,
} from "@shared/types";
import { functions } from "./firebase";
import { publishMyState } from "./myState";

// The SDK default is 70 s; on bad campus Wi-Fi we'd rather fail fast and show "Try again".
const DEFAULT_TIMEOUT_MS = 15_000;

const call =
  <I, O>(name: string, timeout = DEFAULT_TIMEOUT_MS) =>
  async (data: I): Promise<O> => {
    try {
      return (await httpsCallable<I, O>(functions, name, { timeout })(data)).data;
    } catch (err) {
      // Safari reports a request that failed for lack of a network as "internal"; with the phone
      // offline, every failure is "can't reach the server" (QA bug: iPhone showed "went wrong").
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw Object.assign(err instanceof Error ? err : new Error(String(err)), { code: "functions/unavailable" });
      }
      throw err;
    }
  };

// getMyState auto-forfeits open attempts (SPEC §3.5). If one is still in flight when the player taps
// Start, it could reach the server after startAttempt and forfeit the brand-new attempt.
// DECISION: startAttempt waits for this app's in-flight getMyState calls first (a received
// response means the server has already done its auto-forfeit).
const inflightState = new Set<Promise<unknown>>();
const fetchMyState = call<GetMyStateInput, GetMyStateOutput>("getMyState");
const getMyState = (data: GetMyStateInput) =>
  fetchMyState(data).then((s) => {
    publishMyState(s); // HUD + other screens see the newest numbers
    return s;
  });
const startAttempt = call<StartAttemptInput, StartAttemptOutput>("startAttempt");

// Day 8 (slow networks): getMyState is started as soon as a signed-in session is restored, in
// parallel with the profile listener, instead of after Home mounts. The first caller within 15 s
// takes that response.
let early: { p: Promise<GetMyStateOutput>; at: number } | null = null;

export const api = {
  completeProfile: call<CompleteProfileInput, CompleteProfileOutput>("completeProfile"),
  getMyState(data: GetMyStateInput): Promise<GetMyStateOutput> {
    if (early && Date.now() - early.at < 15_000) {
      const { p } = early;
      early = null;
      return p;
    }
    early = null;
    const p = getMyState(data);
    inflightState.add(p);
    void p.finally(() => inflightState.delete(p)).catch(() => {});
    return p;
  },
  /** Starts getMyState now; the next api.getMyState() call (within 15 s) gets its result. */
  prefetchMyState(): Promise<GetMyStateOutput> {
    if (early) return early.p;
    const p = api.getMyState({});
    p.catch(() => {
      if (early?.p === p) early = null; // a failed prefetch is never handed out
    });
    early = { p, at: Date.now() };
    return p;
  },
  async startAttempt(data: StartAttemptInput): Promise<StartAttemptOutput> {
    await Promise.allSettled([...inflightState]);
    return startAttempt(data);
  },
  submitAttempt: call<SubmitAttemptInput, SubmitAttemptOutput>("submitAttempt"),
  setFavorites: call<SetFavoritesInput, SetFavoritesOutput>("setFavorites"),
  joinRaid: call<JoinRaidInput, JoinRaidOutput>("joinRaid"),
  /** Admin "refresh now" (any player on the emulator). */
  refreshLeaderboard: call<Record<string, never>, { rows: number }>("adminRefreshLeaderboard"),
  // Admin (/admin, role admin — the server checks).
  adminStats: call<Record<string, never>, AdminStatsOutput>("adminStats"),
  adminSetConfig: call<AdminSetConfigInput, { ok: true }>("adminSetConfig"),
  adminUpsertQuestions: call<AdminUpsertQuestionsInput, AdminUpsertQuestionsOutput>("adminUpsertQuestions", 60_000),
  adminCreateRaid: call<AdminCreateRaidInput, AdminCreateRaidOutput>("adminCreateRaid"),
  lockGame: call<LockGameInput, LockGameOutput>("lockGame"),
  adminSuspicious: call<Record<string, never>, AdminPlayersOutput>("adminSuspicious"),
  adminTop20: call<Record<string, never>, AdminPlayersOutput>("adminTop20", 60_000),
};

/** User-facing text for a callable error. Server HttpsErrors already carry friendly messages. */
export function apiErrorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  switch (e.code) {
    case "functions/internal":
    case "functions/unknown":
      return "Something went wrong on our side. Please try again.";
    case "functions/unavailable":
    case "functions/deadline-exceeded":
      return "Can't reach the server. Check your internet and try again.";
    default:
      // The SDK appends the HTTP status, e.g. "... [409]".
      return e.message?.replace(/\s*\[\d{3}\]$/, "") || "Something went wrong. Please try again.";
  }
}
