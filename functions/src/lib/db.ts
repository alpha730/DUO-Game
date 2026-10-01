import { getFirestore } from "firebase-admin/firestore";
import { COL, DEFAULT_RULES, DOC, type GameConfigDoc } from "../shared/types";

export const db = () => getFirestore();

export const userRef = (uid: string) => db().collection(COL.users).doc(uid);
export const catchRef = (uid: string, lingoId: string) => userRef(uid).collection(COL.catches).doc(lingoId);
export const configRef = () => db().collection(COL.config).doc(DOC.gameConfig);

/** Reads config/game, filling any missing rule with its default. */
export async function loadConfig(): Promise<GameConfigDoc | null> {
  const snap = await configRef().get();
  if (!snap.exists) return null;
  const data = snap.data() as GameConfigDoc;
  return { ...data, rules: { ...DEFAULT_RULES, ...data.rules } };
}
