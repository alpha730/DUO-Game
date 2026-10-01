import type { CatchDoc, CatchView, GameRules, UserDoc, UserView } from "../shared/types";

const millis = (t: { toMillis(): number } | null | undefined) => (t ? t.toMillis() : null);

/** Daily attempts used today (attemptsToday only counts for attemptsDate). */
export function attemptsUsedToday(user: Pick<UserDoc, "attemptsToday" | "attemptsDate">, today: string): number {
  return user.attemptsDate === today ? user.attemptsToday : 0;
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
    createdAt: millis(user.createdAt) ?? 0,
  };
}

export function catchView(lingoId: string, c: CatchDoc): CatchView {
  return { ...c, lingoId, firstCaughtAt: millis(c.firstCaughtAt) };
}
