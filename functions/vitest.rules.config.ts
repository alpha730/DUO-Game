import { defineConfig } from "vitest/config";

// Rules tests hit the Firestore emulator (port 8085); run with `npm run test:rules`.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
