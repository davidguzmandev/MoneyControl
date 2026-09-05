import { pool } from "../db";
import { getExchangeRate } from "../lib/fx";

/**
 * Switching currencies isn't just a display relabel: every amount already
 * stored (transactions, category budgets, savings goal) represents a real
 * value in the old currency, so it has to be converted into the new one to
 * keep meaning what it meant before.
 */
export async function convertUserCurrency(
  userId: string,
  fromCurrency: string,
  toCurrency: string
): Promise<void> {
  if (fromCurrency === toCurrency) return;

  const rate = await getExchangeRate(fromCurrency, toCurrency);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE transactions SET amount = amount * $1 WHERE user_id = $2", [rate, userId]);
    await client.query(
      "UPDATE categories SET monthly_budget = monthly_budget * $1 WHERE user_id = $2 AND monthly_budget IS NOT NULL",
      [rate, userId]
    );
    await client.query(
      "UPDATE users SET savings_goal = savings_goal * $1, currency = $2 WHERE id = $3",
      [rate, toCurrency, userId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
