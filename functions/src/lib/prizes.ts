import { PRIZE_COST_MAX, PRIZE_NAME_MAX, PRIZE_STOCK_MAX, type PrizeDoc } from "../shared/types";

export const PRIZE_ID = /^[\w-]{1,64}$/;

/**
 * Validates an admin's prize (add / edit). Pure. Name 1–60 characters (trimmed), cost a whole
 * number 1–1,000,000 points, stock a whole number 0–100,000; `id` optional (new prize) but valid.
 */
export function parsePrize(input: unknown): { id?: string; prize: PrizeDoc } | { error: string } {
  const d = (input ?? {}) as Record<string, unknown>;
  if (d.id !== undefined && (typeof d.id !== "string" || !PRIZE_ID.test(d.id))) return { error: "Bad prize id." };
  const name = typeof d.name === "string" ? d.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > PRIZE_NAME_MAX) return { error: `The prize needs a name (up to ${PRIZE_NAME_MAX} characters).` };
  const whole = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  if (!whole(d.cost, 1, PRIZE_COST_MAX)) return { error: `Cost must be a whole number of points, 1–${PRIZE_COST_MAX.toLocaleString("en-IN")}.` };
  if (!whole(d.stock, 0, PRIZE_STOCK_MAX)) return { error: `Stock must be a whole number, 0–${PRIZE_STOCK_MAX.toLocaleString("en-IN")}.` };
  return { ...(d.id !== undefined ? { id: d.id as string } : {}), prize: { name, cost: d.cost as number, stock: d.stock as number } };
}
