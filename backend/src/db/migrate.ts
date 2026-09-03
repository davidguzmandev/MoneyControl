import fs from "node:fs";
import path from "node:path";
import { pool } from "../db";

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("Schema applied successfully");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
