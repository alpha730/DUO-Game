import { getAppCheck } from "firebase-admin/app-check";
import { isEmulator } from "./geo";

/**
 * Firebase App Check (anti-cheat D): callables and the forfeit endpoint only answer requests that
 * carry a valid App Check token, i.e. come from the real app (reCAPTCHA Enterprise), not a script.
 * On by default; `ENFORCE_APP_CHECK=false` in functions/.env.<project> is the emergency switch
 * (README → App Check).
 */
export const APP_CHECK_ENFORCED = process.env.ENFORCE_APP_CHECK !== "false";

const JWT = /^[\w-]+\.[\w-]+\.[\w-]*$/;

/**
 * Checks an App Check token from a request header. Production: verified by the Admin SDK. Emulator:
 * there is no App Check backend locally, so — like the callable emulator — the token is decoded
 * without its signature; the test/debug token (web/src/lib/appCheck.ts) passes, a missing or
 * malformed one doesn't.
 */
export async function appCheckTokenOk(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  if (isEmulator()) {
    if (!JWT.test(token)) return false;
    try {
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { sub?: unknown };
      return typeof claims.sub === "string" && claims.sub.length > 0;
    } catch {
      return false;
    }
  }
  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch {
    return false;
  }
}
