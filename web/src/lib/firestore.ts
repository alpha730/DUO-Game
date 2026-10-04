// Firestore, loaded on demand (Day 8 performance). It is about half of the app's JS, and Home can
// render without it (getMyState brings the user and attempts), so it is NOT part of the first-load
// bundle: always-loaded modules reach it with `await import("./firestore")`; lazy screens import it.
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { app, usingEmulators } from "./firebase";

export const db = getFirestore(app);
if (usingEmulators) connectFirestoreEmulator(db, location.hostname, 8085);

export { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
