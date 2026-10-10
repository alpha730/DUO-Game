// Emulator only: test accounts for QA — 1 admin, 1 volunteer, 5 players. Each is email-verified and
// has a finished profile (made through the real completeProfile function). Password for all: test1234.
//   npx tsx scripts/testUsers.ts           (after `firebase emulators:start` + `npx tsx scripts/seed.ts`)
// Safe to re-run: existing accounts are reused.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Role } from "../shared/types";

const PROJECT = "demo-decade-hunt";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/asia-south1`;
const PASSWORD = "test1234";

export const TEST_USERS: Array<{ email: string; name: string; role?: Role }> = [
  { email: "admin@qa.test", name: "QA Admin", role: "admin" },
  { email: "volunteer@qa.test", name: "QA Volunteer", role: "volunteer" },
  ...[1, 2, 3, 4, 5].map((n) => ({ email: `player${n}@qa.test`, name: `QA Player ${n}` })),
];

initializeApp({ projectId: PROJECT });
const auth = getAuth();

async function signIn(email: string): Promise<string> {
  const res = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const body = (await res.json()) as { idToken?: string; error?: { message: string } };
  if (!body.idToken) throw new Error(`sign-in ${email}: ${body.error?.message}`);
  return body.idToken;
}

for (const u of TEST_USERS) {
  const existing = await auth.getUserByEmail(u.email).catch(() => null);
  const user = existing ?? (await auth.createUser({ email: u.email, password: PASSWORD, displayName: u.name }));
  await auth.updateUser(user.uid, { emailVerified: true });
  await auth.setCustomUserClaims(user.uid, u.role ? { role: u.role } : null);
  const res = await fetch(`${FUNCTIONS}/completeProfile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await signIn(u.email)}` },
    body: JSON.stringify({ data: { name: u.name } }),
  });
  const ok = res.ok || (await res.text()).includes("already");
  console.log(`${ok ? "✓" : "✗"} ${u.email.padEnd(20)} ${u.role ?? "player"}  uid ${user.uid}`);
}
console.log(`\nPassword for every account: ${PASSWORD}`);
