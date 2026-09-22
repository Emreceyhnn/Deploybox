import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const USER1_ID = "00000000-0000-0000-0000-000000000001";
const USER2_ID = "00000000-0000-0000-0000-000000000002";
const PROJECT_ID = "00000000-0000-0000-0000-000000000010";
const DEPLOYMENT_ID = "00000000-0000-0000-0000-000000000100";
const ENV_VAR_ID = "00000000-0000-0000-0000-000000001000";
const DEPLOYMENT_LOG_ID = "00000000-0000-0000-0000-000000010000";

async function main() {
  try {
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/server/db");
    const {
      users,
      projects,
      deployments,
      envVariables,
      deploymentLogs,
    } = await import("@/server/db/schema");

    async function addUser(id: string, email: string, githubId: string, username: string) {
      const existing = await db.select().from(users).where(eq(users.githubId, githubId));
      if (existing.length > 0) {
        console.log(`User ${username} (${email}) already exists`);
        return existing[0];
      }
      const [user] = await db
        .insert(users)
        .values({
          id,
          githubId,
          username,
          email,
          avatarUrl: "https://i.pravatar.cc/150",
          accessTokenEncrypted: "encrypted_access_token",
          refreshTokenEncrypted: "encrypted_refresh_token",
        })
        .returning();
      console.log(`User ${username} added`);
      return user;
    }

    async function addProjects(ownerId: string) {
      const existing = await db.select().from(projects).where(eq(projects.id, PROJECT_ID));
      if (existing.length > 0) {
        console.log("Projects already exist");
        return existing[0];
      }
      const [project] = await db
        .insert(projects)
        .values({
          id: PROJECT_ID,
          ownerId,
          repoFullName: "emre/project",
          repoId: "1001",
          defaultBranch: "main",
          subdomain: "emre",
          customDomain: "emre.com",
          containerPort: 3000,
          webhookId: "wh_123456",
          webhookSecretEncrypted: "encrypted_webhook_secret",
          isActive: true,
        })
        .returning();
      console.log("Projects added");
      return project;
    }

    async function addDeployments(projectId: string) {
      const existing = await db.select().from(deployments).where(eq(deployments.id, DEPLOYMENT_ID));
      if (existing.length > 0) {
        console.log("Deployments already exist");
        return existing[0];
      }
      const [deployment] = await db
        .insert(deployments)
        .values({
          id: DEPLOYMENT_ID,
          projectId,
          status: "queued",
          triggerType: "push",
          commitSha: "a1b2c3d4e5f67890123456789012345678901234",
          commitMessage: "Initial commit",
          branch: "main",
          authorName: "emre",
          authorAvatarUrl: "https://i.pravatar.cc/150",
          imageTag: "v1.0.0",
          containerPort: 3000,
          rollbackOfDeploymentId: null,
          errorMessage: null,
        })
        .returning();
      console.log("Deployments added");
      return deployment;
    }

    async function addEnvVariables(projectId: string) {
      const existing = await db.select().from(envVariables).where(eq(envVariables.id, ENV_VAR_ID));
      if (existing.length > 0) {
        console.log("Env variables already exist");
        return;
      }
      await db.insert(envVariables).values({
        id: ENV_VAR_ID,
        projectId,
        key: "NODE_ENV",
        valueEncrypted: "production_encrypted",
      });
      console.log("Env variables added");
    }

    async function addDeploymentLogs(deploymentId: string) {
      const existing = await db.select().from(deploymentLogs).where(eq(deploymentLogs.id, DEPLOYMENT_LOG_ID));
      if (existing.length > 0) {
        console.log("Deployment logs already exist");
        return;
      }
      await db.insert(deploymentLogs).values({
        id: DEPLOYMENT_LOG_ID,
        deploymentId,
        sequence: 1,
        line: "Starting deployment build process...",
        stream: "stdout",
        timestamp: new Date("2026-01-01T00:00:00Z"),
      });
      console.log("Deployment logs added");
    }

    const user1 = await addUser(USER1_ID, "[EMAIL_ADDRESS]", "143955794", "emre");
    await addUser(USER2_ID, "emre2@gmail.com", "143955795", "emre2");

    const project = await addProjects(user1.id);
    const deployment = await addDeployments(project.id);
    await addEnvVariables(project.id);
    await addDeploymentLogs(deployment.id);

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed with error:", error);
    process.exit(1);
  }
}

main();
