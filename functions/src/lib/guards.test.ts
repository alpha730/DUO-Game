import { describe, expect, it } from "vitest";
import { gameClosedReason, requireAuth, requireRole } from "./guards";

const ts = (iso: string) => {
  const ms = Date.parse(iso);
  return { seconds: ms / 1000, nanoseconds: 0, toMillis: () => ms, toDate: () => new Date(ms) };
};
const config = {
  startAt: ts("2026-10-09T18:30:00Z"), // Oct 10 00:00 IST
  lockAt: ts("2026-10-22T06:30:00Z"), // Oct 22 12:00 IST
  locked: false,
};

describe("gameClosedReason", () => {
  it("is not-started before startAt", () => {
    expect(gameClosedReason(config, Date.parse("2026-10-09T18:29:59Z"))).toBe("not-started");
  });
  it("is open from startAt", () => {
    expect(gameClosedReason(config, Date.parse("2026-10-09T18:30:00Z"))).toBeNull();
  });
  it("is locked at lockAt", () => {
    expect(gameClosedReason(config, Date.parse("2026-10-22T06:29:59Z"))).toBeNull();
    expect(gameClosedReason(config, Date.parse("2026-10-22T06:30:00Z"))).toBe("locked");
  });
  it("is locked when the flag is set", () => {
    expect(gameClosedReason({ ...config, locked: true }, Date.parse("2026-10-15T00:00:00Z"))).toBe("locked");
  });
});

describe("requireAuth / requireRole", () => {
  const req = (role?: string) => ({ auth: { uid: "u1", token: { role } } }) as never;

  it("rejects signed-out callers", () => {
    expect(() => requireAuth({ auth: undefined })).toThrow(/sign in/);
  });
  it("returns the uid", () => {
    expect(requireAuth(req())).toBe("u1");
  });
  it("checks the role claim", () => {
    expect(requireRole(req("admin"), ["admin"])).toBe("u1");
    expect(requireRole(req("volunteer"), ["admin", "volunteer"])).toBe("u1");
    expect(() => requireRole(req("volunteer"), ["admin"])).toThrow(/Not allowed/);
    expect(() => requireRole(req(), ["admin"])).toThrow(/Not allowed/);
  });
});
