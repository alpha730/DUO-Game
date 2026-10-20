// Each Lingo's identity across its looks, by posterIndex 0–9. The game has THREE levels: Lv 1 uses
// titles[1], Lv 2 titles[2], MAX titles[3] (titles[0] belonged to the old plain first level).
// Used by the AR standee (ar/themes.ts) for its name tag; safe to use in any UI (no three.js here).
// Titles are lowercase on purpose: they're set in Feather (DET rule: Feather headlines are lowercase).
export interface LingoLevelIdentity {
  /** One-line idea of the look, for docs / the Dex. */
  vibe: string;
  /** Title per look: (unused), Lv 1, Lv 2, MAX. */
  titles: readonly [string, string, string, string];
}

export const LINGO_LEVELS: readonly LingoLevelIdentity[] = [
  { vibe: "Rookie Duo · a seed that grows: leaves, a flower pot, then full bloom", titles: ["seedling", "sprout", "sapling", "evergreen"] },
  { vibe: "Curious Duo · a detective case: question marks, footprints, a spotlight, the magnifier", titles: ["snoop", "sleuth", "detective", "mastermind"] },
  { vibe: "Winking Duo · a little star: twinkles, a stage, a rainbow, shooting stars", titles: ["twinkle", "sparkler", "star", "superstar"] },
  { vibe: "Thumbs-Up Duo · the hype owl: plus signs, ticks, a speech bubble that cheers you on", titles: ["buddy", "cheerleader", "hype owl", "legend"] },
  { vibe: "Fierce Duo · fire: embers, a lava rock, a ring of flames, a fire tornado", titles: ["spark", "blaze", "inferno", "phoenix"] },
  { vibe: "Lovestruck Duo · love: hearts, a cushion, a beating heart halo, heart fireworks", titles: ["crush", "sweetheart", "true love", "soulmate"] },
  { vibe: "Joyful Duo · a party: confetti, a cake, balloons, fireworks", titles: ["smiley", "party owl", "carnival", "jubilee"] },
  { vibe: "Bookworm Duo · words: floating letters, a book stack, flying pages, a ring of English words", titles: ["reader", "scholar", "wordsmith", "polyglot"] },
  { vibe: "Cool Duo · music: notes, a speaker, an equalizer, disco lights", titles: ["chill", "groovy", "rockstar", "icon"] },
  { vibe: "Champion Duo · the final: gold sparkles, a podium, caps in the air, gold confetti", titles: ["contender", "finalist", "champion", "grand champion"] },
];

/** Level → index into `titles` (null = not caught yet → Lv 1). Three levels: 1 → 1, 2 → 2, MAX → 3. */
export const levelIndex = (level: 1 | 2 | 3 | "MAX" | null): 1 | 2 | 3 => (level === "MAX" ? 3 : level === 2 || level === 3 ? 2 : 1);
