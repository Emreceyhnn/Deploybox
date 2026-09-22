import NextLink from "next/link";
import { Box, Typography } from "@mui/material";
import { getStatusBadgeStyle, getStatusLabel, formatRelativeTime } from "./statusBadge";
import type { DeploymentStatus } from "./statusBadge";
import { colors } from "@/app/theme";

import { getProjectDomain } from "@/app/lib/domain";

type ProjectCardProps = {
  id: string;
  repoFullName: string;
  defaultBranch: string;
  subdomain: string;
  customDomain: string | null;
  latestDeployment: {
    status: DeploymentStatus;
    branch: string;
    createdAt: Date | string;
    finishedAt: Date | string | null;
  } | null;
};

export function ProjectCard({
  id,
  repoFullName,
  defaultBranch,
  subdomain,
  customDomain,
  latestDeployment,
}: ProjectCardProps) {
  const displayDomain = getProjectDomain(subdomain, customDomain);

  return (
    <Box
      component={NextLink}
      href={`/projects/${id}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        p: 3,
        bgcolor: colors.bgSurface,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: "8px",
        textDecoration: "none",
        color: colors.textPrimary,
        "&:hover": { borderColor: colors.borderHover },
        "&:focus-visible": {
          outline: `2px solid ${colors.brand}`,
          outlineOffset: "2px",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
        <Typography sx={{ fontSize: "16px", fontWeight: 600 }}>{repoFullName}</Typography>
        <Box component="span" sx={getStatusBadgeStyle(latestDeployment?.status)}>
          {getStatusLabel(latestDeployment?.status)}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "13px", color: colors.textMuted }}>
        <Box
          component="span"
          sx={{
            fontFamily: "var(--font-geist-mono)",
            bgcolor: colors.bgSurfaceHover,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: "4px",
            px: 1,
            py: "2px",
          }}
        >
          {latestDeployment?.branch ?? defaultBranch}
        </Box>
        <span>·</span>
        <span>{formatRelativeTime(latestDeployment?.finishedAt ?? latestDeployment?.createdAt)}</span>
      </Box>

      <Box sx={{ height: "1px", bgcolor: colors.borderDefault }} />

      <Typography
        sx={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "13px",
          color: colors.textMono,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayDomain}
      </Typography>
    </Box>
  );
}
