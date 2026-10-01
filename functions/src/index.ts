import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-south1", maxInstances: 20 });

// One export per function; each lives in its own file in ./fns.
export { completeProfile } from "./fns/completeProfile";
export { getMyState } from "./fns/getMyState";
