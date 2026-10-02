// One-chance rule (SPEC §3.4). Everything here must be synchronous: it runs while the page is
// being hidden or unloaded, when awaiting anything is not safe.

/** Same-origin endpoint (Hosting rewrite / Vite proxy → forfeitAttempt): no CORS preflight. */
export const FORFEIT_URL = "/api/forfeit";
const KEY = "decade-hunt:active-attempt";

/** Fire-and-forget forfeit with the ID token cached at Start. */
export function sendForfeit(token: string | null, attemptId: string): void {
  if (!token) return; // the server auto-forfeits it on the next getMyState/startAttempt anyway
  try {
    void fetch(FORFEIT_URL, {
      method: "POST",
      keepalive: true,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId }),
    }).catch(() => {});
  } catch {
    /* page is going away; nothing else to do */
  }
}

/** Remembers the running attempt so a reload can show "Chance lost". */
export const activeAttempt = {
  set(lingoId: string, attemptId: string) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ lingoId, attemptId }));
    } catch {
      /* storage blocked */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* storage blocked */
    }
  },
  /** Returns and clears the attempt left running when the page was reloaded/closed. */
  take(): { lingoId: string; attemptId: string } | null {
    try {
      const raw = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};
