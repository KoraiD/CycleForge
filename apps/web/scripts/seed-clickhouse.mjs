import { createClient } from "@clickhouse/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

const url = process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HOST;
if (!url) {
  console.error("Set CLICKHOUSE_URL (and user/password) before seeding.");
  process.exit(1);
}

const client = createClient({
  url,
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

async function runFile(relativePath) {
  const sql = readFileSync(resolve(root, relativePath), "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  for (const statement of statements) {
    await client.command({ query: statement });
    console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "), "…");
  }
}

await runFile("clickhouse/schema.sql");
await runFile("clickhouse/seed.sql");
console.log("ClickHouse schema + seed applied.");
await client.close();
