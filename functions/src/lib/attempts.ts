import { FieldValue, type QuerySnapshot, type Transaction } from "firebase-admin/firestore";
import { COL } from "../shared/types";
import { db, userRef } from "./db";

/** Transaction read: the user's open attempts. Do all reads before calling forfeitTx (Firestore rule). */
export function readOpenAttemptsTx(tx: Transaction, uid: string): Promise<QuerySnapshot> {
  return tx.get(db().collection(COL.attempts).where("uid", "==", uid).where("status", "==", "open"));
}

/** Transaction write: marks the given open attempts forfeit and adds them to losses (SPEC §3.5, §5). */
export function forfeitTx(tx: Transaction, uid: string, open: QuerySnapshot): number {
  if (open.empty) return 0;
  for (const d of open.docs) tx.update(d.ref, { status: "forfeit" });
  tx.update(userRef(uid), { losses: FieldValue.increment(open.size) });
  return open.size;
}

/** Standalone version (getMyState). Safe against concurrent callers: the transaction retries. */
export function forfeitOpenAttempts(uid: string): Promise<number> {
  return db().runTransaction(async (tx) => forfeitTx(tx, uid, await readOpenAttemptsTx(tx, uid)));
}
