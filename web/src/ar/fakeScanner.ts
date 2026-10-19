// Emulator-only stand-in for ar/scanner.ts, for headless E2E tests (no camera, no WebGL — e.g. WebKit).
// Used only when the app runs against the emulators AND the test page set `window.__FAKE_SCANNER = true`
// (screens/Scan.tsx); a production build on the real domain never loads it. The test then drives
// detection with `window.__posterFound(i)` / `window.__posterLost(i)`, exactly like MindAR's events.
import type { Scanner, ScannerEvents, ScannerOptions } from "./scanner";

type TestWindow = Window & {
  __FAKE_SCANNER?: boolean;
  __posterFound?: (posterIndex: number) => void;
  __posterLost?: (posterIndex: number) => void;
};

export function createScanner(
  _container: HTMLElement,
  _targetsSrc: string,
  posterIndexes: number[],
  events: ScannerEvents,
  _options: ScannerOptions = {},
): Scanner {
  const w = window as TestWindow;
  return {
    async start() {
      w.__posterFound = (i) => posterIndexes.includes(i) && events.onFound(i);
      w.__posterLost = (i) => events.onLost(i);
    },
    stop() {
      delete w.__posterFound;
      delete w.__posterLost;
    },
    setModel() {},
    async setStandee() {},
    setStandeeLevel() {},
  };
}
