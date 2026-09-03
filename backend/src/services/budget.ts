import { pool } from "../db";
import { daysInPeriod, getPeriodForDate } from "../lib/period";
import { addUTCDays, diffUTCDays, formatUTCDate, utcMidnight } from "../lib/utcDate";

export interface DailyBreakdownEntry {
  date: string;
  allowance: number;
  spent: number;
  earned: number;
  leftover: number;
}

export interface BudgetSummary {
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  monthlyBudget: number;
  dailyBase: number;
  spentSoFar: number;
  incomeSoFar: number;
  remainingMonthly: number;
  todayAllowance: number;
  spentToday: number;
  remainingToday: number;
  dailyBreakdown: DailyBreakdownEntry[];
}

interface UserBudgetRow {
  cycle_start_day: number;
  monthly_budget: string;
}

/**
 * Computes the rolling daily spending allowance for the period containing
 * `referenceDate`. Each day's allowance is the flat daily share of the
 * monthly budget plus whatever was left over (or overspent) the day before.
 * Income logged on a given day adds directly to that day's leftover, so it
 * also rolls forward like an underspend would.
 */
export async function getBudgetSummary(
  userId: string,
  referenceDate: Date = new Date()
): Promise<BudgetSummary> {
  const userResult = await pool.query<UserBudgetRow>(
    "SELECT cycle_start_day, monthly_budget FROM users WHERE id = $1",
    [userId]
  );
  const user = userResult.rows[0];
  const monthlyBudget = Number(user.monthly_budget);
  const period = getPeriodForDate(referenceDate, user.cycle_start_day);
  const totalDays = daysInPeriod(period);
  const dailyBase = totalDays > 0 ? monthlyBudget / totalDays : 0;

  const today = utcMidnight(referenceDate);
  const clampedToday = today.getTime() > period.end.getTime() ? period.end : today;

  const txResult = await pool.query<{ amount: string; date: string; type: "INCOME" | "EXPENSE" }>(
    `SELECT amount, date, type FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, formatUTCDate(period.start), formatUTCDate(clampedToday)]
  );

  const spentByDay = new Map<string, number>();
  const earnedByDay = new Map<string, number>();
  for (const tx of txResult.rows) {
    const map = tx.type === "EXPENSE" ? spentByDay : earnedByDay;
    map.set(tx.date, (map.get(tx.date) ?? 0) + Number(tx.amount));
  }

  const numDaysElapsed = diffUTCDays(clampedToday, period.start) + 1;
  const dailyBreakdown: DailyBreakdownEntry[] = [];
  let carry = 0;
  for (let i = 0; i < numDaysElapsed; i++) {
    const day = addUTCDays(period.start, i);
    const key = formatUTCDate(day);
    const spent = spentByDay.get(key) ?? 0;
    const earned = earnedByDay.get(key) ?? 0;
    const allowance = dailyBase + carry;
    const leftover = allowance - spent + earned;
    dailyBreakdown.push({ date: key, allowance, spent, earned, leftover });
    carry = leftover;
  }

  const todayEntry = dailyBreakdown[dailyBreakdown.length - 1];
  const spentSoFar = dailyBreakdown.reduce((sum, d) => sum + d.spent, 0);
  const incomeSoFar = dailyBreakdown.reduce((sum, d) => sum + d.earned, 0);

  return {
    periodStart: formatUTCDate(period.start),
    periodEnd: formatUTCDate(period.end),
    totalDays,
    monthlyBudget,
    dailyBase,
    spentSoFar,
    incomeSoFar,
    remainingMonthly: monthlyBudget + incomeSoFar - spentSoFar,
    todayAllowance: todayEntry?.allowance ?? dailyBase,
    spentToday: todayEntry?.spent ?? 0,
    remainingToday: todayEntry?.leftover ?? dailyBase,
    dailyBreakdown,
  };
}
