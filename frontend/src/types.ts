export type TransactionType = "INCOME" | "EXPENSE";
export type Currency = "USD" | "COP" | "MXN";

export interface User {
  id: string;
  email: string;
  name: string;
  cycleStartDay: number;
  currency: Currency;
  savingsGoal: number;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  type: TransactionType;
  monthlyBudget: number | null;
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
