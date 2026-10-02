export type FavoritesError = "bad-input" | "not-caught" | "no-changes";

export interface FavoritesPlan {
  favorites: string[];
  favoriteChangesLeft: number;
  /** Lingos whose favStreak must go back to 0 (the replaced and the new favourite). */
  resetStreak: string[];
  /** false when the request equals the current pair (nothing to write). */
  changed: boolean;
}

/**
 * setFavorites rules (SPEC §2, §5): exactly `count` different Lingos, all already caught. The first
 * pick is free; after that only `favoriteChangesLeft` changes, and a change resets the streak of the
 * replaced and the new favourite. Pure.
 */
export function planFavorites(input: {
  current: string[];
  changesLeft: number;
  requested: unknown;
  caught: Set<string>;
  count: number;
}): FavoritesPlan | { error: FavoritesError } {
  const { current, changesLeft, requested, caught, count } = input;
  if (
    !Array.isArray(requested) ||
    requested.length !== count ||
    requested.some((id) => typeof id !== "string") ||
    new Set(requested).size !== count
  ) {
    return { error: "bad-input" };
  }
  const ids = requested as string[];
  if (ids.some((id) => !caught.has(id))) return { error: "not-caught" };

  if (current.length === 0) {
    // First pick: free. They were non-favourites, so their streaks are already 0 — reset anyway.
    return { favorites: ids, favoriteChangesLeft: changesLeft, resetStreak: [...ids], changed: true };
  }
  const same = ids.length === current.length && ids.every((id) => current.includes(id));
  if (same) return { favorites: current, favoriteChangesLeft: changesLeft, resetStreak: [], changed: false };
  if (changesLeft <= 0) return { error: "no-changes" };

  const replaced = current.filter((id) => !ids.includes(id));
  const added = ids.filter((id) => !current.includes(id));
  return { favorites: ids, favoriteChangesLeft: changesLeft - 1, resetStreak: [...replaced, ...added], changed: true };
}
