import { describe, it, expect } from "vitest";
import { addDeploymentSchema } from "@/server/validations/deployments";

const VALID_BASE = {
  projectId: "proj-123",
  branch: "main",
  commitSha: "abc123def456",
  triggerType: "push" as const,
};

describe("addDeploymentSchema - valid cases", () => {
  it("accepts a valid minimal payload", () => {
    const result = addDeploymentSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  it("accepts all trigger types", () => {
    for (const triggerType of ["push", "manuel", "manual", "rollback"] as const) {
      const result = addDeploymentSchema.safeParse({ ...VALID_BASE, triggerType });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional containerPort when valid", () => {
    const result = addDeploymentSchema.safeParse({ ...VALID_BASE, containerPort: 8080 });
    expect(result.success).toBe(true);
  });

  it("accepts full payload with all optional fields", () => {
    const result = addDeploymentSchema.safeParse({
      ...VALID_BASE,
      commitMessage: "feat: add thing",
      authorName: "Alice",
      authorAvatarUrl: "https://example.com/avatar.png",
      imageTag: "v1.0.0",
      containerPort: 3000,
      rollbackOfDeploymentId: "dep-999",
    });
    expect(result.success).toBe(true);
  });
});

describe("addDeploymentSchema - missing required fields", () => {
  it("rejects missing projectId", () => {
    const { projectId: _, ...payload } = VALID_BASE;
    const result = addDeploymentSchema.safeParse(payload);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("projectId");
  });

  it("rejects missing branch", () => {
    const { branch: _, ...payload } = VALID_BASE;
    const result = addDeploymentSchema.safeParse(payload);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("branch");
  });

  it("rejects missing commitSha", () => {
    const { commitSha: _, ...payload } = VALID_BASE;
    const result = addDeploymentSchema.safeParse(payload);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("commitSha");
  });

  it("rejects missing triggerType", () => {
    const { triggerType: _, ...payload } = VALID_BASE;
    const result = addDeploymentSchema.safeParse(payload);
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("triggerType");
  });
});

describe("addDeploymentSchema - invalid fields", () => {
  it("rejects invalid triggerType", () => {
    const result = addDeploymentSchema.safeParse({ ...VALID_BASE, triggerType: "webhook" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("triggerType");
  });

  it("rejects non-integer containerPort", () => {
    const result = addDeploymentSchema.safeParse({ ...VALID_BASE, containerPort: 3000.5 });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("containerPort");
  });

  it("rejects negative containerPort", () => {
    const result = addDeploymentSchema.safeParse({ ...VALID_BASE, containerPort: -1 });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("containerPort");
  });

  it("rejects zero containerPort", () => {
    const result = addDeploymentSchema.safeParse({ ...VALID_BASE, containerPort: 0 });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("containerPort");
  });
});
