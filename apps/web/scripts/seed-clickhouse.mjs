import { createClient } from "@clickhouse/client";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const root = resolve(__dirname, "../../..");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(appRoot, ".env.local"));
loadEnvFile(resolve(appRoot, ".env"));

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
    .map((s) =>
      s
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await client.command({ query: statement });
    console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "), "…");
  }
}

await runFile("clickhouse/schema.sql");
await runFile("clickhouse/seed.sql");
console.log("ClickHouse schema + seed applied.");
await client.close();
