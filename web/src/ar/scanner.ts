// AR engine for the Scan screen. Only imported from screens/Scan.tsx (lazy route), so MindAR,
// TensorFlow.js and three.js never land in the bundle for other screens.
// DECISION: three is pinned to 0.151.3 — mind-ar 1.2.5 imports `sRGBEncoding`, removed in three r152.
import { MindARThree } from "mind-ar/dist/mindar-image-three.prod.js";

export const TARGETS_URL = "/assets/targets.mind";

export interface Scanner {
  start(): Promise<void>;
  stop(): void;
}

export function createScanner(container: HTMLElement): Scanner {
  const mindar = new MindARThree({
    container,
    imageTargetSrc: TARGETS_URL,
    uiLoading: "no",
    uiScanning: "no",
    uiError: "no",
  });
  return {
    start: () => mindar.start(),
    stop: () => mindar.stop(),
  };
}
