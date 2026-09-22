import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { envVariables } from "../db/schema";
import { encryptSecret, decryptSecret } from "./crypto";

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parses `KEY=VALUE` lines (as pasted into a textarea) into a Map, skipping
 * blank lines, comments (`#`), and malformed entries. */
export function parseEnvVarsText(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (KEY_PATTERN.test(key)) {
      result.set(key, value);
    }
  }
  return result;
}

/** Replaces every env var for a project with the given key/value set —
 * encrypting each value at rest, one row per key (the `envVariables` table
 * design), rather than storing a single unencrypted text blob. */
export async function replaceProjectEnvVars(projectId: string, vars: Map<string, string>) {
  await db.delete(envVariables).where(eq(envVariables.projectId, projectId));

  if (vars.size === 0) return;

  await db.insert(envVariables).values(
    Array.from(vars.entries()).map(([key, value]) => ({
      projectId,
      key,
      valueEncrypted: encryptSecret(value),
    })),
  );
}

/** Upserts a single env var (used by the post-creation edit UI, so changing
 * one key doesn't require resending every other key). */
export async function upsertProjectEnvVar(projectId: string, key: string, value: string) {
  const existing = await db.query.envVariables.findFirst({
    where: and(eq(envVariables.projectId, projectId), eq(envVariables.key, key)),
  });

  const valueEncrypted = encryptSecret(value);

  if (existing) {
    await db
      .update(envVariables)
      .set({ valueEncrypted, updatedAt: new Date() })
      .where(eq(envVariables.id, existing.id));
  } else {
    await db.insert(envVariables).values({ projectId, key, valueEncrypted });
  }
}

export async function deleteProjectEnvVar(projectId: string, key: string) {
  await db
    .delete(envVariables)
    .where(and(eq(envVariables.projectId, projectId), eq(envVariables.key, key)));
}

/** Reads every env var for a project and decrypts it, returning the
 * `KEY=VALUE\n...` text format the orchestrator/`.env` file already expect —
 * so the deploy pipeline itself doesn't need to change, only where the data
 * comes from. */
export async function getProjectEnvVarsAsText(projectId: string): Promise<string> {
  const rows = await db.query.envVariables.findMany({
    where: eq(envVariables.projectId, projectId),
  });

  return rows.map((row) => `${row.key}=${decryptSecret(row.valueEncrypted)}`).join("\n");
}

/** Returns the decrypted key/value list for a project (for the settings UI —
 * values are sent to the owning user only, over an already-authenticated
 * tRPC procedure). */
export async function getProjectEnvVarsList(projectId: string) {
  const rows = await db.query.envVariables.findMany({
    where: eq(envVariables.projectId, projectId),
    orderBy: (table, { asc }) => asc(table.key),
  });

  return rows.map((row) => ({
    key: row.key,
    value: decryptSecret(row.valueEncrypted),
  }));
}
