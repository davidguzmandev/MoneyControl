import express from "express";
import cors from "cors";
import { config } from "./config";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`MoneyControl API listening on port ${config.port}`);
});
