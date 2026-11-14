import { describe, it, expect } from "vitest";
import { getStatusLabel, getStatusBadgeStyle, type DeploymentStatus } from "@/app/projects/_components/statusBadge";
import { colors } from "@/app/theme";

const ALL_STATUSES: DeploymentStatus[] = [
  "queued",
  "clonning",
  "building",
  "deployed",
  "success",
  "failed",
  "cancelled",
];

describe("getStatusLabel", () => {
  it("queued -> 'queued'", () => expect(getStatusLabel("queued")).toBe("queued"));
  it("clonning -> 'cloning'", () => expect(getStatusLabel("clonning")).toBe("cloning"));
  it("building -> 'building'", () => expect(getStatusLabel("building")).toBe("building"));
  it("deployed -> 'deployed'", () => expect(getStatusLabel("deployed")).toBe("deployed"));
  it("success -> 'deployed'", () => expect(getStatusLabel("success")).toBe("deployed"));
  it("failed -> 'failed'", () => expect(getStatusLabel("failed")).toBe("failed"));
  it("cancelled -> 'cancelled'", () => expect(getStatusLabel("cancelled")).toBe("cancelled"));
  it("undefined -> 'no deploys'", () => expect(getStatusLabel(undefined)).toBe("no deploys"));
  it("null -> 'no deploys'", () => expect(getStatusLabel(null)).toBe("no deploys"));
});

describe("getStatusBadgeStyle", () => {
  it("returns a style object with color property for every known status", () => {
    for (const status of ALL_STATUSES) {
      const style = getStatusBadgeStyle(status);
      expect(style).toHaveProperty("color");
      expect(style).toHaveProperty("background");
      expect(style).toHaveProperty("border");
    }
  });

  it("queued badge uses warning yellow fg", () => {
    const style = getStatusBadgeStyle("queued");
    expect(style.color).toBe("#e8b34f");
  });

  it("deployed badge uses success green fg", () => {
    const style = getStatusBadgeStyle("deployed");
    expect(style.color).toBe("#4fbf79");
  });

  it("success badge uses same green fg as deployed", () => {
    expect(getStatusBadgeStyle("success").color).toBe(getStatusBadgeStyle("deployed").color);
  });

  it("failed badge uses error red fg", () => {
    const style = getStatusBadgeStyle("failed");
    expect(style.color).toBe("#ff6b57");
  });

  it("cancelled badge uses muted text color", () => {
    const style = getStatusBadgeStyle("cancelled");
    expect(style.color).toBe(colors.textMuted);
  });

  it("undefined returns no-deploys badge with muted fg", () => {
    const style = getStatusBadgeStyle(undefined);
    expect(style.color).toBe(colors.textMuted);
    expect(style.background).toBe(colors.bgSurfaceHover);
  });

  it("null returns no-deploys badge", () => {
    const style = getStatusBadgeStyle(null);
    expect(style.color).toBe(colors.textMuted);
  });
});
