import { pool } from "../db";
import { daysInPeriod, getPeriodForDate } from "../lib/period";
import { addUTCDays, diffUTCDays, formatUTCDate, utcMidnight } from "../lib/utcDate";

export interface BudgetSummary {
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  monthlyBudget: number;
  savingsGoal: number;
  dailyBase: number;
  spentSoFar: number;
  incomeSoFar: number;
  remainingMonthly: number;
  todayAllowance: number;
  spentToday: number;
  remainingToday: number;
}

interface UserBudgetRow {
  cycle_start_day: number;
  savings_goal: string;
}

/**
 * "Puedes gastar hoy" paces your income over the days left in the period.
 * The daily rate is a fixed number that only gets recalculated when new
 * income arrives — at that point, whatever you're currently carrying plus
 * the new income is re-split evenly over the days remaining from that day
 * through the end of the period. Between income events the rate stays
 * constant, and every day's unspent (or overspent) amount carries over in
 * full to the next day.
 */
export async function getBudgetSummary(
  userId: string,
  referenceDate: Date = new Date()
): Promise<BudgetSummary> {
  const userResult = await pool.query<UserBudgetRow>(
    "SELECT cycle_start_day, savings_goal FROM users WHERE id = $1",
    [userId]
  );
  const user = userResult.rows[0];
  const savingsGoal = Number(user.savings_goal);
  const period = getPeriodForDate(referenceDate, user.cycle_start_day);
  const totalDays = daysInPeriod(period);

  const today = utcMidnight(referenceDate);
  const clampedToday = today.getTime() > period.end.getTime() ? period.end : today;
  const todayKey = formatUTCDate(clampedToday);

  const categoryBudgetResult = await pool.query<{ total: string | null }>(
    `SELECT SUM(monthly_budget) as total FROM categories
     WHERE user_id = $1 AND type = 'EXPENSE' AND monthly_budget IS NOT NULL`,
    [userId]
  );
  const monthlyBudget = Number(categoryBudgetResult.rows[0]?.total ?? 0);

  const txResult = await pool.query<{ amount: string; date: string; type: "INCOME" | "EXPENSE" }>(
    `SELECT amount, date, type FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, formatUTCDate(period.start), todayKey]
  );

  let incomeSoFar = 0;
  const spentByDay = new Map<string, number>();
  const incomeByDay = new Map<string, number>();
  for (const tx of txResult.rows) {
    const amount = Number(tx.amount);
    if (tx.type === "INCOME") {
      incomeSoFar += amount;
      incomeByDay.set(tx.date, (incomeByDay.get(tx.date) ?? 0) + amount);
    } else {
      spentByDay.set(tx.date, (spentByDay.get(tx.date) ?? 0) + amount);
    }
  }

  let spentSoFar = 0;
  for (const spent of spentByDay.values()) spentSoFar += spent;

  const numDaysElapsed = diffUTCDays(clampedToday, period.start) + 1;
  let dailyBase = 0;
  let carry = 0;
  let spentToday = 0;
  let todayAllowance = 0;
  for (let i = 0; i < numDaysElapsed; i++) {
    const day = addUTCDays(period.start, i);
    const key = formatUTCDate(day);

    const incomeToday = incomeByDay.get(key) ?? 0;
    if (incomeToday > 0) {
      const daysRemainingFromHere = diffUTCDays(period.end, day) + 1;
      const pot = carry + incomeToday;
      dailyBase = daysRemainingFromHere > 0 ? pot / daysRemainingFromHere : 0;
      carry = 0;
    }

    const spent = spentByDay.get(key) ?? 0;
    const allowance = dailyBase + carry;
    const leftover = allowance - spent;
    if (key === todayKey) {
      spentToday = spent;
      todayAllowance = allowance;
    }
    carry = leftover;
  }

  return {
    periodStart: formatUTCDate(period.start),
    periodEnd: formatUTCDate(period.end),
    totalDays,
    monthlyBudget,
    savingsGoal,
    dailyBase,
    spentSoFar,
    incomeSoFar,
    remainingMonthly: incomeSoFar - spentSoFar,
    todayAllowance,
    spentToday,
    remainingToday: carry,
  };
}
