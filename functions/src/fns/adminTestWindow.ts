import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, DOC, type AdminTestWindowOutput, type GameConfigDoc, type GameRound } from "../shared/types";
import { serverNow } from "../lib/clock";
import { istDate } from "../lib/date";
import { configRef, db } from "../lib/db";
import { requireRole } from "../lib/guards";
import { STAFF_INSTANCES } from "../lib/instances";
import { closeWindow, demoView, openWindow, restoreEvent, type Span, type WindowState } from "../lib/testWindow";

const toSpan = (r: GameRound): Span => ({ startAt: r.startAt.toMillis(), endAt: r.endAt.toMillis() });
const toRound = (r: Span) => ({ startAt: Timestamp.fromMillis(r.startAt), endAt: Timestamp.fromMillis(r.endAt) });

function stateOf(c: GameConfigDoc): WindowState {
  const b = c.eventBackup;
  return {
    rounds: (c.rounds ?? []).map(toSpan),
    startAt: c.startAt.toMillis(),
    lockAt: c.lockAt.toMillis(),
    locked: c.locked,
    backup: b ? { rounds: b.rounds.map(toSpan), startAt: b.startAt.toMillis(), lockAt: b.lockAt.toMillis() } : null,
  };
}

function view(s: WindowState, now: number): AdminTestWindowOutput {
  return { serverNow: now, testing: !!s.backup, ...demoView(s, now), rounds: s.rounds.length };
}

/**
 * Admin "Test window" (/admin): a 3-round demo of the event on the real game, before the event.
 * "open" appends 3 rounds of 5 min from now (the real times saved once in config/game.eventBackup),
 * "close" ends the running demo round now and drops the ones not started, "restore" puts the event
 * times back and rewrites public/event. Refused on the event day (lib/testWindow.ts). One
 * transaction on config/game.
 */
export const adminTestWindow = onCall<unknown, Promise<AdminTestWindowOutput>>(STAFF_INSTANCES, async (req) => {
  requireRole(req, ["admin"]);
  const d = (req.data ?? {}) as { action?: unknown };
  if (!["status", "open", "close", "restore"].includes(d.action as string)) {
    throw new HttpsError("invalid-argument", 'action must be "status", "open", "close" or "restore".');
  }
  const now = await serverNow();
  return db().runTransaction(async (tx) => {
    const config = (await tx.get(configRef())).data() as GameConfigDoc | undefined;
    if (!config) throw new HttpsError("failed-precondition", "Game is not configured — run the seed first.");
    const s = stateOf(config);
    if (d.action === "status") return view(s, now);

    const out = d.action === "open" ? openWindow(s, now) : d.action === "close" ? closeWindow(s, now) : restoreEvent(s);
    if ("error" in out) throw new HttpsError("failed-precondition", out.error, { code: out.code });
    const n = out.state;
    tx.update(configRef(), {
      rounds: n.rounds.map(toRound),
      startAt: Timestamp.fromMillis(n.startAt),
      lockAt: Timestamp.fromMillis(n.lockAt),
      locked: n.locked,
      eventBackup: n.backup ? { rounds: n.backup.rounds.map(toRound), startAt: Timestamp.fromMillis(n.backup.startAt), lockAt: Timestamp.fromMillis(n.backup.lockAt) } : FieldValue.delete(),
    });
    // Back to the event: the public round times (login + Rules) match the real rounds again.
    if (d.action === "restore") {
      const real = [...n.rounds].sort((a, b) => a.startAt - b.startAt);
      const pub = db().collection(COL.public).doc(DOC.publicEvent);
      if (real.length) tx.set(pub, { date: istDate(real[0].startAt), rounds: real.map(toRound) });
      else tx.delete(pub);
    }
    return view(n, now);
  });
});
