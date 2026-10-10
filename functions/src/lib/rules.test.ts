import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../shared/types";

// Pins the seeded config/game.rules to SPEC §2 so a typo can't slip in.
describe("DEFAULT_RULES", () => {
  it("matches SPEC §2", () => {
    expect(DEFAULT_RULES).toEqual({
      attemptsPerDay: 4,
      triesPerLingoPerDay: 2,
      favoritesCount: 2,
      favoriteChanges: 1,
      pronounceSeconds: 15,
      speakSeconds: 20,
      meaningSeconds: 15,
      questionSeconds: 20,
      graceSeconds: 2,
      speakPassRatio: 0.8,
      speedBonusPerSecond: 1,
      firstCatchPoints: 100,
      repeatCatchPoints: 20,
      favoriteCatchPointsPerDay: 20,
      favLevel2Streak: 3,
      favLevel3Streak: 6,
      favMaxStreak: 10,
      maxBonus: 1000,
      nonFavLevel2Catches: 3,
      nonFavLevel3Catches: 6,
      allTenBonus: 1000,
      raidCatchPoints: 150,
    });
  });
});
