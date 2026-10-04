import { initializeApp } from "firebase/app";
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
