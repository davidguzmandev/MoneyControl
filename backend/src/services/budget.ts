import { pool } from "../db";
import { daysInPeriod, getPeriodForDate } from "../lib/period";
import { diffUTCDays, formatUTCDate, utcMidnight } from "../lib/utcDate";

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
 * The spendable budget for a period is the income logged in it minus
 * whatever the user wants to set aside as savings — there's no
 * separately configured budget number. Today's allowance is whatever is
 * left of that (after everything spent before today) spread evenly over
 * the days remaining in the period, so it re-paces itself every day
 * instead of letting unspent days pile up into one lump sum.
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

  const txResult = await pool.query<{ amount: string; date: string; type: "INCOME" | "EXPENSE" }>(
    `SELECT amount, date, type FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, formatUTCDate(period.start), todayKey]
  );

  let incomeSoFar = 0;
  let spentSoFar = 0;
  let spentToday = 0;
  for (const tx of txResult.rows) {
    const amount = Number(tx.amount);
    if (tx.type === "INCOME") {
      incomeSoFar += amount;
    } else {
      spentSoFar += amount;
      if (tx.date === todayKey) spentToday += amount;
    }
  }

  const monthlyBudget = incomeSoFar;
  const spendableBudget = monthlyBudget - savingsGoal;
  const dailyBase = totalDays > 0 ? spendableBudget / totalDays : 0;

  const spentBeforeToday = spentSoFar - spentToday;
  const remainingBeforeToday = spendableBudget - spentBeforeToday;
  const daysRemaining = diffUTCDays(period.end, clampedToday) + 1;
  const todayAllowance = daysRemaining > 0 ? remainingBeforeToday / daysRemaining : 0;

  return {
    periodStart: formatUTCDate(period.start),
    periodEnd: formatUTCDate(period.end),
    totalDays,
    monthlyBudget,
    savingsGoal,
    dailyBase,
    spentSoFar,
    incomeSoFar,
    remainingMonthly: spendableBudget - spentSoFar,
    todayAllowance,
    spentToday,
    remainingToday: todayAllowance - spentToday,
  };
}
