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
 * "Puedes gastar hoy" paces the money you've actually earned this period
 * (not the fixed category-budget target) evenly over the days since you
 * started tracking. Whatever isn't spent on a given day carries over in
 * full to the next day, and the next, compounding for as long as it goes
 * unspent — so it stays in sync with "Restante del mes" (income minus
 * expenses) instead of a smaller, separate category-budget ceiling.
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
  for (const tx of txResult.rows) {
    const amount = Number(tx.amount);
    if (tx.type === "INCOME") {
      incomeSoFar += amount;
    } else {
      spentByDay.set(tx.date, (spentByDay.get(tx.date) ?? 0) + amount);
    }
  }

  let spentSoFar = 0;
  for (const spent of spentByDay.values()) spentSoFar += spent;

  // The carry chain starts on the first day the user actually logged
  // something this period, not on the period's calendar start. Otherwise a
  // user who only starts tracking (or only sets category budgets) well
  // into the period would be credited a full daily share for every prior
  // day as if it had gone unspent, producing a huge one-day windfall.
  const earliestActivity =
    txResult.rows.length > 0 ? txResult.rows.map((t) => t.date).sort()[0] : null;

  let chainStart = period.start;
  if (earliestActivity) {
    const earliest = utcMidnight(earliestActivity);
    if (earliest.getTime() > chainStart.getTime()) chainStart = earliest;
  } else {
    chainStart = clampedToday;
  }

  // The daily rate is the income earned so far spread over the days
  // actually left to distribute it across (from when tracking started
  // through the end of the period), not the period's total length.
  // Otherwise the skipped pre-tracking days would shrink every day's share,
  // and using the period's full length would keep counting income that
  // hasn't been earned yet as if it were already spendable today.
  const chainDays = diffUTCDays(period.end, chainStart) + 1;
  const dailyBase = chainDays > 0 ? incomeSoFar / chainDays : 0;

  const numDaysElapsed = diffUTCDays(clampedToday, chainStart) + 1;
  let carry = 0;
  let spentToday = 0;
  let todayAllowance = dailyBase;
  for (let i = 0; i < numDaysElapsed; i++) {
    const day = addUTCDays(chainStart, i);
    const key = formatUTCDate(day);
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
