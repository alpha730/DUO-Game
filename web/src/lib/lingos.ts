import { COL, type LingoDoc } from "@shared/types";
import { BRAND } from "../config/brand";

export type Lingo = LingoDoc & { id: string };

let cache: Promise<Lingo[]> | null = null;

/** The 10 Lingos, sorted by posterIndex. Fetched once per app session (they don't change mid-game). */
export function loadLingos(): Promise<Lingo[]> {
  cache ??= import("./firestore")
    .then(({ db, collection, getDocs }) => getDocs(collection(db, COL.lingos)))
    .then((snap) =>
      snap.docs
        .map((d) => {
          const doc = d.data() as LingoDoc;
          return { id: d.id, ...doc, color: BRAND.lingoColors[d.id] ?? doc.color };
        })
        .sort((a, b) => a.posterIndex - b.posterIndex),
    )
    .catch((err) => {
      cache = null; // allow a retry
      throw err;
    });
  return cache;
}
