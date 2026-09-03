import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
router.use(requireAuth);

const rangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const byCategoryQuerySchema = rangeSchema.extend({
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
});

function buildRangeConditions(userId: string, from: string | undefined, to: string | undefined, alias: string) {
  const conditions = [`${alias}.user_id = $1`];
  const values: unknown[] = [userId];
  let idx = 2;
  if (from) {
    conditions.push(`${alias}.date >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`${alias}.date <= $${idx++}`);
    values.push(to);
  }
  return { where: conditions.join(" AND "), values };
}

router.get("/by-category", async (req, res) => {
  const parsed = byCategoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }
  const { from, to, type } = parsed.data;
  const { where, values } = buildRangeConditions(req.userId!, from, to, "t");
  values.push(type);

  const result = await pool.query<{ category_id: string; name: string; color: string; total: string }>(
    `SELECT c.id as category_id, c.name, c.color, SUM(t.amount) as total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.type = $${values.length} AND ${where}
     GROUP BY c.id, c.name, c.color`,
    values
  );

  res.json({
    categories: result.rows.map((r) => ({
      categoryId: r.category_id,
      name: r.name,
      color: r.color,
      total: Number(r.total),
    })),
  });
});

router.get("/timeline", async (req, res) => {
  const parsed = rangeSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }
  const { from, to } = parsed.data;
  const { where, values } = buildRangeConditions(req.userId!, from, to, "transactions");

  const result = await pool.query<{ date: string; type: "INCOME" | "EXPENSE"; total: string }>(
    `SELECT date, type, SUM(amount) as total
     FROM transactions
     WHERE ${where}
     GROUP BY date, type
     ORDER BY date ASC`,
    values
  );

  const byDay = new Map<string, { income: number; expense: number }>();
  for (const row of result.rows) {
    const entry = byDay.get(row.date) ?? { income: 0, expense: 0 };
    if (row.type === "INCOME") entry.income += Number(row.total);
    else entry.expense += Number(row.total);
    byDay.set(row.date, entry);
  }

  res.json({
    timeline: Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
  });
});

export default router;
