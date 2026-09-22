"use client";

import { Box, Button, Typography } from "@mui/material";
import { ErrorOutlined, DoNotDisturb, HistoryOutlined } from "@mui/icons-material";
import {
  getStatusBadgeStyle,
  getStatusLabel,
  formatRelativeTime,
} from "../../_components/statusBadge";
import type { DeploymentStatus } from "../../_components/statusBadge";
import { colors } from "@/app/theme";

type Deployment = {
  id: string;
  status: DeploymentStatus;
  branch: string;
  commitSha: string;
  commitMessage: string | null;
  authorName: string | null;
  errorMessage?: string | null;
  imageTag?: string | null;
  createdAt: Date | string;
  finishedAt: Date | string | null;
};

interface DeploymentsListProps {
  deployments: Deployment[];
  onRollback?: (deploymentId: string) => void;
  isRollingBack?: boolean;
}

export function DeploymentsList({ deployments, onRollback, isRollingBack }: DeploymentsListProps) {
  if (deployments.length === 0) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: "center",
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: "8px",
          bgcolor: colors.bgSurface,
          color: colors.textMuted,
        }}
      >
        No deployments yet.
      </Box>
    );
  }

  // The most recent successful deployment is already what's live — offering
  // to "roll back" to itself would be a no-op, so only show the action on
  // earlier successful deployments that still have a usable image tag.
  const currentDeploymentId = deployments.find((d) => d.status === "success")?.id;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {deployments.map((deployment) => {
        const canRollback =
          onRollback &&
          deployment.status === "success" &&
          deployment.id !== currentDeploymentId &&
          !!deployment.imageTag;

        return (
          <Box
            key={deployment.id}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              p: 2.5,
              bgcolor: colors.bgSurface,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: "8px",
              "&:hover": { borderColor: colors.borderHover },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
                <Box component="span" sx={{ ...getStatusBadgeStyle(deployment.status), flex: "none" }}>
                  {getStatusLabel(deployment.status)}
                </Box>

                <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deployment.commitMessage ?? "No commit message"}
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: "2px",
                      fontSize: "12px",
                      color: colors.textMuted,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "var(--font-geist-mono)",
                        bgcolor: colors.bgSurfaceHover,
                        border: `1px solid ${colors.borderDefault}`,
                        borderRadius: "4px",
                        px: "6px",
                        py: "1px",
                      }}
                    >
                      {deployment.branch}
                    </Box>
                    <Box component="span" sx={{ fontFamily: "var(--font-geist-mono)" }}>
                      {deployment.commitSha.slice(0, 7)}
                    </Box>
                    {deployment.authorName && <span>· {deployment.authorName}</span>}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: "none" }}>
                {canRollback && (
                  <Button
                    size="small"
                    onClick={() => onRollback(deployment.id)}
                    disabled={isRollingBack}
                    startIcon={<HistoryOutlined fontSize="small" />}
                    sx={{
                      fontSize: "12px",
                      textTransform: "none",
                      color: colors.textMuted,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: "6px",
                      px: 1.25,
                      py: "2px",
                      "&:hover": { color: colors.textPrimary, borderColor: colors.borderHover, bgcolor: colors.bgSurfaceHover },
                    }}
                  >
                    Roll back to this
                  </Button>
                )}
                <Typography sx={{ fontSize: "12px", color: colors.textMuted }}>
                  {formatRelativeTime(deployment.finishedAt ?? deployment.createdAt)}
                </Typography>
              </Box>
            </Box>

            {deployment.errorMessage && (deployment.status === "failed" || deployment.status === "cancelled") && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 0.75,
                  fontSize: "12px",
                  color: deployment.status === "cancelled" ? colors.textMuted : colors.error,
                  bgcolor: deployment.status === "cancelled" ? "rgba(155, 151, 157, 0.08)" : "rgba(255, 107, 87, 0.08)",
                  border: deployment.status === "cancelled" ? "1px solid rgba(155, 151, 157, 0.2)" : "1px solid rgba(255, 107, 87, 0.2)",
                  px: 1.5,
                  py: 1,
                  borderRadius: "4px",
                  fontFamily: "var(--font-geist-mono)",
                  wordBreak: "break-word",
                }}
              >
                {deployment.status === "cancelled" ? (
                  <DoNotDisturb sx={{ fontSize: 14, flex: "none", mt: "1px" }} />
                ) : (
                  <ErrorOutlined sx={{ fontSize: 14, flex: "none", mt: "1px" }} />
                )}
                <span>{deployment.errorMessage}</span>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
