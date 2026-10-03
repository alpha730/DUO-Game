// Gives an account a staff role (custom claim `role`, SPEC §5) or removes it.
//   Emulator (default):  npx tsx scripts/setRole.ts <email> <admin|volunteer|none>
//   Production:          GOOGLE_APPLICATION_CREDENTIALS=key.json npx tsx scripts/setRole.ts <email> <role> --prod --project <id>
// The account must have signed in once. The new role reaches the app on its next token refresh
// (the Staff-only screen has a "Refresh access" button; signing out and in also works). Removing a
// role takes effect when the token next refreshes (within 1 hour) or at sign-out.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Role } from "../shared/types";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const projectArg = args.indexOf("--project");
const projectId = projectArg >= 0 ? args[projectArg + 1] : "demo-decade-hunt";
const [email, roleArg] = args.filter((a, i) => !a.startsWith("--") && !(projectArg >= 0 && i === projectArg + 1));

const ROLES: Array<Role | "none"> = ["admin", "volunteer", "none"];
if (!email || !email.includes("@") || !ROLES.includes(roleArg as Role | "none")) {
  console.error("Usage: npx tsx scripts/setRole.ts <email> <admin|volunteer|none> [--prod --project <id>]");
  process.exit(1);
}
if (!prod) process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
if (prod && projectId.startsWith("demo-")) throw new Error("--prod needs --project <real project id>");

initializeApp({ projectId });
const auth = getAuth();

const user = await auth.getUserByEmail(email).catch(() => null);
if (!user) {
  console.error(`No account for ${email} in ${prod ? projectId : "the emulator"} — sign in once first.`);
  process.exit(1);
}
const { role: _old, ...otherClaims } = user.customClaims ?? {};
await auth.setCustomUserClaims(user.uid, roleArg === "none" ? otherClaims : { ...otherClaims, role: roleArg });
console.log(`${email} (${user.uid}): role ${_old ?? "none"} → ${roleArg}${prod ? ` in ${projectId}` : " (emulator)"}.`);
