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
 * The daily spending value comes from what the user has assigned across
 * their expense categories, split evenly over the days in the period.
 * Whatever isn't spent on a given day carries over in full to the next
 * day, and the next, compounding for as long as it goes unspent.
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
  const dailyBase = totalDays > 0 ? monthlyBudget / totalDays : 0;

  const txResult = await pool.query<{ amount: string; date: string; type: "INCOME" | "EXPENSE" }>(
    `SELECT amount, date, type FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, formatUTCDate(period.start), todayKey]
  );

  let incomeSoFar = 0;
  const spentByDay = new Map<string, number>();
  for (const tx of txResult.rows) {
    const amount = Number(tx.amount);
    if (tx.type === "INCOME") {
      incomeSoFar += amount;
    } else {
      spentByDay.set(tx.date, (spentByDay.get(tx.date) ?? 0) + amount);
    }
  }

  const numDaysElapsed = diffUTCDays(clampedToday, period.start) + 1;
  let carry = 0;
  let spentSoFar = 0;
  let spentToday = 0;
  let todayAllowance = dailyBase;
  for (let i = 0; i < numDaysElapsed; i++) {
    const day = addUTCDays(period.start, i);
    const key = formatUTCDate(day);
    const spent = spentByDay.get(key) ?? 0;
    const allowance = dailyBase + carry;
    const leftover = allowance - spent;
    spentSoFar += spent;
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
    remainingMonthly: monthlyBudget - spentSoFar,
    todayAllowance,
    spentToday,
    remainingToday: carry,
  };
}
