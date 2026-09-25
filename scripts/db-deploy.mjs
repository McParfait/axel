import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("[SENSITIVE]")) {
  console.log("Skipping prisma migrate deploy (DATABASE_URL unavailable).");
  process.exit(0);
}

if (!process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
