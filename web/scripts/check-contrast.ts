// Checks text contrast (WCAG ≥ 4.5:1) for every text/background pair theme.css uses, in both themes.
//   npx tsx scripts/check-contrast.ts      (exit code 1 if any pair fails)
import { BRAND, type BrandColors } from "../src/config/brand";

type Rgba = [number, number, number, number];
function parse(c: string): Rgba {
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((x) => x + x).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as Rgba;
  }
  const m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/);
  if (!m) throw new Error(`can't parse colour ${c}`);
  return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
}
/** `top` painted over the (opaque) colours below it, last = bottom. */
function flatten(...layers: string[]): [number, number, number] {
  let out = parse(layers[layers.length - 1]).slice(0, 3) as [number, number, number];
  for (const l of layers.slice(0, -1).reverse()) {
    const [r, g, b, a] = parse(l);
    out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
  }
  return out;
}
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [text token, ...background layers (top first)]. The camera behind glass is worst-cased as white.
const PAIRS: Array<[keyof BrandColors, ...(keyof BrandColors | string)[]]> = [
  ["text", "bg"], ["text", "surface"], ["text", "surface2"], ["text", "navBg"],
  ["text", "primarySoft", "surface"], ["text", "streakBg", "surface"], ["text", "favoriteBg", "surface"],
  ["muted", "bg"], ["muted", "surface"], ["muted", "surface2"], ["muted", "navBg"],
  ["onPrimary", "primary"], ["onAccent", "accent"], ["onDanger", "danger"],
  ["primaryText", "bg"], ["primaryText", "surface"], ["primaryText", "surface2"],
  ["link", "bg"], ["link", "surface"],
  ["warnText", "bg"], ["warnText", "surface"], ["warnText", "streakBg", "surface"], ["warnText", "favoriteBg", "surface"],
  ["dangerText", "surface"], ["dangerText", "dangerSoft", "surface"], ["dangerText", "missedBg", "surface2"], ["dangerText", "missedBg", "surface"],
  ["onGold", "gold"], ["onGold", "goldEnd"], ["onGold", "silver"], ["onGold", "bronze"],
  ["onLevel", "levelOne"], ["onLevel", "levelTwo"], ["onLevel", "levelThree"],
  ["onAllTen", "allTenFrom"], ["onAllTen", "allTenTo"],
  ["onGlass", "cardGlass", "#ffffff"], ["glassMuted", "cardGlass", "#ffffff"],
  ["onGlass", "errorGlass", "#ffffff"], ["onGlass", "overlay", "#ffffff"],
  ["muted", "slotEmpty"],
];

let failed = 0;
for (const [name, c] of Object.entries(BRAND.themes) as Array<[string, BrandColors]>) {
  const rows: string[] = [];
  for (const [fg, ...bg] of PAIRS) {
    const layers = bg.map((k) => (k.startsWith("#") ? k : (c[k as keyof BrandColors] as string)));
    const r = ratio(flatten(c[fg] as string), flatten(...layers));
    const okay = r >= 4.5;
    if (!okay) failed++;
    rows.push(`${okay ? "  ok" : "FAIL"} ${r.toFixed(2).padStart(5)}  ${fg} on ${bg.join(" over ")}`);
  }
  console.log(`\n${name}\n${rows.join("\n")}`);
}
console.log(failed ? `\n${failed} pair(s) below 4.5:1` : "\nAll pairs ≥ 4.5:1");
process.exit(failed ? 1 : 0);
