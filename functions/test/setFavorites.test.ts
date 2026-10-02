// setFavorites against the emulators (PLAN 4.4).
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type { SetFavoritesInput, SetFavoritesOutput } from "../src/shared/types";
import { adb, cleanupApps, newPlayer } from "./helpers";

afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const setFav = (p: Player, lingoIds: unknown) => p.call<SetFavoritesInput, SetFavoritesOutput>("setFavorites")({ lingoIds } as SetFavoritesInput);
async function caughtAll(p: Player, ids: string[], streak = 4) {
  for (const id of ids) {
    await adb.doc(`users/${p.uid}/catches/${id}`).set({
      firstCaughtAt: Timestamp.now(), timesCaught: 5, lastCaughtDate: "2026-10-01", level: 2, favStreak: streak, maxBonusGiven: false,
    });
  }
}
const streaks = async (p: Player, ids: string[]) =>
  Promise.all(ids.map(async (id) => (await adb.doc(`users/${p.uid}/catches/${id}`).get()).data()!.favStreak));

describe("setFavorites", () => {
  it("first pick free; one change resets the replaced + new favourite; second change rejected", async () => {
    const p = await newPlayer();
    await caughtAll(p, ["lingo-2016", "lingo-2017", "lingo-2018", "lingo-2019"]);

    await expect(setFav(p, ["lingo-2016", "lingo-2017"])).resolves.toEqual({ favorites: ["lingo-2016", "lingo-2017"], favoriteChangesLeft: 1 });
    await adb.doc(`users/${p.uid}/catches/lingo-2016`).update({ favStreak: 6 });
    await adb.doc(`users/${p.uid}/catches/lingo-2017`).update({ favStreak: 3 });

    await expect(setFav(p, ["lingo-2016", "lingo-2018"])).resolves.toEqual({ favorites: ["lingo-2016", "lingo-2018"], favoriteChangesLeft: 0 });
    expect(await streaks(p, ["lingo-2016", "lingo-2017", "lingo-2018"])).toEqual([6, 0, 0]); // kept, replaced → 0, new → 0
    expect((await adb.doc(`users/${p.uid}/catches/lingo-2017`).get()).data()!.level).toBe(2); // level kept

    await expect(setFav(p, ["lingo-2016", "lingo-2019"])).rejects.toMatchObject({
      code: "functions/failed-precondition",
      details: { code: "no-changes" },
    });
    // Same pair again is fine and free.
    await expect(setFav(p, ["lingo-2018", "lingo-2016"])).resolves.toEqual({ favorites: ["lingo-2016", "lingo-2018"], favoriteChangesLeft: 0 });
    expect((await adb.doc(`users/${p.uid}`).get()).data()).toMatchObject({ favorites: ["lingo-2016", "lingo-2018"], favoriteChangesLeft: 0 });
  });

  it("rejects uncaught Lingos and bad input", async () => {
    const p = await newPlayer();
    await caughtAll(p, ["lingo-2016"]);
    await expect(setFav(p, ["lingo-2016", "lingo-2017"])).rejects.toMatchObject({ details: { code: "not-caught" } });
    await expect(setFav(p, ["lingo-2016", "lingo-2016"])).rejects.toMatchObject({ details: { code: "bad-input" } });
    await expect(setFav(p, ["lingo-2016"])).rejects.toMatchObject({ details: { code: "bad-input" } });
    expect((await adb.doc(`users/${p.uid}`).get()).data()!.favorites).toEqual([]);
  });
});
