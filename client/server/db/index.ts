import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/deploybox";

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.client ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });

if (process.env.NODE_ENV === "development") {
  globalForDb.client = client;
}

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development",
});
