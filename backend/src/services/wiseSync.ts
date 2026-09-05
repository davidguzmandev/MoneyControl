import { pool } from "../db";
import { decrypt } from "../lib/crypto";
import { newId } from "../lib/id";
import { formatUTCDate } from "../lib/utcDate";
import { getStatement, WiseStatementTransaction } from "../lib/wiseClient";

interface WiseUserRow {
  wise_api_token_encrypted: string | null;
  wise_profile_id: string | null;
  wise_balance_id: string | null;
  wise_currency: string | null;
  wise_last_synced_at: Date | null;
}

const SALARY_CATEGORY = "Salario";
const WISE_INCOME_FALLBACK_CATEGORY = "Wise Ingreso";
const WISE_EXPENSE_CATEGORY = "Wise Gasto";

async function ensureCategory(
  userId: string,
  name: string,
  type: "INCOME" | "EXPENSE",
  color: string
): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM categories WHERE user_id = $1 AND name = $2",
    [userId, name]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const id = newId();
  await pool.query(
    "INSERT INTO categories (id, user_id, name, color, type) VALUES ($1, $2, $3, $4, $5)",
    [id, userId, name, color, type]
  );
  return id;
}

/**
 * Wise income lands in the user's existing "Salario" category so it
 * behaves like any other income already flowing into the budget
 * calculations, rather than sitting in a separate "Wise" bucket. Falls
 * back to a dedicated category only if the user has renamed/deleted
 * their Salario category.
 */
async function resolveIncomeCategory(userId: string): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM categories WHERE user_id = $1 AND name = $2 AND type = 'INCOME'",
    [userId, SALARY_CATEGORY]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  return ensureCategory(userId, WISE_INCOME_FALLBACK_CATEGORY, "INCOME", "#0ea5e9");
}

export interface WiseSyncResult {
  imported: number;
}

/**
 * Pulls new Wise statement entries since the last sync and inserts them as
 * transactions. Credits land in the user's "Salario" category so they feed
 * the budget the same way any other income does; debits land in a
 * dedicated "Wise Gasto" category the user re-files from there. Safe to
 * call repeatedly: duplicates are skipped via the unique
 * (user_id, external_source, external_id) index.
 */
export async function syncWiseForUser(userId: string): Promise<WiseSyncResult> {
  const userResult = await pool.query<WiseUserRow>(
    `SELECT wise_api_token_encrypted, wise_profile_id, wise_balance_id, wise_currency, wise_last_synced_at
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user?.wise_api_token_encrypted || !user.wise_profile_id || !user.wise_balance_id) {
    return { imported: 0 };
  }

  const token = decrypt(user.wise_api_token_encrypted);
  const intervalEnd = new Date();
  const intervalStart = user.wise_last_synced_at
    ? new Date(user.wise_last_synced_at)
    : new Date(intervalEnd.getTime() - 90 * 24 * 60 * 60 * 1000);

  const statement = await getStatement(
    token,
    Number(user.wise_profile_id),
    Number(user.wise_balance_id),
    user.wise_currency ?? "USD",
    intervalStart,
    intervalEnd
  );

  console.log(
    `Wise statement for user ${userId}: ${statement.transactions.length} transaction(s).`,
    statement.transactions[0] ? JSON.stringify(statement.transactions[0]) : "(none)"
  );

  let incomeCategoryId: string | null = null;
  let expenseCategoryId: string | null = null;
  let imported = 0;

  for (const tx of statement.transactions) {
    const amount = Math.abs(Number(tx.amount?.value));
    if (!amount || amount <= 0) continue;

    const type: "INCOME" | "EXPENSE" = tx.type === "CREDIT" ? "INCOME" : "EXPENSE";
    if (type === "INCOME" && !incomeCategoryId) {
      incomeCategoryId = await resolveIncomeCategory(userId);
    }
    if (type === "EXPENSE" && !expenseCategoryId) {
      expenseCategoryId = await ensureCategory(userId, WISE_EXPENSE_CATEGORY, "EXPENSE", "#64748b");
    }
    const categoryId = type === "INCOME" ? incomeCategoryId! : expenseCategoryId!;
    const description = tx.details?.description ?? tx.details?.paymentReference ?? null;

    const result = await pool.query(
      `INSERT INTO transactions (id, user_id, category_id, type, amount, description, date, external_source, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'WISE', $8)
       ON CONFLICT (user_id, external_source, external_id) WHERE external_source IS NOT NULL DO NOTHING`,
      [
        newId(),
        userId,
        categoryId,
        type,
        amount,
        description,
        formatUTCDate(new Date(tx.date)),
        tx.referenceNumber,
      ]
    );
    imported += result.rowCount ?? 0;
  }

  await pool.query("UPDATE users SET wise_last_synced_at = $1 WHERE id = $2", [intervalEnd, userId]);

  return { imported };
}

export async function syncWiseForAllUsers(): Promise<void> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE wise_api_token_encrypted IS NOT NULL"
  );
  for (const { id } of result.rows) {
    try {
      await syncWiseForUser(id);
    } catch (err) {
      console.error(`Wise sync failed for user ${id}:`, err);
    }
  }
}
