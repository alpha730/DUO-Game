export interface MatchResult {
  score: number; // 0–1: phrase words found in transcript ÷ phrase words
  passed: boolean;
  missedWords: string[];
}

/** Lowercase, strip punctuation, collapse spaces, split into words. */
export function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      // DECISION: dashes/slashes split words ("well-known" ≈ "well known"); other punctuation,
      // including apostrophes, is dropped so "don't" and "dont" match.
      .replace(/[-–—/]/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
  );
}

const NUMBERS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];
const NUMBER_WORD = new Map(NUMBERS.map((w, i) => [w, String(i)]));

// UK/US spellings. Explicit stems where a blanket rule would merge different words ("our" ≠ "or",
// "filling" ≠ "filing"); a general rule for -ise/-isation, which only ever maps both sides alike.
const OUR = /^(colou?r|favou?r|behaviou?r|neighbou?r|honou?r|labou?r|humou?r|flavou?r|harbou?r|rumou?r|endeavou?r|armou?r|odou?r|vigou?r|savou?r|vapou?r)(.*)$/;
const DOUBLE_L = /^(travel|cancel|label|model|fuel|level|counsel|signal|marvel|dial|quarrel|channel|tunnel|panel|total|equal|jewel)l(ing|ed|er|ers)$/;
const RE_ER = /^(cent|theat|met|lit|fib|calib|somb|spect|meag|lust)re(s|d)?$/;
const SPECIAL: Record<string, string> = {
  practise: "practice", practised: "practiced", practising: "practicing", practises: "practices",
  licence: "license", licences: "licenses", defence: "defense", offence: "offense",
};

/**
 * One word in a canonical form, applied to BOTH the phrase/word and the transcript: number words
 * 0–20 → digits ("ten" == "10") and UK → US spelling (favourite → favorite, organise → organize,
 * organisation → organization, analyse → analyze, travelling → traveling, centre → center,
 * practise → practice).
 */
export function normWord(w: string): string {
  const n = NUMBER_WORD.get(w);
  if (n) return n;
  if (SPECIAL[w]) return SPECIAL[w];
  let m = OUR.exec(w);
  if (m) return m[1].replace(/ou?r$/, "or") + m[2];
  m = DOUBLE_L.exec(w);
  if (m) return m[1] + m[2];
  m = RE_ER.exec(w);
  if (m) return `${m[1]}er${m[2] ?? ""}`;
  return w
    .replace(/(\w{2,})is(e|es|ed|ing|er|ers|ation|ations)$/, "$1iz$2")
    .replace(/(\w{2,})ys(e|es|ed|ing)$/, "$1yz$2");
}

/**
 * Pronounce match (SPEC §2, §9): pass if the transcript contains the word or one of its `accept`
 * spellings as whole words, or (single words) a near miss — see nearMiss(). Multi-word spellings ("all right") must
 * appear as consecutive words. Normalised like `words()` + `normWord()`.
 */
export function matchWord(word: string, transcript: string, accept: string[] = []): { passed: boolean } {
  const heardWords = words(transcript).map(normWord);
  const heard = ` ${heardWords.join(" ")} `;
  const targets = [word, ...accept].map((t) => words(t).map(normWord).join(" ")).filter(Boolean);
  if (targets.some((t) => heard.includes(` ${t} `))) return { passed: true };
  // SPEC §9: speech recognition misspells rare words ("perspicacious" → "perspicacius"). A single-word
  // target also passes when a heard word is within a small edit distance of it.
  return { passed: targets.some((t) => !t.includes(" ") && heardWords.some((h) => nearMiss(t, h))) };
}

/** Allowed typos for a word: none under 6 letters, 1 for 6–9, 2 for 10+. */
export const allowedEdits = (len: number) => (len >= 10 ? 2 : len >= 6 ? 1 : 0);

/** `heard` is within allowedEdits(target) of `target` (Levenshtein; early exit). */
export function nearMiss(target: string, heard: string): boolean {
  const max = allowedEdits(target.length);
  if (max === 0 || Math.abs(target.length - heard.length) > max) return false;
  return editDistance(target, heard, max) <= max;
}

/** Levenshtein distance, stopping early once every path exceeds `cap` (returns cap + 1). */
export function editDistance(a: string, b: string, cap = Infinity): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Speech match (SPEC §5): each phrase word counts if it appears anywhere in the transcript.
 * Extra words and word order don't matter. Both sides go through `normWord()`, so "ten"/"10" and
 * UK/US spellings match; missed words are reported as written in the phrase.
 */
export function matchPhrase(phrase: string, transcript: string, passRatio = 0.8): MatchResult {
  const target = words(phrase);
  const heard = new Set(words(transcript).map(normWord));
  if (target.length === 0) return { score: 0, passed: false, missedWords: [] };

  const missedWords = target.filter((w) => !heard.has(normWord(w)));
  const score = (target.length - missedWords.length) / target.length;
  // Small epsilon so 4/5 = 0.8 passes despite float rounding.
  return { score, passed: score + 1e-9 >= passRatio, missedWords };
}
