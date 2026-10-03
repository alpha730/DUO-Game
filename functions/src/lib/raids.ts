import type { RaidDoc, RaidStatus } from "../shared/types";

export const RAID_MINUTES = 15;
export const RAID_MIN_PLAYERS = 20;

/** A raid's phase from its times (authoritative; the stored `status` only drives queries). Pure. */
export function raidPhase(raid: Pick<RaidDoc, "startAt" | "endAt">, now: number): RaidStatus {
  if (now < raid.startAt.toMillis()) return "scheduled";
  if (now < raid.endAt.toMillis()) return "active";
  return "ended";
}

export interface RaidPlan {
  posterIndex: number;
  lingoId: string;
  startAt: number;
  endAt: number;
  minPlayers: number;
  status: RaidStatus;
}

/**
 * Validates an admin's raid request (PLAN 6.1): known Lingo whose poster matches, start not in the
 * past by more than a minute, 15-minute window by default. Pure — returns an error code or the plan.
 */
export function planRaid(
  input: { posterIndex?: unknown; lingoId?: unknown; startAt?: unknown; minutes?: unknown; minPlayers?: unknown },
  lingo: { posterIndex: number } | undefined,
  now: number,
): RaidPlan | { error: "bad-input" | "unknown-lingo" | "poster-mismatch" | "in-the-past" } {
  const { posterIndex, lingoId, startAt } = input;
  const minutes = input.minutes ?? RAID_MINUTES;
  const minPlayers = input.minPlayers ?? RAID_MIN_PLAYERS;
  if (
    typeof lingoId !== "string" ||
    !Number.isInteger(posterIndex) ||
    typeof startAt !== "number" ||
    !Number.isFinite(startAt) ||
    !Number.isInteger(minutes) ||
    (minutes as number) < 1 ||
    (minutes as number) > 120 ||
    !Number.isInteger(minPlayers) ||
    (minPlayers as number) < 1
  ) {
    return { error: "bad-input" };
  }
  if (!lingo) return { error: "unknown-lingo" };
  if (lingo.posterIndex !== posterIndex) return { error: "poster-mismatch" };
  if (startAt < now - 60_000) return { error: "in-the-past" };
  const endAt = startAt + (minutes as number) * 60_000;
  return {
    posterIndex: posterIndex as number,
    lingoId,
    startAt,
    endAt,
    minPlayers: minPlayers as number,
    status: startAt <= now ? "active" : "scheduled",
  };
}
