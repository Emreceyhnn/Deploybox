import type { CSSProperties } from "react";
import { colors, radius } from "@/app/theme";

export type DeploymentStatus =
  | "queued"
  | "clonning"
  | "building"
  | "deployed"
  | "success"
  | "failed"
  | "cancelled";

const STATUS_COLORS: Record<
  DeploymentStatus,
  { fg: string; bg: string; border: string; label: string }
> = {
  queued: { fg: "#e8b34f", bg: "#2b2416", border: "#4a3d22", label: "queued" },
  clonning: { fg: "#7db8d8", bg: "#182530", border: "#22384a", label: "cloning" },
  building: { fg: "#7db8d8", bg: "#182530", border: "#22384a", label: "building" },
  deployed: { fg: "#4fbf79", bg: "#152a1d", border: "#1f4a30", label: "deployed" },
  success: { fg: "#4fbf79", bg: "#152a1d", border: "#1f4a30", label: "deployed" },
  failed: { fg: "#ff6b57", bg: "#2c1815", border: "#4a2620", label: "failed" },
  cancelled: { fg: colors.textMuted, bg: colors.bgSurfaceHover, border: colors.borderDefault, label: "cancelled" },
};

const NO_DEPLOY = {
  fg: colors.textMuted,
  bg: colors.bgSurfaceHover,
  border: colors.borderDefault,
  label: "no deploys",
};

export function getStatusBadgeStyle(status?: DeploymentStatus | null): CSSProperties {
  const c = status ? STATUS_COLORS[status] : NO_DEPLOY;
  return {
    fontFamily: "var(--font-geist-mono)",
    fontSize: "12px",
    fontWeight: 600,
    color: c.fg,
    background: c.bg,
    border: `1px solid ${c.border}`,
    padding: "3px 10px",
    borderRadius: `${radius.sm}px`,
    textTransform: "none",
    flex: "none",
    whiteSpace: "nowrap",
  };
}

export function getStatusLabel(status?: DeploymentStatus | null): string {
  return status ? STATUS_COLORS[status].label : NO_DEPLOY.label;
}

export function formatRelativeTime(date?: Date | string | null): string {
  if (!date) return "never deployed";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}
