import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { hashPassword, verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { config } from "../config";
import { requireAuth } from "../middleware/requireAuth";
import { DEFAULT_CATEGORIES } from "../lib/defaultCategories";
import { newId } from "../lib/id";
import { publicUser, UserRow } from "../lib/mappers";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
    return;
  }
  const { email, password, name } = parsed.data;

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "Ya existe una cuenta con ese correo" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = newId();

  const client = await pool.connect();
  let userRow: UserRow;
  try {
    await client.query("BEGIN");
    const result = await client.query<UserRow>(
      `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, email, passwordHash, name]
    );
    userRow = result.rows[0];
    for (const cat of DEFAULT_CATEGORIES) {
      await client.query(
        `INSERT INTO categories (id, user_id, name, color, type) VALUES ($1, $2, $3, $4, $5)`,
        [newId(), userId, cat.name, cat.color, cat.type]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const token = signToken({ userId });
  res.cookie(config.cookieName, token, COOKIE_OPTIONS);
  res.status(201).json({ user: publicUser(userRow) });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }
  const { email, password } = parsed.data;

  const result = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  const userRow = result.rows[0];
  if (!userRow || !(await verifyPassword(password, userRow.password_hash))) {
    res.status(401).json({ error: "Correo o contraseña incorrectos" });
    return;
  }

  const token = signToken({ userId: userRow.id });
  res.cookie(config.cookieName, token, COOKIE_OPTIONS);
  res.json({ user: publicUser(userRow) });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(config.cookieName, { path: "/" });
  res.status(204).send();
});

router.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [req.userId]);
  const userRow = result.rows[0];
  if (!userRow) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  res.json({ user: publicUser(userRow) });
});

const settingsSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  cycleStartDay: z.number().int().min(1).max(28).optional(),
  monthlyBudget: z.number().min(0).optional(),
  currency: z.enum(["USD", "COP", "MXN"]).optional(),
});

router.patch("/me", requireAuth, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(parsed.data.name);
  }
  if (parsed.data.cycleStartDay !== undefined) {
    fields.push(`cycle_start_day = $${idx++}`);
    values.push(parsed.data.cycleStartDay);
  }
  if (parsed.data.monthlyBudget !== undefined) {
    fields.push(`monthly_budget = $${idx++}`);
    values.push(parsed.data.monthlyBudget);
  }
  if (parsed.data.currency !== undefined) {
    fields.push(`currency = $${idx++}`);
    values.push(parsed.data.currency);
  }

  if (fields.length === 0) {
    const current = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [req.userId]);
    res.json({ user: publicUser(current.rows[0]) });
    return;
  }

  values.push(req.userId);
  const result = await pool.query<UserRow>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  res.json({ user: publicUser(result.rows[0]) });
});

export default router;
