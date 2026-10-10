import { FieldValue, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { COL, type AttemptDoc, type UserDoc } from "../shared/types";
import { db, userRef } from "./db";

// DECISION (Day 8 load test): the user's open attempt is found through `users/{uid}.openAttemptId`,
// never by querying `attempts` inside a transaction. A collection query in hundreds of concurrent
// transactions (all inserting into that same collection) caused lock timeouts; with the pointer,
// each transaction only touches the player's own documents.

/** Transaction read: the attempt the user doc points to (null if none). Read the user doc first. */
export function readOpenAttemptTx(tx: Transaction, user: Pick<UserDoc, "openAttemptId"> | undefined): Promise<DocumentSnapshot> | null {
  return user?.openAttemptId ? tx.get(db().collection(COL.attempts).doc(user.openAttemptId)) : null;
}

/**
 * Transaction write: forfeits that attempt if it's still open and counts a loss (SPEC §3.5, §5).
 * Returns how many were closed (0/1). The caller sets or clears `openAttemptId`.
 */
export function forfeitTx(tx: Transaction, uid: string, snap: DocumentSnapshot | null): number {
  if (!snap?.exists || (snap.data() as AttemptDoc).status !== "open") return 0;
  tx.update(snap.ref, { status: "forfeit" });
  tx.update(userRef(uid), { losses: FieldValue.increment(1) });
  return 1;
}

/**
 * Auto-forfeit (getMyState): closes the user's open attempt, if any. Costs one user read when there
 * is none (the common case), and only then runs a transaction.
 * Only an attempt that started BEFORE this request arrived (`requestAt`, server time) is closed: a
 * getMyState from a page the player just left can reach the server after their next Start, and must
 * never kill that new attempt (QA: seen as a wrong answer reported "Chance lost").
 */
export async function forfeitOpenAttempt(uid: string, user: Pick<UserDoc, "openAttemptId"> | undefined, requestAt = Infinity): Promise<number> {
  if (!user?.openAttemptId) return 0;
  return db().runTransaction(async (tx) => {
    const fresh = (await tx.get(userRef(uid))).data() as UserDoc | undefined;
    const snap = await readOpenAttemptTx(tx, fresh);
    if (!fresh?.openAttemptId) return 0;
    const startedAt = (snap?.data() as AttemptDoc | undefined)?.startedAt?.toMillis() ?? 0;
    if (startedAt >= requestAt) return 0; // started after this request: not ours to close
    const closed = forfeitTx(tx, uid, snap);
    tx.update(userRef(uid), { openAttemptId: null });
    return closed;
  });
}
