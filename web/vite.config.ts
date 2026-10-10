import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";

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
const threeRev = JSON.parse(
  readFileSync(new URL("./node_modules/three/package.json", import.meta.url), "utf8"),
).version.split(".")[1];

// Brand files supplied by the Duolingo team (CLAUDE.md rule 8), e.g. "logos/logo.svg". brand.ts only
// switches an official item on when its file is here; sync-assets copies them to /brand/.
const brandDir = fileURLToPath(new URL("../assets/brand", import.meta.url));
const brandFiles = ["fonts", "logos", "mascots", "models"].flatMap((d) =>
  existsSync(`${brandDir}/${d}`)
    ? readdirSync(`${brandDir}/${d}`)
        .filter((f) => !f.startsWith("."))
        .map((f) => `${d}/${f}`)
    : [],
);

/** Writes the active brand into index.html (title, favicon, theme colour, CSS variables) so the very
 *  first paint is on-brand — no flash before the JS bundle loads. Same source: src/config/brand.ts. */
async function brandHtml(preconnect: string[]): Promise<Plugin> {
  (globalThis as { __BRAND_FILES__?: string[] }).__BRAND_FILES__ = brandFiles;
  const { BRAND } = await import("./src/config/brand");
  const { brandCss, themeBootScript, themeColorMetas } = await import("./src/config/applyBrand");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return {
    name: "brand-html",
    transformIndexHtml: {
      order: "post",
      // DECISION (Day 8): no prefetch of the Scan chunk — measured on Fast 3G it competed with Home's
      // own data calls and didn't make Scan open faster (opening it is CPU-bound on a slow phone).
      handler: (html) =>
        html
          .replace(
            "<!-- brand -->",
            [
              `<title>${esc(BRAND.appName)}</title>`,
              `<link rel="icon" href="${esc(BRAND.logo.mark)}" />`,
              ...themeColorMetas(BRAND).map((m) => `<meta name="theme-color" media="${m.media}" content="${esc(m.content)}" />`),
              `<style id="brand-vars">${brandCss(BRAND)}</style>`,
              // Saved Light/Dark choice (Me → Appearance) applied before the first paint.
              `<script>${themeBootScript(BRAND)}</script>`,
              // DECISION (UI redesign): no preload for the display font — measured on Fast 3G it delayed the
              // first paint; it loads with font-display: swap (system rounded font until then).
              // TLS to Firebase starts while the JS downloads (several round trips saved on 3G).
              ...preconnect.map((h) => `<link rel="preconnect" href="${h}" crossorigin />`),
            ].join("\n    "),
          )
          // The app stylesheet doesn't block the first paint: the splash below is styled inline. main.tsx
          // waits for it before React renders, so the app itself never shows unstyled.
          .replace(
            /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/,
            `<link rel="stylesheet" crossorigin href="$1" media="print" onload="this.media='all'" data-app-css>` +
              `<noscript><link rel="stylesheet" href="$1"></noscript>`,
          )
          .replace(
            '<div id="root"></div>',
            // Painted straight from the HTML (before any JS); React replaces it when it mounts.
            `<div id="root"><div class="boot" style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--bg);color:var(--text);font-family:var(--font-family)"><img src="${esc(BRAND.logo.full)}" alt="" width="72" height="72" /><strong style="font-size:1.8rem;font-family:var(--font-display);font-weight:800">${esc(BRAND.appName)}</strong><span style="color:var(--muted)">${esc(BRAND.campaignName)}</span></div></div>`,
          ),
    },
  };
}

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Production only (the emulators are plain http on localhost).
  const preconnect =
    mode === "production" && env.VITE_USE_EMULATORS !== "true" && env.VITE_FIREBASE_PROJECT_ID
      ? [
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://firestore.googleapis.com",
          `https://asia-south1-${env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`,
        ]
      : [];
  return {
    plugins: [react(), await brandHtml(preconnect)],
    define: {
      __BRAND_FILES__: JSON.stringify(brandFiles),
      __TARGETS_VERSION__: JSON.stringify(targetsVersion),
      __MODEL_VERSIONS__: JSON.stringify(modelVersions),
      __THREE_REV__: JSON.stringify(threeRev),
    },
    resolve: {
      alias: {
        "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
      },
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
  };
});
