import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { COL, type AttemptDoc } from "../shared/types";
import { db, userRef } from "../lib/db";
import { allowedOrigins } from "../lib/origins";
import { APP_CHECK_ENFORCED, appCheckTokenOk } from "../lib/appCheck";
import { rateLimit } from "../lib/rateLimit";
import { serverNow } from "../lib/clock";

// Hosting domains; the app itself calls same-origin /api/forfeit (firebase.json rewrite), so CORS
// only matters for direct calls to the function URL. (The emulator allows every origin regardless.)
const ORIGINS = allowedOrigins(process.env.GCLOUD_PROJECT ?? "", process.env.FUNCTIONS_EMULATOR === "true");

/**
 * One-chance rule (SPEC §3.4): the client fires this with fetch(keepalive) when the page is hidden.
 * POST, headers `Authorization: Bearer <idToken>` + `X-Firebase-AppCheck: <token>`, body `{attemptId}` → 204.
 * Idempotent: an attempt that's already closed is left alone (still 204).
 */
export const forfeitAttempt = onRequest({ cors: ORIGINS }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("POST only");
    return;
  }
  const token = /^Bearer (.+)$/.exec(req.get("authorization") ?? "")?.[1];
  if (!token) {
    res.status(401).send("Missing token");
    return;
  }
  // Anti-cheat D: like the callables, only the real app (a valid App Check token).
  if (APP_CHECK_ENFORCED && !(await appCheckTokenOk(req.get("x-firebase-appcheck") ?? undefined))) {
    res.status(401).send("Missing or invalid App Check token");
    return;
  }
  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(token)).uid;
  } catch {
    res.status(401).send("Bad token");
    return;
  }
  try {
    await rateLimit(uid, "call", await serverNow());
  } catch {
    res.status(429).send("Slow down");
    return;
  }

  // keepalive/beacon bodies may arrive as text; accept both.
  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const attemptId = (body as { attemptId?: unknown } | undefined)?.attemptId;
  if (typeof attemptId !== "string" || !/^[\w-]{1,64}$/.test(attemptId)) {
    res.status(400).send("Bad attemptId");
    return;
  }

  const ref = db().collection(COL.attempts).doc(attemptId);
  const closed = await db().runTransaction(async (tx) => {
    const attempt = (await tx.get(ref)).data() as AttemptDoc | undefined;
    if (!attempt || attempt.uid !== uid || attempt.status !== "open") return false;
    tx.update(ref, { status: "forfeit" });
    // An open attempt is always the one users/{uid}.openAttemptId points to.
    tx.update(userRef(uid), { losses: FieldValue.increment(1), openAttemptId: null });
    return true;
  });
  if (closed) logger.info("attempt forfeited", { uid, attemptId });
  res.status(204).end();
});
