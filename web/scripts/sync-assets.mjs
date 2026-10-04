// Copies the repo-level /assets (targets.mind + Lingo models) into web/public/assets so Vite serves
// them at /assets/... in dev and ships them in the build. Drop new files into /assets and rerun
// `npm run dev` / `npm run build` — no code changes needed.
// Cost rules (CLAUDE.md): models must be ≤ 500 KB (Draco) — the build fails otherwise.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_MODEL_BYTES = 500 * 1024;
const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../assets");
const dest = resolve(here, "../public/assets");
const threeDir = resolve(here, "../node_modules/three");
const threeRev = JSON.parse(readFileSync(join(threeDir, "package.json"), "utf8")).version.split(".")[1]; // e.g. "151"

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, "models"), { recursive: true });

const copied = [];
const tooBig = [];
if (existsSync(join(src, "targets.mind"))) {
  cpSync(join(src, "targets.mind"), join(dest, "targets.mind"));
  // Day 8: Hosting doesn't compress .mind files (7.3 MB raw → ~3.8 MB gzipped); the app downloads
  // this .gz and unpacks it in the browser (DecompressionStream), falling back to the raw file.
  writeFileSync(join(dest, "targets.mind.gz"), gzipSync(readFileSync(join(src, "targets.mind")), { level: 9 }));
  copied.push("targets.mind (+ .gz)");
} else {
  console.warn("! assets/targets.mind missing — the Scan screen will show an error");
}
for (const f of existsSync(join(src, "models")) ? readdirSync(join(src, "models")) : []) {
  if (!f.endsWith(".glb")) continue;
  const size = statSync(join(src, "models", f)).size;
  if (size > MAX_MODEL_BYTES) tooBig.push(`${f} is ${(size / 1024).toFixed(0)} KB`);
  cpSync(join(src, "models", f), join(dest, "models", f));
  copied.push(`models/${f}`);
}

// Draco decoder for compressed models, in a three-revision folder so the 30-day cache is safe.
const draco = join(threeDir, "examples/jsm/libs/draco/gltf");
mkdirSync(join(dest, "draco", `r${threeRev}`), { recursive: true });
for (const f of ["draco_decoder.wasm", "draco_wasm_wrapper.js", "draco_decoder.js"]) {
  cpSync(join(draco, f), join(dest, "draco", `r${threeRev}`, f));
}
copied.push(`draco/r${threeRev}/`);

// Brand files supplied by the Duolingo team (CLAUDE.md rule 8) → /brand/. Guidelines stay private.
const brandSrc = join(src, "brand");
const brandDest = resolve(here, "../public/brand");
rmSync(brandDest, { recursive: true, force: true });
const brandCopied = [];
for (const d of ["fonts", "logos", "mascots", "models"]) {
  const dir = join(brandSrc, d);
  for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => !x.startsWith(".")) : []) {
    mkdirSync(join(brandDest, d), { recursive: true });
    cpSync(join(dir, f), join(brandDest, d, f));
    brandCopied.push(`${d}/${f}`);
  }
}
copied.push(brandCopied.length ? `brand: ${brandCopied.join(", ")}` : "brand: (no files supplied yet)");

console.log(`assets synced: ${copied.join(", ")}`);
if (tooBig.length) {
  console.error(`✖ Models over 500 KB (Draco-compress them, see CLAUDE.md): ${tooBig.join("; ")}`);
  process.exit(1);
}
