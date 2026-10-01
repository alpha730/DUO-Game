// Copies /shared/*.ts into functions/src/shared so functions build from the single source of truth.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = resolve(here, "../../shared");
const to = resolve(here, "../src/shared");

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`copied shared/ -> functions/src/shared`);
