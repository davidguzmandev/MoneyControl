export type TransactionType = "INCOME" | "EXPENSE";

export interface User {
  id: string;
  email: string;
  name: string;
  cycleStartDay: number;
  monthlyBudget: number;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  categoryId: string;
  category: Category;
  type: TransactionType;
  amount: number;
  description: string | null;
  date: string;
  createdAt: string;
}

export interface DailyBreakdownEntry {
  date: string;
  allowance: number;
  spent: number;
  leftover: number;
}

export interface BudgetSummary {
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  monthlyBudget: number;
  dailyBase: number;
  spentSoFar: number;
  remainingMonthly: number;
  todayAllowance: number;
  spentToday: number;
  remainingToday: number;
  dailyBreakdown: DailyBreakdownEntry[];
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  color: string;
  total: number;
}

export interface TimelinePoint {
  date: string;
  income: number;
  expense: number;
}
