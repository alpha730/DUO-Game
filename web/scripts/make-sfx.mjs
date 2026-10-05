// Generates the game's sound effects (web/public/sfx/*.mp3) from plain synthesized tones — original,
// no samples. Needs ffmpeg on PATH. Run once after changing a sound: `node scripts/make-sfx.mjs`.
// Each file must stay under 15 KB (checked below).
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "../public/sfx");
mkdirSync(out, { recursive: true });

// A note: sine + a little 2nd harmonic, quick attack, exponential decay. f(t) and envelope in ffmpeg's
// expression language. `notes` = [[startSec, hz, decay], …].
const voice = (notes, vol = 0.35) =>
  notes
    .map(
      ([s, hz, k]) =>
        `gte(t,${s})*${vol}*(sin(2*PI*${hz}*(t-${s}))+0.25*sin(4*PI*${hz}*(t-${s})))*exp(-${k}*(t-${s}))*min(1,(t-${s})*200)`,
    )
    .join("+");

const SOUNDS = {
  // Poster found: two quick rising blips.
  found: { d: 0.3, expr: voice([[0, 880, 18], [0.09, 1320, 14]]) },
  // Correct answer: bright major arpeggio.
  correct: { d: 0.5, expr: voice([[0, 1047, 12], [0.08, 1319, 12], [0.16, 1568, 8]]) },
  // Wrong / failed: two soft falling tones.
  wrong: { d: 0.45, expr: voice([[0, 392, 9], [0.15, 262, 7]], 0.4) },
  // Level up / MAX / all 10: rising four-note fanfare.
  levelup: { d: 0.9, expr: voice([[0, 523, 6], [0.1, 659, 6], [0.2, 784, 6], [0.3, 1047, 3.5]], 0.3) },
  // Timer tick (last 5 s): a short woodblock-like click.
  tick: { d: 0.06, expr: voice([[0, 1800, 90]], 0.5) },
};

for (const [name, { d, expr }] of Object.entries(SOUNDS)) {
  const file = join(out, `${name}.mp3`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `aevalsrc='${expr}':d=${d}:s=22050`, "-ac", "1", "-b:a", "48k", file]);
  const kb = statSync(file).size / 1024;
  if (kb >= 15) throw new Error(`${name}.mp3 is ${kb.toFixed(1)} KB (limit 15 KB)`);
  console.log(`sfx/${name}.mp3  ${kb.toFixed(1)} KB`);
}
