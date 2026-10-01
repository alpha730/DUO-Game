// Copies the repo-level /assets (targets.mind + Lingo models) into web/public/assets so Vite serves
// them at /assets/... in dev and ships them in the build. Drop a new assets/targets.mind in and
// rerun `npm run dev` / `npm run build` — no code changes needed.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../assets");
const dest = resolve(here, "../public/assets");

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, "models"), { recursive: true });

const copied = [];
if (existsSync(join(src, "targets.mind"))) {
  cpSync(join(src, "targets.mind"), join(dest, "targets.mind"));
  copied.push("targets.mind");
} else {
  console.warn("! assets/targets.mind missing — the Scan screen will show an error");
}
for (const f of existsSync(join(src, "models")) ? readdirSync(join(src, "models")) : []) {
  if (!f.endsWith(".glb")) continue;
  const size = statSync(join(src, "models", f)).size;
  if (size > 2 * 1024 * 1024) console.warn(`! ${f} is ${(size / 1048576).toFixed(1)} MB (limit 2 MB)`);
  cpSync(join(src, "models", f), join(dest, "models", f));
  copied.push(`models/${f}`);
}
console.log(`assets synced: ${copied.length ? copied.join(", ") : "nothing"}`);
