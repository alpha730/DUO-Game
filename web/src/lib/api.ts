import { httpsCallable } from "firebase/functions";
import type {
  CompleteProfileInput,
  CompleteProfileOutput,
  GetMyStateInput,
  GetMyStateOutput,
} from "@shared/types";
import { functions } from "./firebase";

// The SDK default is 70 s; on bad campus Wi-Fi we'd rather fail fast and show "Try again".
const DEFAULT_TIMEOUT_MS = 15_000;

const call =
  <I, O>(name: string, timeout = DEFAULT_TIMEOUT_MS) =>
  async (data: I): Promise<O> =>
    (await httpsCallable<I, O>(functions, name, { timeout })(data)).data;

export const api = {
  completeProfile: call<CompleteProfileInput, CompleteProfileOutput>("completeProfile"),
  getMyState: call<GetMyStateInput, GetMyStateOutput>("getMyState"),
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
