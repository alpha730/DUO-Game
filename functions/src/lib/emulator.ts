import { db } from "./db";
import { isEmulator } from "./geo";

/**
 * Off-campus players are let through on the emulator (play from home, lib/geo.ts) — unless a test
 * turns on `_emulator/campus.strict`, which enforces the check exactly like production. Production
 * never reads that doc; clients can't read or write `_emulator/*` (default-deny rules).
 */
export async function lenientCampus(): Promise<boolean> {
  if (!isEmulator()) return false;
  const snap = await db().collection("_emulator").doc("campus").get();
  return snap.data()?.strict !== true;
}
