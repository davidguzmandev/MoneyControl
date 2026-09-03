import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { newId } from "../lib/id";
import { CategoryRow, mapCategory } from "../lib/mappers";

const router = Router();
router.use(requireAuth);

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

  const result = await pool.query<CategoryRow>(
    `INSERT INTO categories (id, user_id, name, color, type) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [newId(), req.userId, parsed.data.name, parsed.data.color, parsed.data.type]
  );
  res.status(201).json({ category: mapCategory(result.rows[0]) });
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
