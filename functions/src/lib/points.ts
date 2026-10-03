import { LINGO_COUNT, type Bonus, type CatchDoc, type GameRules, type Level, type PointsReason, type UserDoc } from "../shared/types";
import { isYesterday } from "./date";

const RANK: Record<string, number> = { "1": 1, "2": 2, "3": 3, MAX: 4 };
/** Levels never go down (SPEC §2). */
export const maxLevel = (a: Level, b: Level): Level => (RANK[String(a)] >= RANK[String(b)] ? a : b);

export interface CatchInput {
  user: Pick<UserDoc, "favorites" | "lingosCaught" | "allTenBonus" | "dayStreak" | "lastPlayDate" | "points">;
  /** Existing catch doc for this Lingo (undefined on the first-ever catch). */
  catchDoc: Pick<CatchDoc, "timesCaught" | "lastCaughtDate" | "level" | "favStreak" | "maxBonusGiven"> | undefined;
  lingoId: string;
  today: string;
  rules: GameRules;
  /** Full seconds left on the server timer when the answer arrived (already clamped). */
  speedBonus: number;
}

export interface CatchOutcome {
  /** Everything added by this win (base + speed + bonuses). */
  pointsAdded: number;
  base: number;
  baseReason: Extract<PointsReason, "firstCatch" | "repeatCatch" | "favoriteCatch">;
  speedBonus: number;
  bonuses: Bonus[];
  favorite: boolean;
  /** New catch-doc fields (firstCaughtAt is set by the caller on the first catch). */
  catchDoc: Pick<CatchDoc, "timesCaught" | "lastCaughtDate" | "level" | "favStreak" | "maxBonusGiven">;
  firstCatch: boolean;
  /** New user fields (points via increment by pointsAdded). */
  user: Pick<UserDoc, "lingosCaught" | "allTenBonus" | "dayStreak" | "lastPlayDate">;
  newLevel: Level;
  levelUp: boolean;
  /** ≥ 2 Lingos caught and no favourites picked yet → open /favorites. */
  needsFavorites: boolean;
}

/** Level of a non-favourite from its total catches (no MAX). */
function nonFavLevel(timesCaught: number, rules: GameRules): Level {
  if (timesCaught >= rules.nonFavLevel3Catches) return 3;
  if (timesCaught >= rules.nonFavLevel2Catches) return 2;
  return 1;
}

/** Level of a favourite from its streak. */
function favLevel(streak: number, rules: GameRules): Level {
  if (streak >= rules.favMaxStreak) return "MAX";
  if (streak >= rules.favLevel3Streak) return 3;
  if (streak >= rules.favLevel2Streak) return 2;
  return 1;
}

/**
 * Points + catch/user changes for one WIN (SPEC §2). Pure: no I/O. Only called for correct answers
 * — failed/forfeited attempts give 0 and never reach this.
 */
export function scoreCatch({ user, catchDoc, lingoId, today, rules, speedBonus }: CatchInput): CatchOutcome {
  const firstCatch = !catchDoc || catchDoc.timesCaught <= 0;
  const favorite = !firstCatch && user.favorites.includes(lingoId);
  const timesCaught = (catchDoc?.timesCaught ?? 0) + 1;
  const oldLevel: Level = catchDoc?.level ?? 1;

  let base: number;
  let baseReason: CatchOutcome["baseReason"];
  let favStreak = 0;
  let level: Level;
  const bonuses: Bonus[] = [];
  let maxBonusGiven = catchDoc?.maxBonusGiven ?? false;

  if (firstCatch) {
    base = rules.firstCatchPoints;
    baseReason = "firstCatch";
    level = 1;
  } else if (favorite) {
    // +1 if caught on the IST day right after its last catch; a missed day starts again at day 1.
    favStreak = isYesterday(catchDoc!.lastCaughtDate, today) ? catchDoc!.favStreak + 1 : 1;
    // SPEC §2: 20 × streak day, capped at 200 per catch from day 10 on.
    base = rules.favoriteCatchPointsPerDay * Math.min(favStreak, rules.favMaxStreak);
    baseReason = "favoriteCatch";
    level = maxLevel(oldLevel, favLevel(favStreak, rules));
    if (level === "MAX" && !maxBonusGiven) {
      bonuses.push({ kind: "max", points: rules.maxBonus });
      maxBonusGiven = true;
    }
  } else {
    base = rules.repeatCatchPoints;
    baseReason = "repeatCatch";
    level = maxLevel(oldLevel, nonFavLevel(timesCaught, rules));
  }

  const lingosCaught = user.lingosCaught + (firstCatch ? 1 : 0);
  let allTenBonus = user.allTenBonus;
  if (!allTenBonus && lingosCaught >= LINGO_COUNT) {
    bonuses.push({ kind: "allTen", points: rules.allTenBonus });
    allTenBonus = true;
  }

  // Overall day streak (display only): counts IST days with at least one win.
  const dayStreak =
    user.lastPlayDate === today ? user.dayStreak : isYesterday(user.lastPlayDate, today) ? user.dayStreak + 1 : 1;

  const pointsAdded = base + speedBonus + bonuses.reduce((s, b) => s + b.points, 0);
  return {
    pointsAdded,
    base,
    baseReason,
    speedBonus,
    bonuses,
    favorite,
    firstCatch,
    catchDoc: { timesCaught, lastCaughtDate: today, level, favStreak, maxBonusGiven },
    user: { lingosCaught, allTenBonus, dayStreak, lastPlayDate: today },
    newLevel: level,
    levelUp: !firstCatch && level !== oldLevel,
    needsFavorites: user.favorites.length === 0 && lingosCaught >= rules.favoritesCount,
  };
}

export interface RaidCatchOutcome {
  pointsAdded: number;
  base: number;
  speedBonus: number;
  bonuses: Bonus[];
  firstCatch: boolean;
  /** Catch-doc fields to merge: never lastCaughtDate / favStreak / maxBonusGiven (a raid is not a daily catch). */
  catchDoc: Pick<CatchDoc, "timesCaught" | "level"> & Partial<Pick<CatchDoc, "lastCaughtDate" | "favStreak" | "maxBonusGiven">>;
  user: Pick<UserDoc, "lingosCaught" | "allTenBonus">;
  newLevel: Level;
  needsFavorites: boolean;
}

/**
 * Points + catch/user changes for an Owl Raid WIN (SPEC §2). Pure. raidCatchPoints + speed bonus
 * INSTEAD of the normal catch points; counts for the collection (first catch → catch doc at Level 1,
 * lingosCaught, all-10 bonus) and timesCaught (non-favourite levels can rise). No effect on the
 * favourite streak, MAX, the day streak or "caught today".
 */
export function scoreRaidCatch({ user, catchDoc, lingoId, rules, speedBonus }: Omit<CatchInput, "today">): RaidCatchOutcome {
  const firstCatch = !catchDoc || catchDoc.timesCaught <= 0;
  const timesCaught = (catchDoc?.timesCaught ?? 0) + 1;
  const oldLevel: Level = catchDoc?.level ?? 1;
  const favorite = !firstCatch && user.favorites.includes(lingoId);
  // A favourite's level comes from its streak only, so a raid leaves it alone.
  const level = firstCatch ? 1 : favorite ? oldLevel : maxLevel(oldLevel, nonFavLevel(timesCaught, rules));

  const bonuses: Bonus[] = [];
  const lingosCaught = user.lingosCaught + (firstCatch ? 1 : 0);
  let allTenBonus = user.allTenBonus;
  if (!allTenBonus && lingosCaught >= LINGO_COUNT) {
    bonuses.push({ kind: "allTen", points: rules.allTenBonus });
    allTenBonus = true;
  }

  const base = rules.raidCatchPoints;
  return {
    pointsAdded: base + speedBonus + bonuses.reduce((s, b) => s + b.points, 0),
    base,
    speedBonus,
    bonuses,
    firstCatch,
    catchDoc: firstCatch
      ? { timesCaught, level, lastCaughtDate: catchDoc?.lastCaughtDate ?? null, favStreak: catchDoc?.favStreak ?? 0, maxBonusGiven: catchDoc?.maxBonusGiven ?? false }
      : { timesCaught, level },
    user: { lingosCaught, allTenBonus },
    newLevel: level,
    needsFavorites: user.favorites.length === 0 && lingosCaught >= rules.favoritesCount,
  };
}
