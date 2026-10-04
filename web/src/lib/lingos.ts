import { COL, type LingoDoc } from "@shared/types";

export type Lingo = LingoDoc & { id: string };

let cache: Promise<Lingo[]> | null = null;

/** The 10 Lingos, sorted by posterIndex. Fetched once per app session (they don't change mid-game). */
export function loadLingos(): Promise<Lingo[]> {
  cache ??= import("./firestore")
    .then(({ db, collection, getDocs }) => getDocs(collection(db, COL.lingos)))
    .then((snap) =>
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as LingoDoc) })).sort((a, b) => a.posterIndex - b.posterIndex),
    )
    .catch((err) => {
      cache = null; // allow a retry
      throw err;
    });
  return cache;
}
