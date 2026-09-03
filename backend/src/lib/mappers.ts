export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  cycle_start_day: number;
  monthly_budget: string;
  created_at: Date;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  type: "INCOME" | "EXPENSE";
  created_at: Date;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  category_id: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  description: string | null;
  date: string;
  created_at: Date;
}

export function publicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    cycleStartDay: row.cycle_start_day,
    monthlyBudget: Number(row.monthly_budget),
  };
}

export function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    type: row.type,
    createdAt: row.created_at,
  };
}

export function mapTransaction(row: TransactionRow, category: CategoryRow) {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    category: mapCategory(category),
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
  };
}
