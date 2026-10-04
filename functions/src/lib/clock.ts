import { db } from "./db";
import { isEmulator } from "./geo";

/**
 * Server time for player functions (the server is the timer — CLAUDE.md rule 5).
 *
 * DECISION (Day 8 tests): on the emulator ONLY, `_emulator/clock.offsetMs` shifts this clock so
 * tests can cross IST midnight (streaks, daily resets). Production never reads that doc and always
 * returns Date.now(); clients can't read or write `_emulator/*` (default-deny rules).
 */
export async function serverNow(): Promise<number> {
  if (!isEmulator()) return Date.now();
  const snap = await db().collection("_emulator").doc("clock").get();
  const offset = snap.data()?.offsetMs;
  return Date.now() + (typeof offset === "number" ? offset : 0);
}
