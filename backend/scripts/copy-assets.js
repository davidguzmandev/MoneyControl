const fs = require("fs");
const path = require("path");

fs.copyFileSync(
  path.join(__dirname, "..", "src", "db", "schema.sql"),
  path.join(__dirname, "..", "dist", "db", "schema.sql")
);
