// Firestore rules tests (SPEC §6). Needs the Firestore emulator: `npm run test:emu`.
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";

let env: RulesTestEnvironment;

const NEVER_READABLE = [
  "attempts/a1",
  "challenges/2026-10-10_lingo1",
  "pointsLog/p1",
  "redemptions/r1",
  "raids/raid1/players/alice",
];
const SIGNED_IN_READABLE = [
  "lingos/lingo1",
  "config/game",
  "leaderboard/students",
  "raids/raid1",
  "raids/raid1/shards/3",
  "prizes/prize1",
  "final/state",
];
const ALL = [...NEVER_READABLE, ...SIGNED_IN_READABLE, "users/alice", "users/alice/catches/lingo1"];

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-decade-hunt-rules",
    firestore: {
      host: "127.0.0.1",
      port: 8085,
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all(ALL.map((p) => setDoc(doc(db, p), { seeded: true })));
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anon = () => env.unauthenticatedContext().firestore();
const admin = () => env.authenticatedContext("root", { role: "admin" }).firestore();

describe("never-readable collections", () => {
  for (const path of NEVER_READABLE) {
    it(`${path}: no read for owner-ish user, admin claim, or anon`, async () => {
      await assertFails(getDoc(doc(alice(), path)));
      await assertFails(getDoc(doc(admin(), path)));
      await assertFails(getDoc(doc(anon(), path)));
    });
  }
  it("cannot list attempts or challenges", async () => {
    await assertFails(getDocs(collection(alice(), "attempts")));
    await assertFails(getDocs(collection(alice(), "challenges")));
  });
});

describe("signed-in readable", () => {
  for (const path of SIGNED_IN_READABLE) {
    it(`${path}: signed in can read, anon cannot`, async () => {
      await assertSucceeds(getDoc(doc(alice(), path)));
      await assertFails(getDoc(doc(anon(), path)));
    });
  }
});

describe("users", () => {
  it("owner can read own user and catches", async () => {
    await assertSucceeds(getDoc(doc(alice(), "users/alice")));
    await assertSucceeds(getDoc(doc(alice(), "users/alice/catches/lingo1")));
    await assertSucceeds(getDocs(collection(alice(), "users/alice/catches")));
  });
  it("others cannot read them", async () => {
    await assertFails(getDoc(doc(bob(), "users/alice")));
    await assertFails(getDoc(doc(bob(), "users/alice/catches/lingo1")));
    await assertFails(getDoc(doc(anon(), "users/alice")));
    await assertFails(getDocs(collection(alice(), "users")));
  });
});

describe("no client writes anywhere", () => {
  for (const path of ALL) {
    it(`${path}: create/update/delete denied`, async () => {
      // Owner + admin claim is the most privileged client there is.
      const ctx = path.startsWith("users/alice") ? alice() : admin();
      await assertFails(setDoc(doc(ctx, path), { points: 999999 }));
      await assertFails(updateDoc(doc(ctx, path), { points: 999999 }));
      await assertFails(deleteDoc(doc(ctx, path)));
    });
  }
  it("cannot create a brand new user doc for self", async () => {
    await assertFails(setDoc(doc(bob(), "users/bob"), { points: 100, profileDone: true }));
  });
});
