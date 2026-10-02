import { defineConfig } from "vitest/config";

// Emulator tests (rules + functions); run with `npm run test:emu` while emulators are up,
// or `npm run test:emu:ci` to start them just for the run.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Some tests patch config/game temporarily; run files one at a time.
    fileParallelism: false,
  },
});
