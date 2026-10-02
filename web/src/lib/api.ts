import { httpsCallable } from "firebase/functions";
import type {
  CompleteProfileInput,
  CompleteProfileOutput,
  GetMyStateInput,
  GetMyStateOutput,
  StartAttemptInput,
  StartAttemptOutput,
  SetFavoritesInput,
  SetFavoritesOutput,
  SubmitAttemptInput,
  SubmitAttemptOutput,
} from "@shared/types";
import { functions } from "./firebase";

// The SDK default is 70 s; on bad campus Wi-Fi we'd rather fail fast and show "Try again".
const DEFAULT_TIMEOUT_MS = 15_000;

const call =
  <I, O>(name: string, timeout = DEFAULT_TIMEOUT_MS) =>
  async (data: I): Promise<O> =>
    (await httpsCallable<I, O>(functions, name, { timeout })(data)).data;

// getMyState auto-forfeits open attempts (SPEC §3.5). If one is still in flight when the player taps
// Start, it could reach the server after startAttempt and forfeit the brand-new attempt.
// DECISION: startAttempt waits for this app's in-flight getMyState calls first (a received
// response means the server has already done its auto-forfeit).
const inflightState = new Set<Promise<unknown>>();
const getMyState = call<GetMyStateInput, GetMyStateOutput>("getMyState");
const startAttempt = call<StartAttemptInput, StartAttemptOutput>("startAttempt");

export const api = {
  completeProfile: call<CompleteProfileInput, CompleteProfileOutput>("completeProfile"),
  getMyState(data: GetMyStateInput): Promise<GetMyStateOutput> {
    const p = getMyState(data);
    inflightState.add(p);
    void p.finally(() => inflightState.delete(p)).catch(() => {});
    return p;
  },
  async startAttempt(data: StartAttemptInput): Promise<StartAttemptOutput> {
    await Promise.allSettled([...inflightState]);
    return startAttempt(data);
  },
  submitAttempt: call<SubmitAttemptInput, SubmitAttemptOutput>("submitAttempt"),
  setFavorites: call<SetFavoritesInput, SetFavoritesOutput>("setFavorites"),
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
