import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { encrypt } from "../lib/crypto";
import { getBalances, getProfiles, WiseApiError } from "../lib/wiseClient";
import { syncWiseForUser } from "../services/wiseSync";

const router = Router();
router.use(requireAuth);

interface WiseStatusRow {
  wise_api_token_encrypted: string | null;
  wise_currency: string | null;
  wise_last_synced_at: Date | null;
}

router.get("/wise/status", async (req, res) => {
  const result = await pool.query<WiseStatusRow>(
    "SELECT wise_api_token_encrypted, wise_currency, wise_last_synced_at FROM users WHERE id = $1",
    [req.userId]
  );
  const row = result.rows[0];
  res.json({
    connected: !!row?.wise_api_token_encrypted,
    currency: row?.wise_currency ?? null,
    lastSyncedAt: row?.wise_last_synced_at ?? null,
  });
});

const connectSchema = z.object({
  apiToken: z.string().min(10),
});

router.post("/wise/connect", async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Token inválido" });
    return;
  }

  const { apiToken } = parsed.data;

  let profileId: number;
  let balanceId: number;
  let currency: string;
  try {
    const profiles = await getProfiles(apiToken);
    const personalProfile = profiles.find((p) => p.type === "PERSONAL") ?? profiles[0];
    if (!personalProfile) {
      res.status(400).json({ error: "No se encontró un perfil de Wise para este token" });
      return;
    }
    profileId = personalProfile.id;

    const balances = await getBalances(apiToken, profileId);
    const balance = balances[0];
    if (!balance) {
      res.status(400).json({ error: "No se encontró un balance en tu cuenta de Wise" });
      return;
    }
    balanceId = balance.id;
    currency = balance.currency;
  } catch (err) {
    if (err instanceof WiseApiError) {
      res.status(400).json({ error: "No se pudo validar el token con Wise. Revisa que sea correcto." });
      return;
    }
    throw err;
  }

  const encrypted = encrypt(apiToken);
  await pool.query(
    `UPDATE users
     SET wise_api_token_encrypted = $1, wise_profile_id = $2, wise_balance_id = $3, wise_currency = $4, wise_last_synced_at = NULL
     WHERE id = $5`,
    [encrypted, String(profileId), String(balanceId), currency, req.userId]
  );

  const syncResult = await syncWiseForUser(req.userId!);
  res.status(201).json({ connected: true, currency, imported: syncResult.imported });
});

router.post("/wise/sync", async (req, res) => {
  const result = await syncWiseForUser(req.userId!);
  res.json(result);
});

router.delete("/wise", async (req, res) => {
  await pool.query(
    `UPDATE users
     SET wise_api_token_encrypted = NULL, wise_profile_id = NULL, wise_balance_id = NULL, wise_currency = NULL, wise_last_synced_at = NULL
     WHERE id = $1`,
    [req.userId]
  );
  res.status(204).send();
});

export default router;
