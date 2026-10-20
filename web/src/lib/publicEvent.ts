import { COL, DOC, type IstDate } from "@shared/types";

/** public/event as the app uses it: the one-day event's date and round times (ms). */
export interface PublicEvent {
  date: IstDate;
  rounds: { startAt: number; endAt: number }[];
}

let cached: Promise<PublicEvent | null> | null = null;

/**
 * The one-day event's round times from public/event — readable signed out (firestore.rules), so the
 * login screen and Rules can show them before sign-in. null = no event (the multi-day game). One read
 * per page load; Firestore is loaded on demand (it isn't in the first-load bundle).
 */
export function loadPublicEvent(): Promise<PublicEvent | null> {
  cached ??= import("./firestore")
    .then(({ db, doc, getDoc }) => getDoc(doc(db, COL.public, DOC.publicEvent)))
    .then((snap) => {
      const d = snap.data() as { date?: string; rounds?: { startAt: { toMillis(): number }; endAt: { toMillis(): number } }[] } | undefined;
      if (!d?.date || !d.rounds?.length) return null;
      const rounds = d.rounds.map((r) => ({ startAt: r.startAt.toMillis(), endAt: r.endAt.toMillis() })).sort((a, b) => a.startAt - b.startAt);
      return { date: d.date, rounds };
    })
    .catch(() => {
      cached = null; // offline: try again next time
      return null;
    });
  return cached;
}

/** "Thu, 22 Oct" (IST) */
export const eventDay = (date: IstDate) =>
  new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
