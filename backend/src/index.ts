import "express-async-errors";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import authRoutes from "./routes/auth";
import categoriesRoutes from "./routes/categories";
import transactionsRoutes from "./routes/transactions";
import budgetRoutes from "./routes/budget";
import statsRoutes from "./routes/stats";
import integrationsRoutes from "./routes/integrations";
import { syncWiseForAllUsers } from "./services/wiseSync";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/integrations", integrationsRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(config.port, () => {
  console.log(`MoneyControl API listening on port ${config.port}`);
});

const WISE_SYNC_INTERVAL_MS = 15 * 60 * 1000;
setInterval(() => {
  syncWiseForAllUsers().catch((err) => console.error("Wise sync run failed:", err));
}, WISE_SYNC_INTERVAL_MS);
