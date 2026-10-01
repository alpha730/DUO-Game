// Calls the deployed-to-emulator completeProfile through the client SDK, like the phone does.
// Needs Auth + Firestore + Functions emulators: `npm run test:emu`.
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const apps: FirebaseApp[] = [];

async function newPlayer() {
  const app = initializeApp({ projectId: "demo-decade-hunt", apiKey: "demo-key" }, `p${apps.length}-${Date.now()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const fns = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const email = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`;
  await createUserWithEmailAndPassword(auth, email, "password123");
  return { auth, completeProfile: httpsCallable(fns, "completeProfile") };
}

const roll = `T${Date.now().toString(36).toUpperCase()}`;
const profile = (r = roll) => ({ name: "Test Player", dept: "CSE", year: 1, roll: r });

let a: Awaited<ReturnType<typeof newPlayer>>;
let b: Awaited<ReturnType<typeof newPlayer>>;

beforeAll(async () => {
  [a, b] = await Promise.all([newPlayer(), newPlayer()]);
});
afterAll(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe("completeProfile", () => {
  it("creates the profile", async () => {
    await expect(a.completeProfile(profile())).resolves.toMatchObject({ data: { ok: true } });
  });

  it("rejects a second call by the same user", async () => {
    await expect(a.completeProfile(profile(`${roll}X`))).rejects.toMatchObject({
      code: "functions/already-exists",
      details: { code: "profile-done" },
    });
  });

  it("rejects a duplicate roll (case/space-insensitive) from another user", async () => {
    await expect(b.completeProfile(profile(`  ${roll.toLowerCase()} `))).rejects.toMatchObject({
      code: "functions/already-exists",
      details: { code: "roll-taken" },
    });
  });

  it("rejects invalid input", async () => {
    await expect(b.completeProfile({ ...profile("ZZ999"), dept: "Law" })).rejects.toMatchObject({
      code: "functions/invalid-argument",
    });
  });

  it("rejects signed-out callers", async () => {
    await signOut(b.auth);
    await expect(b.completeProfile(profile("ZZ998"))).rejects.toMatchObject({ code: "functions/unauthenticated" });
  });
});
