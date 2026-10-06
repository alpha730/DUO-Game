import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

initializeApp();
setGlobalOptions({ region: "asia-south1", maxInstances: 20 });

// One export per function; each lives in its own file in ./fns.
export { completeProfile } from "./fns/completeProfile";
export { getMyState } from "./fns/getMyState";
export { startAttempt } from "./fns/startAttempt";
export { submitAttempt } from "./fns/submitAttempt";
export { forfeitAttempt } from "./fns/forfeitAttempt";
export { setFavorites } from "./fns/setFavorites";
export { refreshLeaderboard } from "./fns/refreshLeaderboard";
export { adminRefreshLeaderboard } from "./fns/adminRefreshLeaderboard";
export { adminCreateRaid } from "./fns/adminCreateRaid";
export { adminSetConfig } from "./fns/adminSetConfig";
export { adminUpsertQuestions } from "./fns/adminUpsertQuestions";
export { adminStats } from "./fns/adminStats";
export { lockGame } from "./fns/lockGame";
export { adminSuspicious } from "./fns/adminSuspicious";
export { adminTop20 } from "./fns/adminTop20";
export { joinRaid } from "./fns/joinRaid";
export { raidTicker } from "./fns/raidTicker";
