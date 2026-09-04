import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { newId } from "../lib/id";
import { CategoryRow, mapCategory } from "../lib/mappers";
import { getBudgetSummary } from "../services/budget";

const router = Router();
router.use(requireAuth);

/**
 * Category budgets are envelopes carved out of the income already logged
 * for the current period (minus whatever is set aside as savings), so
 * their sum can never exceed that.
 */
async function assertBudgetWithinIncome(
  userId: string,
  newBudget: number,
  excludeCategoryId?: string
): Promise<string | null> {
  const { incomeSoFar, savingsGoal } = await getBudgetSummary(userId);
  const spendable = incomeSoFar - savingsGoal;

  const existingSumResult = await pool.query<{ total: string | null }>(
    `SELECT SUM(monthly_budget) as total FROM categories
     WHERE user_id = $1 AND type = 'EXPENSE' AND monthly_budget IS NOT NULL
     ${excludeCategoryId ? "AND id != $2" : ""}`,
    excludeCategoryId ? [userId, excludeCategoryId] : [userId]
  );
  const existingSum = Number(existingSumResult.rows[0]?.total ?? 0);

  if (existingSum + newBudget > spendable) {
    return `Los presupuestos de categorías (${(existingSum + newBudget).toFixed(2)}) no pueden superar tu ingreso disponible después del ahorro (${spendable.toFixed(2)})`;
  }
  return null;
}

router.get("/", async (req, res) => {
  const result = await pool.query<CategoryRow>(
    "SELECT * FROM categories WHERE user_id = $1 ORDER BY name ASC",
    [req.userId]
  );
  res.json({ categories: result.rows.map(mapCategory) });
});

const createSchema = z.object({
  name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#64748b"),
  type: z.enum(["INCOME", "EXPENSE"]),
  monthlyBudget: z.number().min(0).nullable().optional(),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const existing = await pool.query(
    "SELECT id FROM categories WHERE user_id = $1 AND name = $2",
    [req.userId, parsed.data.name]
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
    return;
  }

  if (parsed.data.type === "EXPENSE" && parsed.data.monthlyBudget) {
    const budgetError = await assertBudgetWithinIncome(req.userId!, parsed.data.monthlyBudget);
    if (budgetError) {
      res.status(400).json({ error: budgetError });
      return;
    }
  }

  const result = await pool.query<CategoryRow>(
    `INSERT INTO categories (id, user_id, name, color, type, monthly_budget) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      newId(),
      req.userId,
      parsed.data.name,
      parsed.data.color,
      parsed.data.type,
      parsed.data.monthlyBudget ?? null,
    ]
  );
  res.status(201).json({ category: mapCategory(result.rows[0]) });
});

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  monthlyBudget: z.number().min(0).nullable().optional(),
});

router.patch("/:id", async (req, res) => {
  const existing = await pool.query<CategoryRow>(
    "SELECT * FROM categories WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: "Categoría no encontrada" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  if (existing.rows[0].type === "EXPENSE" && parsed.data.monthlyBudget) {
    const budgetError = await assertBudgetWithinIncome(
      req.userId!,
      parsed.data.monthlyBudget,
      req.params.id
    );
    if (budgetError) {
      res.status(400).json({ error: budgetError });
      return;
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(parsed.data.name);
  }
  if (parsed.data.color !== undefined) {
    fields.push(`color = $${idx++}`);
    values.push(parsed.data.color);
  }
  if (parsed.data.monthlyBudget !== undefined) {
    fields.push(`monthly_budget = $${idx++}`);
    values.push(parsed.data.monthlyBudget);
  }

  if (fields.length === 0) {
    res.json({ category: mapCategory(existing.rows[0]) });
    return;
  }

  values.push(req.params.id);
  const result = await pool.query<CategoryRow>(
    `UPDATE categories SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  res.json({ category: mapCategory(result.rows[0]) });
});

router.delete("/:id", async (req, res) => {
  const existing = await pool.query<CategoryRow>(
    "SELECT * FROM categories WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: "Categoría no encontrada" });
    return;
  }

  const inUse = await pool.query("SELECT 1 FROM transactions WHERE category_id = $1 LIMIT 1", [
    req.params.id,
  ]);
  if ((inUse.rowCount ?? 0) > 0) {
    res.status(409).json({ error: "No se puede borrar una categoría con movimientos asociados" });
    return;
  }

  await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
  res.status(204).send();
});

export default router;
