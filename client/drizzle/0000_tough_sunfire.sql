CREATE TYPE "public"."deployment_status" AS ENUM('queued', 'clonning', 'building', 'deployed', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('push', 'manuel', 'rollback');--> statement-breakpoint
CREATE TABLE "deployment_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"line" text NOT NULL,
	"stream" varchar(16) DEFAULT 'stdout' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "deployment_status" DEFAULT 'queued' NOT NULL,
	"trigger_type" "trigger_type" DEFAULT 'push' NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"commit_message" text,
	"branch" varchar(255) NOT NULL,
	"author_name" varchar(255),
	"author_avatar_url" text,
	"image_tag" varchar(128),
	"container_port" integer,
	"rollback_of_deployment_id" uuid,
	"error_message" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "env_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"value_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"repo_full_name" varchar(255) NOT NULL,
	"repo_id" varchar(64) NOT NULL,
	"default_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"subdomain" varchar(128) NOT NULL,
	"custom_domain" varchar(255),
	"container_port" integer DEFAULT 3000 NOT NULL,
	"webhook_id" varchar(64),
	"webhook_secret_encrypted" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_id" varchar(64) NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255),
	"avatar_url" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deployment_logs" ADD CONSTRAINT "deployment_logs_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_rollback_of_deployment_id_deployments_id_fk" FOREIGN KEY ("rollback_of_deployment_id") REFERENCES "public"."deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_variables" ADD CONSTRAINT "env_variables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "logs_deployment_sequence_idx" ON "deployment_logs" USING btree ("deployment_id","sequence");--> statement-breakpoint
CREATE INDEX "deployments_project_idx" ON "deployments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deployments_status_idx" ON "deployments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "deployments_project_created_idx" ON "deployments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "deployments_commit_sha_idx" ON "deployments" USING btree ("commit_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "env_project_key_idx" ON "env_variables" USING btree ("project_id","key");--> statement-breakpoint
CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_subdomain_idx" ON "projects" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX "projects_repo_idx" ON "projects" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_id_idx" ON "users" USING btree ("github_id");