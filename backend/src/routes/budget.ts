import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getBudgetSummary } from "../services/budget";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const dateParam = typeof req.query.date === "string" ? new Date(req.query.date) : new Date();
  const summary = await getBudgetSummary(req.userId!, dateParam);
  res.json(summary);
});

export default router;
