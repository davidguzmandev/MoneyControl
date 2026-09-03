import { daysInUTCMonth, diffUTCDays, utcMidnight } from "./utcDate";

export interface Period {
  start: Date;
  end: Date;
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInUTCMonth(year, month));
}

function anchorFor(year: number, month: number, cycleStartDay: number): Date {
  const day = clampDay(year, month, cycleStartDay);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Given a user's chosen cycle start day (1-28), returns the period
 * [start, end] (inclusive, both UTC midnight) that contains `reference`.
 */
export function getPeriodForDate(reference: Date, cycleStartDay: number): Period {
  const ref = utcMidnight(reference);
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  const anchorThisMonth = anchorFor(year, month, cycleStartDay);

  let start: Date;
  if (ref.getUTCDate() >= anchorThisMonth.getUTCDate()) {
    start = anchorThisMonth;
  } else {
    const prevMonthDate = new Date(Date.UTC(year, month - 1, 1));
    start = anchorFor(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth(), cycleStartDay);
  }

  const nextAnchorMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const nextStart = anchorFor(nextAnchorMonth.getUTCFullYear(), nextAnchorMonth.getUTCMonth(), cycleStartDay);
  const end = new Date(nextStart);
  end.setUTCDate(end.getUTCDate() - 1);

  return { start, end };
}

export function daysInPeriod(period: Period): number {
  return diffUTCDays(period.end, period.start) + 1;
}
