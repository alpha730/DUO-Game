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

/**
 * Speech match (SPEC §5): each phrase word counts if it appears anywhere in the transcript.
 * Extra words and word order don't matter. Phrases should spell out numbers, since speech
 * recognition may return either "10" or "ten".
 */
export function matchPhrase(phrase: string, transcript: string, passRatio = 0.8): MatchResult {
  const target = words(phrase);
  const heard = new Set(words(transcript));
  if (target.length === 0) return { score: 0, passed: false, missedWords: [] };

  const missedWords = target.filter((w) => !heard.has(w));
  const score = (target.length - missedWords.length) / target.length;
  // Small epsilon so 4/5 = 0.8 passes despite float rounding.
  return { score, passed: score + 1e-9 >= passRatio, missedWords };
}
