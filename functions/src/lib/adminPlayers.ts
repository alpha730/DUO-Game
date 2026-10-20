import type { AdminPlayerRow, UserDoc } from "../shared/types";
import { isQualified } from "./rank";

/** A user doc as an admin list row (accuracy and average answer time computed). Pure. */
export function playerRow(uid: string, u: UserDoc, rank?: number): AdminPlayerRow {
  const wins = u.wins ?? 0;
  const played = wins + (u.losses ?? 0);
  return {
    ...(rank !== undefined ? { rank } : {}),
    uid,
    name: u.name,
    email: u.email,
    points: u.points ?? 0,
    wins,
    accuracy: played ? wins / played : 0,
    avgAnswerMs: wins ? Math.round((u.totalAnswerMs ?? 0) / wins) : 0,
    favMax: u.favMaxCount ?? 0,
    qualified: isQualified(u.favMaxCount),
    flags: u.flags ?? 0,
    suspect: u.suspect ?? false,
    voiceSuspect: u.voiceSuspect ?? false,
    locationJumps: u.locationJumps ?? 0,
    disabled: u.disabled ?? false,
    createdAt: u.createdAt ? u.createdAt.toMillis() : undefined,
  };
}
