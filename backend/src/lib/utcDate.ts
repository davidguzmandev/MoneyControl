/**
 * All app dates represent calendar days (no time-of-day meaning), so every
 * calculation here works off UTC components. Using local-time Date methods
 * would shift day boundaries depending on the server/browser timezone.
 */

export function utcMidnight(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUTCDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function daysInUTCMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function formatUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function diffUTCDays(a: Date, b: Date): number {
  return Math.round((utcMidnight(a).getTime() - utcMidnight(b).getTime()) / 86_400_000);
}
