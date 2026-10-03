import { describe, expect, it } from "vitest";
import { rankStudents, type RankInput } from "./rank";

const u = (uid: string, o: Partial<RankInput>): RankInput => ({
  uid,
  name: uid.toUpperCase(),
  points: 100,
  wins: 1,
  losses: 0,
  totalAnswerMs: 5000,
  pointsReachedAt: 1_000,
  ...o,
});
const order = (users: RankInput[]) => rankStudents(users).map((r) => r.uid);

describe("rankStudents (SPEC §2 leaderboard order)", () => {
  it("points first", () => {
    expect(order([u("a", { points: 100 }), u("b", { points: 300 }), u("c", { points: 200 })])).toEqual(["b", "c", "a"]);
  });

  it("equal points → higher accuracy first", () => {
    expect(
      order([
        u("sloppy", { wins: 2, losses: 2 }), // 50 %
        u("sharp", { wins: 2, losses: 0 }), // 100 %
      ]),
    ).toEqual(["sharp", "sloppy"]);
  });

  it("equal points + accuracy → faster average answer first", () => {
    expect(
      order([
        u("slow", { wins: 2, losses: 0, totalAnswerMs: 20_000 }), // 10 s avg
        u("fast", { wins: 2, losses: 0, totalAnswerMs: 6_000 }), // 3 s avg
      ]),
    ).toEqual(["fast", "slow"]);
  });

  it("then whoever reached the score first", () => {
    expect(order([u("late", { pointsReachedAt: 9_000 }), u("early", { pointsReachedAt: 2_000 })])).toEqual(["early", "late"]);
  });

  it("applies the keys in order (points beat accuracy beat speed)", () => {
    expect(
      order([
        u("acc", { points: 200, wins: 2, losses: 0, totalAnswerMs: 30_000 }),
        u("fast", { points: 200, wins: 2, losses: 2, totalAnswerMs: 2_000 }),
        u("rich", { points: 210, wins: 1, losses: 5, totalAnswerMs: 15_000 }),
      ]),
    ).toEqual(["rich", "acc", "fast"]);
  });

  it("keeps the top 100, skips 0-point players, and fills the row fields", () => {
    const many = Array.from({ length: 150 }, (_, i) => u(`p${String(i).padStart(3, "0")}`, { points: 1000 - i }));
    const rows = rankStudents([...many, u("zero", { points: 0, wins: 0, losses: 3 })]);
    expect(rows).toHaveLength(100);
    expect(rows[0]).toEqual({ uid: "p000", name: "P000", points: 1000, accuracy: 1, avgAnswerMs: 5000 });
    expect(rows.at(-1)!.uid).toBe("p099");
    expect(rows.some((r) => r.uid === "zero")).toBe(false);
  });

  it("is deterministic on complete ties", () => {
    expect(order([u("b", {}), u("a", {})])).toEqual(["a", "b"]);
  });
});
