import "dotenv/config";
import { Pool, types } from "pg";

// Postgres DATE (OID 1082) is a pure calendar date with no timezone. pg's
// default parser converts it to a JS Date using the process's local
// timezone, which silently shifts the day depending on where the server
// runs. We keep it as the raw "YYYY-MM-DD" string instead.
types.setTypeParser(1082, (value: string) => value);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
