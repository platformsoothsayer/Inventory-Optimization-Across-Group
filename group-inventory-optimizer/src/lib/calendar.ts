import type { World } from "./types";

const DAY_MS = 86400000;

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso: string, days: number): string {
  const d = new Date(parseDate(iso).getTime() + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** Calendar month (0 = January) of a 0-based history month index. */
export function calMonthOfIndex(world: Pick<World, "historyStart">, idx: number): number {
  return (world.historyStart.month + idx) % 12;
}

/** Year of a 0-based history month index. */
export function yearOfIndex(world: Pick<World, "historyStart">, idx: number): number {
  return world.historyStart.year + Math.floor((world.historyStart.month + idx) / 12);
}

/** Calendar month (0 = January) for each of the next `n` days from `today` (day 0 = today). */
export function forwardDayMonths(today: string, n: number): number[] {
  const start = parseDate(today).getTime();
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(new Date(start + i * DAY_MS).getUTCMonth());
  return out;
}

export const DAYS_PER_MONTH = 30.4375;
