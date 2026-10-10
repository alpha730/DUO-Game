// Runs every flow in e2e/flows/ in Chromium and WebKit (or --browser=…, or named flows), one at a
// time — they share the emulators' state (fake clock, config). Prints PASS/FAIL per check + a summary.
//   node run.mjs                         all flows, both browsers
//   node run.mjs --browser=webkit 03     flows whose file name contains "03", WebKit only
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const browserArg = args.find((a) => a.startsWith("--browser="))?.split("=")[1];
const browsers = browserArg ? [browserArg] : ["chromium", "webkit"];
const filters = args.filter((a) => !a.startsWith("--"));
const dir = new URL("./flows/", import.meta.url);
const flows = readdirSync(dir)
  .filter((f) => f.endsWith(".mjs") && (filters.length === 0 || filters.some((x) => f.includes(x))))
  .sort();

mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
const rows = [];
for (const browser of browsers) {
  for (const flow of flows) {
    const started = Date.now();
    const r = spawnSync(process.execPath, [fileURLToPath(new URL(flow, dir))], {
      env: { ...process.env, E2E_BROWSER: browser },
      encoding: "utf8",
      timeout: 15 * 60_000,
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    writeFileSync(new URL(`./out/${browser}-${flow.replace(".mjs", ".log")}`, import.meta.url), out);
    const pass = (out.match(/^PASS/gm) ?? []).length;
    const fail = (out.match(/^FAIL/gm) ?? []).length;
    const crashed = r.status !== 0 && fail === 0;
    rows.push({ browser, flow, pass, fail: fail + (crashed ? 1 : 0), secs: Math.round((Date.now() - started) / 1000) });
    console.log(`${fail || crashed ? "✗" : "✓"} ${browser.padEnd(8)} ${flow.padEnd(28)} pass ${pass}  fail ${fail}${crashed ? "  CRASHED (see out/ log)" : ""}  ${rows.at(-1).secs}s`);
    for (const line of out.split("\n").filter((l) => l.startsWith("FAIL"))) console.log(`    ${line}`);
    if (crashed) console.log(out.split("\n").slice(-12).map((l) => `    ${l}`).join("\n"));
  }
}
const total = rows.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail }), { pass: 0, fail: 0 });
console.log(`\n${total.fail ? "FAILED" : "ALL PASSED"}: ${total.pass} checks passed, ${total.fail} failed (${rows.length} runs)`);
process.exit(total.fail ? 1 : 0);
