import { relations } from "drizzle-orm";
import {
  uuid,
  text,
  integer,
  timestamp,
  index,
  varchar,
  uniqueIndex,
  pgTable,
  pgEnum,
  boolean,
  AnyPgColumn,
} from "drizzle-orm/pg-core";

export const deploymentStatusEnum = pgEnum("deployment_status", [
  "queued",
  "clonning",
  "building",
  "deployed",
  "success",
  "failed",
  "cancelled",
]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "push",
  "manuel", // deprecated typo, kept for backwards compatibility with existing rows — use "manual"
  "manual",
  "rollback",
]);

/* ---------------------------------- USERS --------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubId: varchar("github_id", { length: 64 }).notNull(),
    username: varchar("username", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    avatarUrl: text("avatar_url"),
    accessTokenEncrypted: text("access_token_encrypted").notNull(), // GitHub token, encrypted at rest
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    githubIdIdx: uniqueIndex("users_github_id_idx").on(table.githubId),
  }),
);

/* -------------------------------- PROJECTS -------------------------------- */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    repoFullName: varchar("repo_full_name", { length: 255 }).notNull(),
    repoId: varchar("repo_id", { length: 64 }).notNull(),
    defaultBranch: varchar("default_branch", { length: 255 })
      .notNull()
      .default("main"),

    subdomain: varchar("subdomain", { length: 128 }).notNull(),
    customDomain: varchar("custom_domain", { length: 255 }),

    containerPort: integer("container_port").notNull().default(3000),

    // Deprecated: superseded by the `envVariables` table (one encrypted row
    // per key, editable after project creation). No code path reads or
    // writes this column anymore — kept only so existing rows aren't
    // silently dropped without a deliberate migration.
    envVars: text("env_vars"),

    webhookId: varchar("webhook_id", { length: 64 }),
    webhookSecretEncrypted: text("webhook_secret_encrypted"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    ownerIdx: index("projects_owner_idx").on(table.ownerId),
    subdomainIdx: uniqueIndex("projects_subdomain_idx").on(table.subdomain),
    repoIdx: index("projects_repo_idx").on(table.repoId),
  }),
);

/* ------------------------------- DEPLOYMENTS ------------------------------ */

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    status: deploymentStatusEnum("status").notNull().default("queued"),
    triggerType: triggerTypeEnum("trigger_type").notNull().default("push"),

    commitSha: varchar("commit_sha", { length: 40 }).notNull(),
    commitMessage: text("commit_message"),
    branch: varchar("branch", { length: 255 }).notNull(),
    authorName: varchar("author_name", { length: 255 }),
    authorAvatarUrl: text("author_avatar_url"),

    imageTag: varchar("image_tag", { length: 128 }),
    containerPort: integer("container_port"),

    rollbackOfDeploymentId: uuid("rollback_of_deployment_id").references(
      (): AnyPgColumn => deployments.id,
    ),

    errorMessage: text("error_message"),

    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    projectIdx: index("deployments_project_idx").on(table.projectId),
    statusIdx: index("deployments_status_idx").on(table.status),
    projectCreatedIdx: index("deployments_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    commitShaIdx: index("deployments_commit_sha_idx").on(table.commitSha),
  }),
);

/* ----------------------------- DEPLOYMENT LOGS ---------------------------- */

export const deploymentLogs = pgTable(
  "deployment_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployments.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(), // ordering within a deployment
    line: text("line").notNull(),
    stream: varchar("stream", { length: 16 }).notNull().default("stdout"), // stdout | stderr
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    deploymentSeqIdx: uniqueIndex("logs_deployment_sequence_idx").on(
      table.deploymentId,
      table.sequence,
    ),
  }),
);

/* -------------------------- ENVIRONMENT VARIABLES ------------------------- */

export const envVariables = pgTable(
  "env_variables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 255 }).notNull(),
    valueEncrypted: text("value_encrypted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    projectKeyIdx: uniqueIndex("env_project_key_idx").on(
      table.projectId,
      table.key,
    ),
  }),
);

/* -------------------------------- RELATIONS ------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  deployments: many(deployments),
  envVariables: many(envVariables),
}));

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
  logs: many(deploymentLogs),
  rollbackOf: one(deployments, {
    fields: [deployments.rollbackOfDeploymentId],
    references: [deployments.id],
  }),
}));

export const deploymentLogsRelations = relations(deploymentLogs, ({ one }) => ({
  deployment: one(deployments, {
    fields: [deploymentLogs.deploymentId],
    references: [deployments.id],
  }),
}));

export const envVariablesRelations = relations(envVariables, ({ one }) => ({
  project: one(projects, {
    fields: [envVariables.projectId],
    references: [projects.id],
  }),
}));
