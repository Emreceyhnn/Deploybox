"use client";

import { useState } from "react";
import { Paper, Stack, Box, Typography, Button, Switch, Tooltip } from "@mui/material";
import { Check, ContentCopy, Launch } from "@mui/icons-material";
import { colors } from "@/app/theme";

interface ProjectInfoBarProps {
  domain: string;
  fullUrl?: string;
  defaultBranch: string;
  containerPort: number;
  isActive: boolean;
  isUpdating: boolean;
  onToggleActive: (next: boolean) => void;
}

export function ProjectInfoBar({
  domain,
  fullUrl,
  defaultBranch,
  containerPort,
  isActive,
  isUpdating,
  onToggleActive,
}: ProjectInfoBarProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
      return;
    }
    try {
      await navigator.clipboard.writeText(domain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        my: 3,
        borderRadius: "8px",
        border: `1px solid ${colors.borderDefault}`,
        bgcolor: colors.bgSurface,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <Stack direction="row" spacing={3} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Box>
          <Typography sx={{ fontSize: "12px", color: colors.textMuted, mb: "2px" }}>Domain</Typography>
          <Tooltip title={copied ? "Copied!" : copyFailed ? "Couldn't copy — copy manually" : "Copy domain"}>
            <Button
              size="small"
              onClick={handleCopy}
              startIcon={copied ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
              sx={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: "13px",
                color: copyFailed ? colors.error : colors.textMono,
                minWidth: "auto",
                px: 0,
                textTransform: "none",
                "&:hover": { bgcolor: "transparent", color: copyFailed ? colors.error : "#9fd0ea" },
              }}
            >
              {domain}
            </Button>
          </Tooltip>
        </Box>

        <Box>
          <Typography sx={{ fontSize: "12px", color: colors.textMuted, mb: "2px" }}>Branch</Typography>
          <Box
            component="span"
            sx={{
              fontFamily: "var(--font-geist-mono)",
              fontSize: "13px",
              bgcolor: colors.bgSurfaceHover,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: "4px",
              px: 1,
              py: "2px",
            }}
          >
            {defaultBranch}
          </Box>
        </Box>

        <Box>
          <Typography sx={{ fontSize: "12px", color: colors.textMuted, mb: "2px" }}>Port</Typography>
          <Typography sx={{ fontFamily: "var(--font-geist-mono)", fontSize: "13px" }}>
            {containerPort}
          </Typography>
        </Box>

        <Box>
          <Typography sx={{ fontSize: "12px", color: colors.textMuted, mb: "2px" }}>Active</Typography>
          <Switch
            size="small"
            checked={isActive}
            disabled={isUpdating}
            onChange={(e) => onToggleActive(e.target.checked)}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: colors.success },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: colors.success,
              },
            }}
          />
        </Box>
      </Stack>

      <Button
        variant="contained"
        onClick={() => {
          const targetUrl = fullUrl || (domain.startsWith("http") ? domain : `https://${domain}`);
          window.open(targetUrl, "_blank");
        }}
        endIcon={<Launch fontSize="small" />}
        sx={{
          px: 2.5,
          py: 1,
          fontWeight: 700,
          bgcolor: colors.success,
          color: colors.bgSunken,
          "&:hover": { bgcolor: "#62d48d" },
        }}
      >
        View Live
      </Button>
    </Paper>
  );
}
