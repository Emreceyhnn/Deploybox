"use client";

import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import { AddOutlined, DeleteOutlined, VisibilityOffOutlined, VisibilityOutlined } from "@mui/icons-material";
import { trpc } from "@/app/lib/trpc/client";
import { useToast } from "@/app/lib/toast/ToastProvider";
import { colors } from "@/app/theme";

interface EnvVarsPanelProps {
  projectId: string;
}

export function EnvVarsPanel({ projectId }: EnvVarsPanelProps) {
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const { data: envVars, isLoading } = trpc.projects.listEnvVars.useQuery({ projectId });

  const setEnvVar = trpc.projects.setEnvVar.useMutation({
    onSuccess: () => {
      utils.projects.listEnvVars.invalidate({ projectId });
      showToast("Environment variable saved — redeploy to apply it.", "success");
    },
    onError: (err) => showToast(`Failed to save: ${err.message}`, "error"),
  });

  const deleteEnvVar = trpc.projects.deleteEnvVar.useMutation({
    onSuccess: () => {
      utils.projects.listEnvVars.invalidate({ projectId });
      showToast("Environment variable removed — redeploy to apply it.", "success");
    },
    onError: (err) => showToast(`Failed to remove: ${err.message}`, "error"),
  });

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = () => {
    const key = newKey.trim();
    if (!key) return;
    setEnvVar.mutate({ projectId, key, value: newValue });
    setNewKey("");
    setNewValue("");
  };

  return (
    <Box sx={{ mt: 5 }}>
      <Typography sx={{ fontSize: "18px", fontWeight: 700, mb: 1 }}>Environment Variables</Typography>
      <Typography sx={{ fontSize: "13px", color: colors.textMuted, mb: 2 }}>
        Changes take effect on the next deploy — trigger one after editing to apply them.
      </Typography>

      <Box
        sx={{
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: "8px",
          bgcolor: colors.bgSurface,
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <Box sx={{ p: 3, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>Loading…</Box>
        ) : envVars && envVars.length > 0 ? (
          envVars.map((row) => (
            <Box
              key={row.key}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 2,
                py: 1.25,
                borderBottom: `1px solid ${colors.borderDefault}`,
              }}
            >
              <Typography
                sx={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "13px",
                  fontWeight: 600,
                  minWidth: 160,
                  wordBreak: "break-all",
                }}
              >
                {row.key}
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-geist-mono)",
                  fontSize: "13px",
                  color: colors.textMuted,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {revealedKeys.has(row.key) ? row.value : "•".repeat(Math.min(row.value.length, 24) || 8)}
              </Typography>
              <Tooltip title={revealedKeys.has(row.key) ? "Hide value" : "Reveal value"}>
                <IconButton size="small" onClick={() => toggleReveal(row.key)} sx={{ color: colors.textMuted }}>
                  {revealedKeys.has(row.key) ? (
                    <VisibilityOffOutlined fontSize="small" />
                  ) : (
                    <VisibilityOutlined fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  onClick={() => deleteEnvVar.mutate({ projectId, key: row.key })}
                  disabled={deleteEnvVar.isPending}
                  sx={{ color: colors.error }}
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))
        ) : (
          <Box sx={{ p: 3, textAlign: "center", color: colors.textMuted, fontSize: 13 }}>
            No environment variables set.
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5 }}>
          <TextField
            size="small"
            placeholder="KEY"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase())}
            sx={{
              width: 180,
              "& .MuiOutlinedInput-root": { bgcolor: colors.bgSunkenAlt, fontFamily: "var(--font-geist-mono)", fontSize: "13px" },
            }}
          />
          <TextField
            size="small"
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            fullWidth
            sx={{
              "& .MuiOutlinedInput-root": { bgcolor: colors.bgSunkenAlt, fontFamily: "var(--font-geist-mono)", fontSize: "13px" },
            }}
          />
          <Button
            onClick={handleAdd}
            disabled={!newKey.trim() || setEnvVar.isPending}
            startIcon={<AddOutlined fontSize="small" />}
            variant="outlined"
            sx={{
              flex: "none",
              textTransform: "none",
              borderColor: colors.borderDefault,
              color: colors.textPrimary,
              "&:hover": { borderColor: colors.borderHover, bgcolor: colors.bgSurfaceHover },
            }}
          >
            Add
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
