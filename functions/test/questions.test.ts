// SPEC §9 question pool on the emulators: difficulty from the favourite streak, no repeats across
// days, no repeated word in a day, fallback when a player has seen everything, answers never sent
// before answering, scored against the stored question, explanation after.
import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { GetMyStateOutput, StartAttemptOutput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, CAMPUS, cleanupApps, istToday, newPlayer, patchConfig, pinQuestions, setQuestionPool, unpinQuestions } from "./helpers";

type Player = Awaited<ReturnType<typeof newPlayer>>;
const POOL = JSON.parse(readFileSync(new URL("../../scripts/content/question-pool-2026.json", import.meta.url), "utf8"));
const DAY = 86_400_000;
const clock = adb.doc("_emulator/clock");
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const istMidnight = (date: string) => Date.parse(`${date}T00:00:00+05:30`);
/** Server clock to `days` days from today, 10:00 IST. */
const goToDay = (days: number) => clock.set({ offsetMs: istMidnight(addDays(istToday(), days)) + 10 * 3_600_000 - Date.now() });

const q = (id: string, level: "medium" | "hard", type: "meaning" | "question" | "pronounce", word: string) =>
  type === "pronounce"
    ? { id, level, type, word, explanation: `${word} explained` }
    : type === "meaning"
      ? { id, level, type, word, options: [`${word}-right`, "b", "c", "d"], correctIndex: 0, explanation: `${word} explained` }
      : { id, level, type, prompt: `Fill in: ___ (${word})`, target: word, options: [word, "b", "c", "d"], correctIndex: 0, explanation: `${word} explained` };

const start = (p: Player, lingoId: string, extra: object = {}) =>
  p.call<object, StartAttemptOutput>("startAttempt")({ lingoId, ...CAMPUS, ...extra });
const attempt = async (id: string) => (await adb.doc(`attempts/${id}`).get()).data()!;
const user = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!;
/** Makes `lingoId` a favourite whose streak would be on day `day` today (caught yesterday at day − 1). */
async function favouriteOnDay(p: Player, lingoId: string, day: number, lastCaughtDate = addDays(istToday(), -1)) {
  await adb.doc(`users/${p.uid}/catches/${lingoId}`).set({ firstCaughtAt: null, timesCaught: day, lastCaughtDate, level: 1, favStreak: day - 1, maxBonusGiven: false });
  await adb.doc(`users/${p.uid}`).update({ favorites: [lingoId, "lingo-2025"], lingosCaught: 2 });
}

// Some tests move the server clock days ahead, which can pass the real lock (Oct 22, calendar-
// dependent): move the lock out for this suite and put it back after.
let restoreLock: () => Promise<unknown> = async () => {};
beforeAll(async () => {
  await unpinQuestions(); // this suite exercises the real picking, not pinned questions
  restoreLock = await patchConfig({ lockAt: Timestamp.fromMillis(istMidnight(istToday()) + 30 * 86_400_000) });
});
afterEach(() => clock.delete());
afterAll(async () => {
  await restoreLock();
  await clock.delete();
  await setQuestionPool(POOL);
  await pinQuestions();
  await cleanupApps();
});

describe("question pool (SPEC §9)", () => {
  describe("difficulty", () => {
    beforeAll(() =>
      setQuestionPool([
        q("m1", "medium", "meaning", "abundant"),
        q("m2", "medium", "question", "feasible"),
        q("m3", "medium", "meaning", "brief"),
        q("h1", "hard", "meaning", "laconic"),
        q("h2", "hard", "question", "obsequious"),
        q("h3", "hard", "meaning", "pellucid"),
      ]),
    );

    it("medium for a non-favourite", async () => {
      const p = await newPlayer();
      const a = await start(p, "lingo-2018");
      expect(a.level).toBe("medium");
      expect((await attempt(a.attemptId)).level).toBe("medium");
      expect((await attempt(a.attemptId)).questionId).toMatch(/^m/);
    });

    it("medium for a favourite on streak days 1–5", async () => {
      for (const day of [1, 2, 5]) {
        const p = await newPlayer();
        if (day > 1) await favouriteOnDay(p, "lingo-2018", day);
        else await adb.doc(`users/${p.uid}`).update({ favorites: ["lingo-2018", "lingo-2025"] });
        const a = await start(p, "lingo-2018");
        expect([day, a.level]).toEqual([day, "medium"]);
      }
    });

    it("hard for a favourite on streak day 6 and later", async () => {
      for (const day of [6, 9, 12]) {
        const p = await newPlayer();
        await favouriteOnDay(p, "lingo-2018", day);
        const a = await start(p, "lingo-2018");
        expect([day, a.level]).toEqual([day, "hard"]);
        expect((await attempt(a.attemptId)).questionId).toMatch(/^h/);
      }
    });

    it("a broken streak (not caught yesterday) goes back to medium", async () => {
      const p = await newPlayer();
      await favouriteOnDay(p, "lingo-2018", 8, addDays(istToday(), -2));
      expect((await start(p, "lingo-2018")).level).toBe("medium");
    });

    it("hard is only for the favourite: another Lingo the same day is medium", async () => {
      const p = await newPlayer();
      await favouriteOnDay(p, "lingo-2018", 7);
      expect((await start(p, "lingo-2018")).level).toBe("hard");
      expect((await start(p, "lingo-2019")).level).toBe("medium");
    });
  });

  describe("picking", () => {
    it("never repeats a question for a player across days (while others are left)", async () => {
      await setQuestionPool([q("m1", "medium", "meaning", "abundant"), q("m2", "medium", "question", "feasible"), q("m3", "medium", "meaning", "brief")]);
      const p = await newPlayer();
      const ids: string[] = [];
      for (let day = 0; day < 3; day++) {
        await goToDay(day);
        ids.push((await attempt((await start(p, "lingo-2018")).attemptId)).questionId);
      }
      expect(new Set(ids).size).toBe(3);
      expect((await user(p)).seenQ).toEqual(ids);
    });

    it("never asks the same word twice in a day (across types)", async () => {
      await setQuestionPool([q("a", "medium", "meaning", "candid"), q("b", "medium", "question", "candid"), q("c", "medium", "meaning", "frank")]);
      for (let run = 0; run < 3; run++) {
        const p = await newPlayer();
        const w1 = (await attempt((await start(p, "lingo-2018")).attemptId)).questionId;
        const w2 = (await attempt((await start(p, "lingo-2019")).attemptId)).questionId;
        const word = (id: string) => (id === "c" ? "frank" : "candid");
        expect(word(w1)).not.toBe(word(w2));
        expect((await user(p)).wordsToday).toEqual([word(w1), word(w2)]);
      }
    });

    it("falls back to another type, then to repeats, when a player has seen everything", async () => {
      await setQuestionPool([q("only", "medium", "meaning", "abundant")]);
      const p = await newPlayer();
      // Whatever type is drawn, the only question left is a meaning one.
      expect((await start(p, "lingo-2018")).type).toBe("meaning");
      await goToDay(1);
      const again = await start(p, "lingo-2018"); // seen it already: a repeat rather than nothing
      expect((await attempt(again.attemptId)).questionId).toBe("only");
    });

    it("an empty pool → no-challenge, and no Lingo used", async () => {
      await setQuestionPool([]);
      const p = await newPlayer();
      await expect(start(p, "lingo-2018")).rejects.toMatchObject({ details: { code: "no-challenge" } });
      expect((await p.call<object, GetMyStateOutput>("getMyState")({})).attemptsLeft).toBe(4);
    });

    it("without speech recognition, never a pronounce question (and the try still goes ahead)", async () => {
      await setQuestionPool([q("p1", "medium", "pronounce", "candid"), q("m1", "medium", "meaning", "abundant")]);
      for (let run = 0; run < 4; run++) {
        const p = await newPlayer();
        expect((await start(p, "lingo-2018", { speech: false })).type).toBe("meaning");
      }
    });
  });

  describe("answers", () => {
    beforeAll(() => setQuestionPool(POOL));

    it("are never in the startAttempt response (real pool, every type)", async () => {
      const seen = new Set<string>();
      for (let i = 0; i < 6; i++) {
        const p = await newPlayer();
        for (const lingo of ["lingo-2016", "lingo-2017", "lingo-2018", "lingo-2019"]) {
          const a = await start(p, lingo);
          seen.add(a.type);
          const keys = Object.keys(a).sort();
          for (const secret of ["correctIndex", "accept", "target", "explanation", "question", "questionId"]) expect(keys).not.toContain(secret);
          expect(JSON.stringify(a)).not.toMatch(/correctIndex|explanation/);
        }
      }
      expect(seen.has("meaning") && seen.has("question")).toBe(true);
    });

    it("are scored against the stored question; meaning/question show the right answer + explanation after", async () => {
      await setQuestionPool([q("m1", "medium", "meaning", "abundant")]);
      const p = await newPlayer();
      const a1 = await start(p, "lingo-2018");
      expect([...a1.options!].sort()).toEqual(["abundant-right", "b", "c", "d"]); // shuffled per attempt
      const lost = await p.call<object, SubmitAttemptOutput>("submitAttempt")({ attemptId: a1.attemptId, choice: 2 });
      expect(lost).toMatchObject({ result: "failed", answer: { text: "abundant-right", explanation: "abundant explained" } });
      // The pool changing after Start doesn't change the answer of a running try.
      const a2 = await start(p, "lingo-2019");
      await setQuestionPool([{ ...q("m1", "medium", "meaning", "abundant"), correctIndex: 3 }]);
      const won = await p.call<object, SubmitAttemptOutput>("submitAttempt")({ attemptId: a2.attemptId, choice: 0 });
      expect(won).toMatchObject({ result: "won", answer: { text: "abundant-right" } });
    });

    it("pronounce accepts a near miss of a rare word", async () => {
      await setQuestionPool([q("p1", "hard", "pronounce", "grandiloquent")]);
      const p = await newPlayer();
      const a = await start(p, "lingo-2018");
      expect(a).toMatchObject({ type: "pronounce", word: "grandiloquent" });
      const out = await p.call<object, SubmitAttemptOutput>("submitAttempt")({ attemptId: a.attemptId, transcript: "grandilaquant" });
      expect(out.result).toBe("won");
      expect(out.answer).toBeUndefined(); // only meaning/question show an answer card
    });
  });
});
