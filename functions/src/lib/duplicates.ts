import { editDistance } from "./match";

// "Possible duplicate accounts" for the admin (anti-cheat F). FLAG ONLY — two students can share a
// name; an admin decides. Pure, so it's unit-tested without Firestore.

export interface DupInput {
  uid: string;
  name: string;
  email: string;
  createdAt: number | null;
}
export interface DupRow extends DupInput {
  group: number;
  reason: string;
}

/** "Ásha  VERMA" / "verma asha" → "asha verma" (accents, case, spaces, word order). */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/** "Asha.Verma+2@gmail.com" → "ashaverma" (dots, +tags and digits dropped; any domain). */
export function emailKey(email: string): string {
  return (email.split("@")[0] ?? "").toLowerCase().replace(/\+.*$/, "").replace(/[^a-z]/g, "");
}

const NEAR_MINUTES = 10;
const WINDOW = 4; // sorted-neighbourhood: compare each name with the next few in sorted order

/** Groups of possible duplicates, biggest first (max `limit` groups). */
export function findDuplicates(users: DupInput[], limit = 100): DupRow[] {
  const parent = users.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const reasons = users.map(() => new Set<string>());
  const link = (a: number, b: number, why: string) => {
    parent[find(a)] = find(b);
    reasons[a].add(why);
    reasons[b].add(why);
    const ta = users[a].createdAt;
    const tb = users[b].createdAt;
    if (ta !== null && tb !== null && Math.abs(ta - tb) <= NEAR_MINUTES * 60_000) {
      const near = `created ${Math.max(1, Math.round(Math.abs(ta - tb) / 60_000))} min apart`;
      reasons[a].add(near);
      reasons[b].add(near);
    }
  };
  const byKey = (key: (u: DupInput) => string, why: string, minLen: number) => {
    const seen = new Map<string, number>();
    users.forEach((u, i) => {
      const k = key(u);
      if (k.length < minLen) return;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else link(i, j, why);
    });
  };
  byKey((u) => nameKey(u.name), "same name", 3);
  byKey((u) => emailKey(u.email), "similar email", 4);
  // Small spelling differences ("Asha Verma" / "Aasha Verma"): neighbours in sorted order.
  const sorted = users.map((u, i) => [nameKey(u.name), i] as const).sort((a, b) => a[0].localeCompare(b[0]));
  for (let x = 0; x < sorted.length; x++) {
    const [a, i] = sorted[x];
    if (a.length < 5) continue;
    for (let y = x + 1; y < Math.min(sorted.length, x + 1 + WINDOW); y++) {
      const [b, j] = sorted[y];
      if (a === b || b.length < 5) continue;
      const max = Math.max(a.length, b.length) <= 8 ? 1 : 2;
      if (editDistance(a, b, max) <= max) link(i, j, "similar name");
    }
  }
  const groups = new Map<number, number[]>();
  users.forEach((_, i) => {
    if (reasons[i].size === 0) return;
    const g = find(i);
    groups.set(g, [...(groups.get(g) ?? []), i]);
  });
  return [...groups.values()]
    .filter((members) => members.length > 1)
    .sort((a, b) => b.length - a.length)
    .slice(0, limit)
    .flatMap((members, g) => members.map((i) => ({ ...users[i], group: g + 1, reason: [...reasons[i]].join(" · ") })));
}
