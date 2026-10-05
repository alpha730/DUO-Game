import type { CatchDoc, CatchView, GameRules, UserDoc, UserView } from "../shared/types";

const millis = (t: { toMillis(): number } | null | undefined) => (t ? t.toMillis() : null);

/** Daily attempts used today (attemptsToday only counts for attemptsDate). */
export function attemptsUsedToday(user: Pick<UserDoc, "attemptsToday" | "attemptsDate">, today: string): number {
  return user.attemptsDate === today ? user.attemptsToday : 0;
}

/** Lingos already tried on `today` (one try per Lingo per day); [] when triedDate ≠ today. */
export function triedToday(user: Pick<UserDoc, "triedToday" | "triedDate">, today: string): string[] {
  return user.triedDate === today ? (user.triedToday ?? []) : [];
}

export function attemptsLeft(
  user: Pick<UserDoc, "attemptsToday" | "attemptsDate">,
  today: string,
  rules: Pick<GameRules, "attemptsPerDay">,
): number {
  return Math.max(0, rules.attemptsPerDay - attemptsUsedToday(user, today));
}

export function userView(user: UserDoc, today: string): UserView {
  return {
    ...user,
    attemptsToday: attemptsUsedToday(user, today),
    triedToday: triedToday(user, today),
    triedDate: today,
    createdAt: millis(user.createdAt) ?? 0,
    pointsReachedAt: millis(user.pointsReachedAt),
  };
}

export function catchView(lingoId: string, c: CatchDoc): CatchView {
  return { ...c, lingoId, firstCaughtAt: millis(c.firstCaughtAt) };
}
