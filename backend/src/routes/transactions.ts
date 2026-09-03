import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { newId } from "../lib/id";
import { CategoryRow, mapTransaction, TransactionRow } from "../lib/mappers";

const router = Router();
router.use(requireAuth);

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

router.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }
  const { from, to, categoryId, type, limit } = parsed.data;

  const conditions = ["t.user_id = $1"];
  const values: unknown[] = [req.userId];
  let idx = 2;

  if (from) {
    conditions.push(`t.date >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    conditions.push(`t.date <= $${idx++}`);
    values.push(to);
  }
  if (categoryId) {
    conditions.push(`t.category_id = $${idx++}`);
    values.push(categoryId);
  }
  if (type) {
    conditions.push(`t.type = $${idx++}`);
    values.push(type);
  }

  values.push(limit);

  const result = await pool.query<TransactionRow & { category_row: CategoryRow }>(
    `SELECT t.*, row_to_json(c.*) as category_row
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT $${idx}`,
    values
  );

  res.json({
    transactions: result.rows.map((row) => mapTransaction(row, row.category_row)),
  });
});

const createSchema = z.object({
  categoryId: z.string(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().positive(),
  description: z.string().max(200).optional(),
  date: z.string(),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const category = await pool.query<CategoryRow>(
    "SELECT * FROM categories WHERE id = $1 AND user_id = $2",
    [parsed.data.categoryId, req.userId]
  );
  if (category.rows.length === 0) {
    res.status(400).json({ error: "Categoría inválida" });
    return;
  }

  const id = newId();
  const result = await pool.query<TransactionRow>(
    `INSERT INTO transactions (id, user_id, category_id, type, amount, description, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      id,
      req.userId,
      parsed.data.categoryId,
      parsed.data.type,
      parsed.data.amount,
      parsed.data.description ?? null,
      parsed.data.date,
    ]
  );

  res.status(201).json({ transaction: mapTransaction(result.rows[0], category.rows[0]) });
});

const updateSchema = createSchema.partial();

router.patch("/:id", async (req, res) => {
  const existing = await pool.query<TransactionRow>(
    "SELECT * FROM transactions WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: "Movimiento no encontrado" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  let categoryRow: CategoryRow | undefined;
  if (parsed.data.categoryId) {
    const category = await pool.query<CategoryRow>(
      "SELECT * FROM categories WHERE id = $1 AND user_id = $2",
      [parsed.data.categoryId, req.userId]
    );
    if (category.rows.length === 0) {
      res.status(400).json({ error: "Categoría inválida" });
      return;
    }
    categoryRow = category.rows[0];
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.categoryId !== undefined) {
    fields.push(`category_id = $${idx++}`);
    values.push(parsed.data.categoryId);
  }
  if (parsed.data.type !== undefined) {
    fields.push(`type = $${idx++}`);
    values.push(parsed.data.type);
  }
  if (parsed.data.amount !== undefined) {
    fields.push(`amount = $${idx++}`);
    values.push(parsed.data.amount);
  }
  if (parsed.data.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(parsed.data.description);
  }
  if (parsed.data.date !== undefined) {
    fields.push(`date = $${idx++}`);
    values.push(parsed.data.date);
  }

  let updated: TransactionRow;
  if (fields.length === 0) {
    updated = existing.rows[0];
  } else {
    values.push(req.params.id);
    const result = await pool.query<TransactionRow>(
      `UPDATE transactions SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    updated = result.rows[0];
  }

  if (!categoryRow) {
    const category = await pool.query<CategoryRow>("SELECT * FROM categories WHERE id = $1", [
      updated.category_id,
    ]);
    categoryRow = category.rows[0];
  }

  res.json({ transaction: mapTransaction(updated, categoryRow) });
});

router.delete("/:id", async (req, res) => {
  const existing = await pool.query(
    "SELECT id FROM transactions WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: "Movimiento no encontrado" });
    return;
  }
  await pool.query("DELETE FROM transactions WHERE id = $1", [req.params.id]);
  res.status(204).send();
});

export default router;
