import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Content hash of assets/targets.mind: the app requests /assets/targets.mind?v=<hash>, so Hosting can
// cache it for 30 days and a new file (e.g. the real posters) is still picked up on the next deploy.
const targetsFile = fileURLToPath(new URL("../assets/targets.mind", import.meta.url));
const targetsVersion = existsSync(targetsFile)
  ? createHash("sha1").update(readFileSync(targetsFile)).digest("hex").slice(0, 10)
  : "missing";

export default defineConfig({
  plugins: [react()],
  define: { __TARGETS_VERSION__: JSON.stringify(targetsVersion) },
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) },
  },
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    fs: { allow: [".."] }, // ../shared
    // Same-origin forfeit endpoint, like the Hosting rewrite in firebase.json (no CORS preflight
    // for the keepalive request fired while the page is closing).
    proxy: {
      "/api/forfeit": {
        target: "http://127.0.0.1:5001",
        rewrite: () => "/demo-decade-hunt/asia-south1/forfeitAttempt",
      },
    },
  },
});
