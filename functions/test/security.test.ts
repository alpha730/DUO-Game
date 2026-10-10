// Anti-cheat audit (docs/SECURITY.md): think like an attacker, prove each protection. These tests call
// the server directly with callRaw — no "test language" translation (helpers.ts humanPaced) — so the
// shuffle and the two-tabs guard are tested as they really are.
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { AdminPlayersOutput, GetMyStateOutput, StartAttemptOutput, SubmitAttemptOutput } from "../src/shared/types";
import { adb, adminAuth, APP_CHECK_TOKEN, CAMPUS, callRaw, cleanupApps, FUNCTIONS_ORIGIN, newPlayer, pinQuestions, SAMPLE } from "./helpers";

afterEach(() => adb.doc("_emulator/clock").delete());
afterAll(cleanupApps);

type Player = Awaited<ReturnType<typeof newPlayer>>;
const token = (p: Player) => p.idToken();
const start = async (p: Player, lingoId: string, extra: object = {}) =>
  callRaw<StartAttemptOutput>("startAttempt", { lingoId, ...CAMPUS, ...extra }, await token(p));
const submit = async (p: Player, data: object) => callRaw<SubmitAttemptOutput>("submitAttempt", data, await token(p));
const state = async (p: Player) => callRaw<GetMyStateOutput>("getMyState", {}, await token(p));
const user = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!;
const MEANING = "lingo-2018"; // pinned: reluctant → unwilling
const RIGHT = "unwilling";
/** Gets past the 5 s two-tabs guard the honest way: the previous attempt is answered or aged. */
const age = async (attemptId: string) => {
  const ref = adb.doc(`attempts/${attemptId}`);
  const a = (await ref.get()).data()!;
  await ref.update({ startedAt: Timestamp.fromMillis(a.startedAt.toMillis() - 60_000) });
};
async function admin() {
  const a = await newPlayer();
  await adminAuth.setCustomUserClaims(a.uid, { role: "admin" });
  await a.auth.currentUser!.getIdToken(true);
  return a;
}
/** Server clock at the start of a fresh minute (rate-limit windows), for the rest of the test. */
async function freshMinute() {
  const target = (Math.floor(Date.now() / 60_000) + 1) * 60_000 + 200;
  await adb.doc("_emulator/clock").set({ offsetMs: target - Date.now() });
}

describe("A. answers never reach the phone", () => {
  it("startAttempt sends no correctIndex, accept, order, explanation or question copy — any type", async () => {
    const p = await newPlayer();
    for (const lingo of ["lingo-2016", "lingo-2017", "lingo-2018", "lingo-2019"]) {
      const out = await start(p, lingo);
      expect(JSON.stringify(out).match(/correctIndex|accept|"order"|explanation|"question":|questionId|"program"/)?.[0] ?? null).toBeNull();
      await age(out.attemptId);
    }
  });

  it("error messages never contain the right answer (not-open, too-late, bad input, busy)", async () => {
    const p = await newPlayer();
    const a = await start(p, MEANING);
    const busy = await start(p, "lingo-2019").catch((e) => e);
    const bad = await submit(p, { attemptId: a.attemptId, choice: 9 }).catch((e) => e);
    await adb.doc(`attempts/${a.attemptId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 5000) });
    const late = await submit(p, { attemptId: a.attemptId, choice: a.options!.indexOf(RIGHT) }).catch((e) => e);
    const closed = await submit(p, { attemptId: a.attemptId, choice: 0 }).catch((e) => e);
    for (const e of [busy, bad, late, closed]) {
      expect(e).toBeInstanceOf(Error);
      expect(JSON.stringify({ m: e.message, d: e.details })).not.toMatch(new RegExp(`${RIGHT}|correctIndex`));
    }
    expect(late.details.code).toBe("too-late");
    expect(closed.details.code).toBe("not-open");
  });
});

describe("B. 'pick any answer and win' is impossible", () => {
  it("options are shuffled per attempt: same question, different orders across players; only the right position wins", async () => {
    const orders = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const p = await newPlayer();
      const a = await start(p, MEANING);
      expect([...a.options!].sort()).toEqual([...(SAMPLE.meaning.options as string[])].sort());
      orders.add(a.options!.join("|"));
      const stored = (await adb.doc(`attempts/${a.attemptId}`).get()).data()!;
      expect(stored.order.map((k: number) => (SAMPLE.meaning.options as string[])[k])).toEqual(a.options);
    }
    expect(orders.size).toBeGreaterThan(1); // 6 players, 24 possible orders: all equal ⇒ not shuffled (p ≈ 2·10⁻⁷)
  });

  it("each of the 3 wrong positions fails; the right one (by text, wherever it is) wins", async () => {
    const p = await newPlayer();
    const lingos = ["lingo-2018", "lingo-2022"]; // both pinned to the meaning sample, 2 tries each
    const results: string[] = [];
    for (const [lingo, pickRight] of [[lingos[0], false], [lingos[0], false], [lingos[1], false], [lingos[1], true]] as const) {
      const a = await start(p, lingo);
      const right = a.options!.indexOf(RIGHT);
      const wrongs = [0, 1, 2, 3].filter((k) => k !== right);
      const choice = pickRight ? right : wrongs[results.length];
      results.push((await submit(p, { attemptId: a.attemptId, choice })).result);
    }
    expect(results).toEqual(["failed", "failed", "failed", "won"]);
  });

  it("sharing 'the answer is C' doesn't work: position 2 for one player is a different option for another", async () => {
    let differs = false;
    for (let i = 0; i < 6 && !differs; i++) {
      const [x, y] = [await newPlayer(), await newPlayer()];
      const [ax, ay] = [await start(x, MEANING), await start(y, MEANING)];
      if (ax.options![2] !== ay.options![2]) differs = true;
    }
    expect(differs).toBe(true);
  });

  it("garbage choices never win: -1, 99, '1', null, [], {}, 1.5, true are refused and the attempt stays open", async () => {
    const p = await newPlayer();
    const a = await start(p, MEANING);
    for (const choice of [-1, 99, "1", null, [], {}, 1.5, true, 4]) {
      await expect(submit(p, { attemptId: a.attemptId, choice })).rejects.toMatchObject({ code: "functions/invalid-argument" });
    }
    expect((await adb.doc(`attempts/${a.attemptId}`).get()).data()!.status).toBe("open");
    // Extra fields claiming a win are ignored: a wrong position still fails.
    const wrong = [0, 1, 2, 3].find((k) => a.options![k] !== RIGHT)!;
    const out = await submit(p, { attemptId: a.attemptId, choice: wrong, result: "won", correct: true, points: 9999, receivedAt: 0, answerMs: 1 });
    expect(out).toMatchObject({ result: "failed", pointsAdded: 0 });
    expect((await user(p)).points).toBe(0);
  });

  it("a transcript can't win a choice question, and a choice can't win a Read Aloud", async () => {
    const p = await newPlayer();
    const m = await start(p, MEANING);
    expect(await submit(p, { attemptId: m.attemptId, transcript: RIGHT })).toMatchObject({ result: "failed" });
    const r = await start(p, "lingo-2016"); // Read Aloud "programme"
    expect(await submit(p, { attemptId: r.attemptId, choice: 0 })).toMatchObject({ result: "failed" });
  });
});

describe("C. replays and races", () => {
  it("submitAttempt 5× in parallel for one attempt → scored once", async () => {
    const p = await newPlayer();
    const a = await start(p, MEANING);
    const choice = a.options!.indexOf(RIGHT);
    const outs = await Promise.allSettled(Array.from({ length: 5 }, () => submit(p, { attemptId: a.attemptId, choice })));
    expect(outs.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const logs = await adb.collection("pointsLog").where("attemptId", "==", a.attemptId).get();
    expect(logs.docs.filter((d) => d.data().reason === "firstCatch")).toHaveLength(1);
    expect((await user(p)).wins).toBe(1);
  });

  it("startAttempt from 2 devices at the same moment → one open attempt, one try used (same and different Lingos)", async () => {
    for (const lingos of [[MEANING, MEANING], [MEANING, "lingo-2019"]]) {
      const p = await newPlayer();
      const outs = await Promise.allSettled(lingos.map((l) => start(p, l)));
      const ok = outs.filter((o) => o.status === "fulfilled");
      const busy = outs.filter((o) => o.status === "rejected") as PromiseRejectedResult[];
      expect(ok).toHaveLength(1);
      expect(busy[0].reason.details.code).toBe("busy");
      const open = await adb.collection("attempts").where("uid", "==", p.uid).get();
      expect(open.size).toBe(1);
      const u = await user(p);
      expect(u.attemptsToday).toBe(1);
      expect(Object.values(u.triesToday ?? {}).reduce((s: number, n) => s + (n as number), 0)).toBe(1);
    }
  });

  it("a late getMyState (from a page just left) never auto-forfeits an attempt started after it arrived", async () => {
    const p = await newPlayer();
    const a = await start(p, MEANING);
    // Same as the request arriving before the Start: the attempt's start lies after the request time.
    const ref = adb.doc(`attempts/${a.attemptId}`);
    await ref.update({ startedAt: Timestamp.fromMillis(Date.now() + 10_000) });
    await state(p);
    expect((await ref.get()).data()!.status).toBe("open");
    // An attempt that started before the request (a tab left behind) is still closed.
    await ref.update({ startedAt: Timestamp.fromMillis(Date.now() - 10_000) });
    await state(p);
    expect((await ref.get()).data()!.status).toBe("forfeit");
  });

  it("someone else's attempt, an old attempt, and after expiry + grace are all rejected", async () => {
    const [owner, thief] = [await newPlayer(), await newPlayer()];
    const a = await start(owner, MEANING);
    const right = a.options!.indexOf(RIGHT);
    await expect(submit(thief, { attemptId: a.attemptId, choice: right })).rejects.toMatchObject({ code: "functions/permission-denied" });
    await submit(owner, { attemptId: a.attemptId, choice: (right + 1) % 4 });
    await expect(submit(owner, { attemptId: a.attemptId, choice: right })).rejects.toMatchObject({ details: { code: "not-open" } });
    const b = await start(owner, "lingo-2022");
    await adb.doc(`attempts/${b.attemptId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 2100) });
    await expect(submit(owner, { attemptId: b.attemptId, choice: b.options!.indexOf(RIGHT) })).rejects.toMatchObject({ details: { code: "too-late" } });
    expect((await user(owner)).points).toBe(0);
  });
});

describe("D. App Check", () => {
  it("callables refuse a call without an App Check token", async () => {
    const p = await newPlayer();
    await expect(callRaw("getMyState", {}, await token(p), { appCheck: false })).rejects.toMatchObject({ code: "functions/unauthenticated" });
    await expect(callRaw("startAttempt", { lingoId: MEANING, ...CAMPUS }, await token(p), { appCheck: false })).rejects.toMatchObject({ code: "functions/unauthenticated" });
    await expect(callRaw("getMyState", {}, await token(p))).resolves.toHaveProperty("serverNow");
  });

  it("the forfeit endpoint refuses a missing or malformed App Check token", async () => {
    const p = await newPlayer();
    const a = await start(p, MEANING);
    const post = async (appCheck?: string) =>
      (
        await fetch(`${FUNCTIONS_ORIGIN}/forfeitAttempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token(p)}`, ...(appCheck ? { "X-Firebase-AppCheck": appCheck } : {}) },
          body: JSON.stringify({ attemptId: a.attemptId }),
        })
      ).status;
    expect(await post()).toBe(401);
    expect(await post("not-a-token")).toBe(401);
    expect((await adb.doc(`attempts/${a.attemptId}`).get()).data()!.status).toBe("open");
    expect(await post(APP_CHECK_TOKEN)).toBe(204);
    expect((await adb.doc(`attempts/${a.attemptId}`).get()).data()!.status).toBe("forfeit");
  });
});

describe("E. rate limits", () => {
  it("31st call in a minute → 'Slow down'; a new minute works again", async () => {
    await freshMinute();
    const p = await newPlayer(); // completeProfile = call 1
    for (let i = 0; i < 29; i++) await state(p);
    await expect(state(p)).rejects.toMatchObject({ code: "functions/resource-exhausted", details: { code: "slow-down" } });
    const off = (await adb.doc("_emulator/clock").get()).data()!.offsetMs;
    await adb.doc("_emulator/clock").set({ offsetMs: off + 60_000 });
    await expect(state(p)).resolves.toHaveProperty("serverNow");
  });

  it("7th startAttempt in a minute → 'Slow down'", async () => {
    await freshMinute();
    const p = await newPlayer();
    const lingos = ["lingo-2018", "lingo-2019", "lingo-2022", "lingo-2023", "lingo-2018", "lingo-2019"];
    for (const l of lingos) {
      const a = await start(p, l);
      await submit(p, { attemptId: a.attemptId, choice: a.options!.findIndex((o) => o !== RIGHT && o !== "since") }); // a wrong answer, so the next Start isn't "busy"
    }
    await expect(start(p, "lingo-2022")).rejects.toMatchObject({ details: { code: "slow-down" } });
  });
});

describe("F. account abuse", () => {
  it("an unverified email can't play even with a profile", async () => {
    const p = await newPlayer({ profile: false, verified: false });
    await adb.doc(`users/${p.uid}`).set({ ...(await user(await newPlayer())), name: "Sneaky", profileDone: true });
    await expect(start(p, MEANING)).rejects.toMatchObject({ details: { code: "unverified" } });
  });

  it("Disable player: every play function refuses, getMyState says so, the leaderboard drops them; admins only", async () => {
    const [a, p, other] = [await admin(), await newPlayer(), await newPlayer()];
    await adb.doc(`users/${p.uid}`).update({ points: 99_999_999 });
    await expect(callRaw("adminSetDisabled", { uid: p.uid, disabled: true }, await token(other))).rejects.toMatchObject({ code: "functions/permission-denied" });
    await callRaw("adminSetDisabled", { uid: p.uid, disabled: true }, await token(a));
    for (const [fn, data] of [
      ["startAttempt", { lingoId: MEANING, ...CAMPUS }],
      ["submitAttempt", { attemptId: "x", choice: 0 }],
      ["setFavorites", { lingoIds: [MEANING, "lingo-2019"] }],
      ["joinRaid", { raidId: "x", ...CAMPUS }],
    ] as const) {
      await expect(callRaw(fn, data, await token(p))).rejects.toMatchObject({ details: { code: "disabled" } });
    }
    expect((await state(p)).user!.disabled).toBe(true);
    await callRaw("adminRefreshLeaderboard", {}, await token(a));
    const top = (await adb.doc("leaderboard/students").get()).data()!.top as Array<{ uid: string }>;
    expect(top.some((r) => r.uid === p.uid)).toBe(false);
    await callRaw("adminSetDisabled", { uid: p.uid, disabled: false }, await token(a));
    await expect(start(p, MEANING)).resolves.toHaveProperty("attemptId");
    await adb.doc(`users/${p.uid}`).update({ points: 0 });
  });

  it("Possible duplicate accounts: same name, spelling variant, similar email, made minutes apart — flag only", async () => {
    const a = await admin();
    const tag = Math.random().toString(36).slice(2, 7);
    const make = async (name: string, email: string) => {
      const p = await newPlayer();
      await adb.doc(`users/${p.uid}`).update({ name: `${name} ${tag}`, email });
      return p.uid;
    };
    const ids = [
      await make("Ishaan Mehrotra", `ishaan.m${tag}1@gmail.com`),
      await make("ishaan  MEHROTRA", `other${tag}@x.com`),
      await make("Ishan Mehrotra", `zz${tag}@x.com`),
      await make("Kavya Rao", `ishaan.m${tag}22@yahoo.com`),
    ];
    const { rows } = await callRaw<AdminPlayersOutput>("adminDuplicates", {}, await token(a));
    const mine = rows.filter((r) => ids.includes(r.uid));
    expect(mine).toHaveLength(4);
    expect(new Set(mine.map((r) => r.group)).size).toBe(1);
    expect(mine.find((r) => r.uid === ids[1])!.reason).toMatch(/same name/);
    expect(mine.find((r) => r.uid === ids[2])!.reason).toMatch(/similar name/);
    expect(mine.find((r) => r.uid === ids[3])!.reason).toMatch(/similar email/);
    expect(mine[0].reason).toMatch(/min apart/);
    for (const id of ids) expect((await adb.doc(`users/${id}`).get()).data()!.disabled).toBeUndefined(); // no auto-ban
  });
});

describe("G + H. voice and location flags (flag only)", () => {
  it("every Read Aloud win perfect and under 2 s (5+) → voiceSuspect; points unchanged", async () => {
    const p = await newPlayer();
    await adb.doc(`users/${p.uid}`).update({ voiceWins: 4, voicePerfectFast: 4 });
    const r = await start(p, "lingo-2016");
    const out = await submit(p, { attemptId: r.attemptId, transcript: "programme" });
    expect(out.result).toBe("won");
    expect(out.pointsAdded).toBeGreaterThan(100);
    expect(await user(p)).toMatchObject({ voiceWins: 5, voicePerfectFast: 5, voiceSuspect: true });
    // An accepted-but-different spelling isn't "perfect": the pattern breaks, the flag goes.
    const s = await start(p, "lingo-2020");
    await submit(p, { attemptId: s.attemptId, transcript: "program" });
    expect(await user(p)).toMatchObject({ voiceWins: 6, voicePerfectFast: 5, voiceSuspect: false });
  });

  it("Start at one campus, then the other (4.5 km) within 5 minutes → locationJumps 1; still allowed", async () => {
    const p = await newPlayer();
    const a = await start(p, MEANING, { lat: 26.7838, lng: 75.8301 });
    await submit(p, { attemptId: a.attemptId, choice: 0 });
    const b = await start(p, "lingo-2019", { lat: 26.7759236, lng: 75.8745013 });
    expect(b.attemptId).toBeTruthy();
    expect((await user(p)).locationJumps).toBe(1);
    const flagged = await callRaw<AdminPlayersOutput>("adminSuspicious", {}, await token(await admin()));
    expect(flagged.rows.find((r) => r.uid === p.uid)).toMatchObject({ locationJumps: 1 });
  });
});

describe("J. prize desk", () => {
  async function volunteer() {
    const v = await newPlayer();
    await adminAuth.setCustomUserClaims(v.uid, { role: "volunteer" });
    await v.auth.currentUser!.getIdToken(true);
    return v;
  }
  it("two desks at the same moment, balance for one → exactly one succeeds; balance never negative", async () => {
    const [v1, v2, p] = [await volunteer(), await volunteer(), await newPlayer()];
    const prize = `prize-${Math.random().toString(36).slice(2, 8)}`;
    await adb.doc(`prizes/${prize}`).set({ name: "T-shirt", cost: 100, stock: 10 });
    await adb.doc(`users/${p.uid}`).update({ points: 150 });
    const outs = await Promise.allSettled([v1, v2].map(async (v) => callRaw("redeemPrize", { uid: p.uid, prizeId: prize }, await token(v))));
    expect(outs.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect((outs.find((o) => o.status === "rejected") as PromiseRejectedResult).reason.details.code).toBe("not-enough");
    const u = await user(p);
    expect(u.points - u.spent).toBe(50);
    expect(u.points).toBe(150); // leaderboard points stay as earned
    expect((await adb.doc(`prizes/${prize}`).get()).data()!.stock).toBe(9);
    expect((await adb.collection("redemptions").where("uid", "==", p.uid).get()).size).toBe(1);
  });

  it("last item in stock, two players at once → one gets it, stock stays ≥ 0; players can't redeem", async () => {
    const [v, p1, p2] = [await volunteer(), await newPlayer(), await newPlayer()];
    const prize = `prize-${Math.random().toString(36).slice(2, 8)}`;
    await adb.doc(`prizes/${prize}`).set({ name: "Mug", cost: 10, stock: 1 });
    for (const p of [p1, p2]) await adb.doc(`users/${p.uid}`).update({ points: 500 });
    const outs = await Promise.allSettled([p1, p2].map(async (p) => callRaw("redeemPrize", { uid: p.uid, prizeId: prize }, await token(v))));
    expect(outs.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect((outs.find((o) => o.status === "rejected") as PromiseRejectedResult).reason.details.code).toBe("out-of-stock");
    expect((await adb.doc(`prizes/${prize}`).get()).data()!.stock).toBe(0);
    await expect(callRaw("redeemPrize", { uid: p1.uid, prizeId: prize }, await token(p2))).rejects.toMatchObject({ code: "functions/permission-denied" });
  });
});

describe("K. time comes from the server", () => {
  it("client-sent times are ignored: expiresAt/serverNow/speed come from the server clock", async () => {
    const p = await newPlayer();
    const t0 = Date.now();
    const a = await start(p, MEANING, { now: 0, expiresAt: 9e15, serverNow: 1 });
    expect(Math.abs(a.serverNow - t0)).toBeLessThan(5000);
    expect(a.expiresAt - a.serverNow).toBe(15_000);
    const out = await submit(p, { attemptId: a.attemptId, choice: a.options!.indexOf(RIGHT), receivedAt: 0, answerMs: 1, speedBonus: 999 });
    expect(out.speedBonus).toBeLessThanOrEqual(15);
    const stored = (await adb.doc(`attempts/${a.attemptId}`).get()).data()!;
    expect(stored.answerMs).toBeGreaterThan(0);
    expect(stored.receivedAt.toMillis()).toBeGreaterThanOrEqual(t0);
  });

  it("the IST date (daily limits) follows the server clock, not anything the client sends", async () => {
    const p = await newPlayer();
    await pinQuestions();
    const s = await callRaw<GetMyStateOutput>("getMyState", { today: "2030-01-01" }, await token(p));
    expect(s.today).toBe(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10));
  });
});
