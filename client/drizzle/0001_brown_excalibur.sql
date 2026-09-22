ALTER TYPE "public"."trigger_type" ADD VALUE 'manual' BEFORE 'rollback';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "env_vars" text;