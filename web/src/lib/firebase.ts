import { initializeApp } from "firebase/app";
import { CustomProvider, getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const functions = getFunctions(app, "asia-south1");

const onLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
export const usingEmulators = env.VITE_USE_EMULATORS === "true" || (env.VITE_USE_EMULATORS !== "false" && onLocalhost);

if (usingEmulators) {
  // Same host the page was loaded from, so a phone on the LAN can reach the dev machine's emulators.
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  // Firestore connects in ./firestore.ts (loaded on demand).
  connectFunctionsEmulator(functions, host, 5001);
}

// Firebase App Check (anti-cheat D): every call to our functions and Firestore carries a token that
// proves it comes from this app on this site (reCAPTCHA v3, invisible), so a script calling the
// functions directly is refused. Set up: README → App Check.
function emulatorToken(): string {
  // The emulators decode App Check tokens without checking a signature (there's no App Check
  // backend locally), so tests and local play use this unsigned "debug" token.
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  const claims = { sub: env.VITE_FIREBASE_APP_ID || "demo-app", iss: "emulator", aud: [`projects/${env.VITE_FIREBASE_PROJECT_ID}`], iat: now, exp: now + 3600 };
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.emulator`;
}

function startAppCheck(): AppCheck | null {
  if (usingEmulators) {
    const provider = new CustomProvider({ getToken: async () => ({ token: emulatorToken(), expireTimeMillis: Date.now() + 3600_000 }) });
    return initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  }
  if (!env.VITE_RECAPTCHA_SITE_KEY) {
    console.warn("[app-check] VITE_RECAPTCHA_SITE_KEY is not set — calls are refused once App Check is enforced (README → App Check).");
    return null;
  }
  // A registered debug token lets a desktop/test browser through (never set in the live build).
  if (env.VITE_APPCHECK_DEBUG_TOKEN) (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN;
  return initializeAppCheck(app, { provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
}

export const appCheck = startAppCheck();

/** The current App Check token (null if App Check isn't set up or it failed), for raw fetch calls. */
export async function appCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    return (await getToken(appCheck)).token;
  } catch {
    return null;
  }
}
