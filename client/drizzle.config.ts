import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";
import path from "path";

// Load centralized root .env
loadEnvConfig(path.resolve(__dirname, ".."));
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
