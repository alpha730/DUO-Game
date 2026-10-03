import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// Content hash of assets/targets.mind: the app requests /assets/targets.mind?v=<hash>, so Hosting can
// cache it for 30 days and a new file (e.g. the real posters) is still picked up on the next deploy.
const targetsFile = fileURLToPath(new URL("../assets/targets.mind", import.meta.url));
const hash = (file: string) => createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 10);
const targetsVersion = existsSync(targetsFile) ? hash(targetsFile) : "missing";

// Same for every Lingo model: /assets/models/<file>?v=<hash> (30-day cache, CLAUDE.md cost rules).
const modelsDir = fileURLToPath(new URL("../assets/models", import.meta.url));
const modelVersions = Object.fromEntries(
  (existsSync(modelsDir) ? readdirSync(modelsDir) : [])
    .filter((f) => f.endsWith(".glb"))
    .map((f) => [f, hash(`${modelsDir}/${f}`)]),
);
const threeRev = JSON.parse(readFileSync(new URL("./node_modules/three/package.json", import.meta.url), "utf8")).version.split(".")[1];

// Brand files supplied by the Duolingo team (CLAUDE.md rule 8), e.g. "logos/logo.svg". brand.ts only
// switches an official item on when its file is here; sync-assets copies them to /brand/.
const brandDir = fileURLToPath(new URL("../assets/brand", import.meta.url));
const brandFiles = ["fonts", "logos", "mascots", "models"].flatMap((d) =>
  existsSync(`${brandDir}/${d}`) ? readdirSync(`${brandDir}/${d}`).filter((f) => !f.startsWith(".")).map((f) => `${d}/${f}`) : [],
);

/** Writes the active brand into index.html (title, favicon, theme colour, CSS variables) so the very
 *  first paint is on-brand — no flash before the JS bundle loads. Same source: src/config/brand.ts. */
async function brandHtml(): Promise<Plugin> {
  (globalThis as { __BRAND_FILES__?: string[] }).__BRAND_FILES__ = brandFiles;
  const { BRAND } = await import("./src/config/brand");
  const { brandCss } = await import("./src/config/applyBrand");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return {
    name: "brand-html",
    transformIndexHtml: (html) =>
      html.replace(
        "<!-- brand -->",
        [
          `<title>${esc(BRAND.appName)}</title>`,
          `<link rel="icon" href="${esc(BRAND.logo.mark)}" />`,
          `<meta name="theme-color" content="${esc(BRAND.colors.themeColor)}" />`,
          `<style id="brand-vars">${brandCss(BRAND)}</style>`,
        ].join("\n    "),
      ),
  };
}

export default defineConfig(async () => ({
  plugins: [react(), await brandHtml()],
  define: {
    __BRAND_FILES__: JSON.stringify(brandFiles),
    __TARGETS_VERSION__: JSON.stringify(targetsVersion),
    __MODEL_VERSIONS__: JSON.stringify(modelVersions),
    __THREE_REV__: JSON.stringify(threeRev),
  },
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
}));
