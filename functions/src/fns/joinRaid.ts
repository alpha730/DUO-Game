import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { COL, RAID_SHARDS, type JoinRaidOutput, type RaidDoc, type RaidPlayerDoc, type RaidShardDoc } from "../shared/types";
import { serverNow } from "../lib/clock";
import { db } from "../lib/db";
import { lenientCampus } from "../lib/emulator";
import { campusCheck, isValidLatLng } from "../lib/geo";
import { requirePlayer } from "../lib/guards";
import { raidPhase } from "../lib/raids";

/**
 * Join an active Owl Raid (SPEC §5, PLAN 6.1): on campus; counted once per player; unlocks at
 * minPlayers. Idempotent — joining twice just returns the current count.
 *
 * DECISION (cost/contention): no transaction, and joins never write the raid doc. Hundreds of
 * players may join within a minute, more than one document takes. Each join creates the player doc
 * with a "must not exist" precondition (counted once) and +1 on ONE random shard of 10
 * (raids/{id}/shards/{0..9}) in one batch; the count is the sum of the shards. The raid doc is
 * written once, when the sum first reaches minPlayers (`unlocked`, idempotent).
 */
export const joinRaid = onCall<unknown, Promise<JoinRaidOutput>>(async (req) => {
  const now = await serverNow();
  const { uid, config } = await requirePlayer(req, now);
  const { raidId, lat, lng } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof raidId !== "string" || !/^[\w-]{1,64}$/.test(raidId)) throw new HttpsError("invalid-argument", "Unknown raid.");
  if (!isValidLatLng(lat, lng)) throw new HttpsError("invalid-argument", "We need your location.", { code: "bad-location" });
  if (campusCheck(lat as number, lng as number, config.campuses ?? [], await lenientCampus()) === "off-campus") {
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
  const shard = raidRef.collection(COL.shards).doc(String(Math.floor(Math.random() * RAID_SHARDS)));
  batch.set(shard, { count: FieldValue.increment(1) }, { merge: true });
  let tried = false;
  try {
    await batch.commit();
  } catch (err) {
    // ALREADY_EXISTS (code 6): already joined — report the current state (and whether the one try is used).
    if ((err as { code?: number }).code !== 6) throw err;
    tried = !!((await playerRef.get()).data() as RaidPlayerDoc | undefined)?.attemptId;
  }

  const shardRefs = Array.from({ length: RAID_SHARDS }, (_, i) => raidRef.collection(COL.shards).doc(String(i)));
  const [fresh, ...shards] = await db().getAll(raidRef, ...shardRefs);
  const joined = shards.reduce((sum, s) => sum + ((s.data() as RaidShardDoc | undefined)?.count ?? 0), 0);
  let unlocked = (fresh.data() as RaidDoc).unlocked;
  if (!unlocked && joined >= raid.minPlayers) {
    await raidRef.update({ unlocked: true });
    unlocked = true;
  }
  return { joined, unlocked, tried };
});
