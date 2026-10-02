// forfeitAttempt (HTTP) against the emulators (PLAN 3.3).
import { afterAll, describe, expect, it } from "vitest";
import type { StartAttemptOutput } from "../src/shared/types";
import { adb, CAMPUS, cleanupApps, FUNCTIONS_ORIGIN, newPlayer } from "./helpers";

afterAll(cleanupApps);

const URL_ = `${FUNCTIONS_ORIGIN}/forfeitAttempt`;
type Player = Awaited<ReturnType<typeof newPlayer>>;
const start = (p: Player) => p.call<object, StartAttemptOutput>("startAttempt")({ lingoId: "lingo-2018", ...CAMPUS });
const forfeit = (token: string | null, body: unknown, init: RequestInit = {}) =>
  fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
const status = async (id: string) => (await adb.doc(`attempts/${id}`).get()).data()!.status;
const losses = async (p: Player) => (await adb.doc(`users/${p.uid}`).get()).data()!.losses;

describe("forfeitAttempt", () => {
  it("forfeits the caller's open attempt (204) and counts a loss; repeat calls are no-ops", async () => {
    const p = await newPlayer();
    const a = await start(p);
    const res = await forfeit(await p.idToken(), { attemptId: a.attemptId });
    expect(res.status).toBe(204);
    expect(await status(a.attemptId)).toBe("forfeit");
    expect(await losses(p)).toBe(1);
    expect((await forfeit(await p.idToken(), { attemptId: a.attemptId })).status).toBe(204);
    expect(await losses(p)).toBe(1);
  });

  it("accepts a text/plain body (keepalive / beacon style)", async () => {
    const p = await newPlayer();
    const a = await start(p);
    const res = await forfeit(await p.idToken(), JSON.stringify({ attemptId: a.attemptId }), {
      headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${await p.idToken()}` },
    });
    expect(res.status).toBe(204);
    expect(await status(a.attemptId)).toBe("forfeit");
  });

  it("rejects missing/bad tokens and never touches someone else's attempt", async () => {
    const owner = await newPlayer();
    const other = await newPlayer();
    const a = await start(owner);
    expect((await forfeit(null, { attemptId: a.attemptId })).status).toBe(401);
    expect((await forfeit("not-a-token", { attemptId: a.attemptId })).status).toBe(401);
    expect((await forfeit(await other.idToken(), { attemptId: a.attemptId })).status).toBe(204);
    expect(await status(a.attemptId)).toBe("open");
    expect((await forfeit(await owner.idToken(), { attemptId: "../x" })).status).toBe(400);
    expect((await fetch(URL_)).status).toBe(405);
  });

  // The emulator's `enableCors` debug feature allows every origin, so rejection of other origins is
  // covered by src/lib/origins.test.ts; here we check the allowed ones are echoed.
  it("answers CORS preflights for the hosting domain and localhost", async () => {
    const preflight = (origin: string) =>
      fetch(URL_, {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
      });
    expect((await preflight("https://demo-decade-hunt.web.app")).headers.get("access-control-allow-origin")).toBe(
      "https://demo-decade-hunt.web.app",
    );
    expect((await preflight("http://localhost:5173")).headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("works same-origin through the dev proxy (/api/forfeit)", async () => {
    const p = await newPlayer();
    const a = await start(p);
    const res = await fetch("http://localhost:5173/api/forfeit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await p.idToken()}` },
      body: JSON.stringify({ attemptId: a.attemptId }),
    });
    expect(res.status).toBe(204);
    expect(await status(a.attemptId)).toBe("forfeit");
  });
});
