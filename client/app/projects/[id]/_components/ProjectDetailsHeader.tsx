"use client";

import NextLink from "next/link";
import { Box, Breadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { colors } from "@/app/theme";

interface ProjectDetailsHeaderProps {
  repoFullName: string;
}

export function ProjectDetailsHeader({ repoFullName }: ProjectDetailsHeaderProps) {
  // Avoid repeating the full "owner/repo" string twice back to back — the
  // breadcrumb just needs a short trail back to the list, the big heading
  // below already carries the full name.
  const repoNameOnly = repoFullName.split("/").pop() ?? repoFullName;

  return (
    <Box sx={{ mb: 3 }}>
      <Breadcrumbs separator="/" sx={{ color: colors.textFaint, mb: 1, fontSize: "0.9rem" }}>
        <MuiLink
          component={NextLink}
          href="/projects"
          underline="hover"
          sx={{
            color: colors.textMuted,
            fontFamily: "var(--font-geist-mono)",
            fontSize: "13px",
            "&:hover": { color: colors.textPrimary },
          }}
        >
          Projects
        </MuiLink>
        <Typography
          sx={{
            color: colors.textPrimary,
            fontFamily: "var(--font-geist-mono)",
            fontSize: "13px",
          }}
        >
          {repoNameOnly}
        </Typography>
      </Breadcrumbs>
      <Typography variant="h1" component="h1" sx={{ fontSize: 28 }}>
        {repoFullName}
      </Typography>
    </Box>
  );
}
