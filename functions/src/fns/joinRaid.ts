import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, type JoinRaidOutput, type RaidDoc } from "../shared/types";
import { db } from "../lib/db";
import { campusCheck, isEmulator, isValidLatLng } from "../lib/geo";
import { requirePlayer } from "../lib/guards";
import { raidPhase } from "../lib/raids";

/**
 * Join an active Owl Raid (SPEC §5, PLAN 6.1): on campus; counted once per player; unlocks at
 * minPlayers. Idempotent — joining twice just returns the current count.
 *
 * DECISION (cost/contention): no transaction on the raid doc. Hundreds of players may join within a
 * minute; a transaction per join would keep colliding on that one document. Instead: create the
 * player doc with a "must not exist" precondition + atomic increment in one batch, then flip
 * `unlocked` (idempotent) once the count reaches minPlayers.
 */
export const joinRaid = onCall<unknown, Promise<JoinRaidOutput>>(async (req) => {
  const now = Date.now();
  const { uid, config } = await requirePlayer(req, now);
  const { raidId, lat, lng } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof raidId !== "string" || !/^[\w-]{1,64}$/.test(raidId)) throw new HttpsError("invalid-argument", "Unknown raid.");
  if (!isValidLatLng(lat, lng)) throw new HttpsError("invalid-argument", "We need your location.", { code: "bad-location" });
  if (campusCheck(lat as number, lng as number, config, isEmulator()) === "off-campus") {
    throw new HttpsError("failed-precondition", "You need to be on campus to join the raid.", { code: "off-campus" });
  }

  const raidRef = db().collection(COL.raids).doc(raidId);
  const raidSnap = await raidRef.get();
  if (!raidSnap.exists) throw new HttpsError("not-found", "Unknown raid.");
  const raid = raidSnap.data() as RaidDoc;
  const phase = raidPhase(raid, now);
  if (phase !== "active") {
    throw new HttpsError("failed-precondition", phase === "scheduled" ? "The raid hasn't started yet." : "This raid is over.", {
      code: phase === "scheduled" ? "raid-not-started" : "raid-ended",
    });
  }

  const playerRef = raidRef.collection(COL.players).doc(uid);
  const batch = db().batch();
  batch.create(playerRef, { joinedAt: Timestamp.fromMillis(now) });
  batch.update(raidRef, { joined: FieldValue.increment(1) });
  try {
    await batch.commit();
  } catch (err) {
    // ALREADY_EXISTS (code 6): already joined — fall through and report the current state.
    if ((err as { code?: number }).code !== 6) throw err;
  }

  const fresh = (await raidRef.get()).data() as RaidDoc;
  let unlocked = fresh.unlocked;
  if (!unlocked && fresh.joined >= fresh.minPlayers) {
    await raidRef.update({ unlocked: true });
    unlocked = true;
  }
  return { joined: fresh.joined, unlocked };
});
