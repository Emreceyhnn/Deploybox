import { describe, it, expect } from "vitest";
import { addProjectSchema } from "@/server/validations/projects";

const VALID_BASE = {
  githubRepo: "https://github.com/user/repo",
  subdomain: "myapp",
  containerPort: 3000,
  isActive: true,
};

describe("addProjectSchema - valid cases", () => {
  it("accepts a valid github URL and subdomain", () => {
    const result = addProjectSchema.safeParse(VALID_BASE);
    expect(result.success).toBe(true);
  });

  it("accepts subdomain of length 3", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "abc" });
    expect(result.success).toBe(true);
  });

  it("accepts subdomain of length 63", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "a".repeat(63) });
    expect(result.success).toBe(true);
  });
});

describe("addProjectSchema - githubRepo", () => {
  it("rejects a non-URL string without throwing", () => {
    // Regression guard: safeParse() must never throw on user input.
    const result = addProjectSchema.safeParse({ ...VALID_BASE, githubRepo: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((i) => i.path[0] === "githubRepo")).toBe(true);
  });

  it("rejects a valid URL that is not github.com", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, githubRepo: "https://gitlab.com/user/repo" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("githubRepo");
  });
});

describe("addProjectSchema - subdomain", () => {
  it("rejects reserved subdomain 'www'", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "www" });
    expect(result.success).toBe(false);
  });

  it("rejects reserved subdomain 'api'", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "api" });
    expect(result.success).toBe(false);
  });

  it("rejects reserved subdomain 'admin'", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "admin" });
    expect(result.success).toBe(false);
  });

  it("rejects reserved subdomain 'app'", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "app" });
    expect(result.success).toBe(false);
  });

  it("rejects uppercase letters in subdomain", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "MyApp" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("subdomain");
  });

  it("rejects underscores in subdomain", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "my_app" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("subdomain");
  });

  it("rejects subdomain shorter than 3 characters", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "ab" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("subdomain");
  });

  it("rejects subdomain longer than 63 characters", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, subdomain: "a".repeat(64) });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("subdomain");
  });
});

describe("addProjectSchema - containerPort", () => {
  it("rejects port 0", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, containerPort: 0 });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("containerPort");
  });

  it("rejects port 70000 (above 65535)", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, containerPort: 70000 });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("containerPort");
  });

  it("rejects float port", () => {
    const result = addProjectSchema.safeParse({ ...VALID_BASE, containerPort: 3000.5 });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path[0]);
    expect(paths).toContain("containerPort");
  });
});
