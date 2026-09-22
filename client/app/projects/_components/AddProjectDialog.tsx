"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Stack,
  Box,
  Typography,
  Autocomplete,
  CircularProgress,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { LockOutlined, LinkOutlined, FolderOutlined, CloseRounded } from "@mui/icons-material";
import { trpc } from "@/app/lib/trpc/client";
import { colors } from "@/app/theme";

type AddProjectDialogProps = {
  open: boolean;
  onClose: () => void;
};

const initialForm = {
  githubRepo: "",
  subdomain: "",
  customDomain: "",
  containerPort: "3000",
  envVars: "",
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    // Sunken tone distinct from both the dialog's own paper background and
    // the page background, so editable fields read as recessed rather than
    // flush with the dialog surface.
    bgcolor: colors.bgSunkenAlt,
    "& fieldset": { borderColor: colors.borderDefault },
    "&:hover fieldset": { borderColor: colors.borderHover },
    "&.Mui-focused fieldset": { borderColor: colors.brand, borderWidth: "1px" },
  },
  "& .MuiInputLabel-root": { color: colors.textMuted },
};

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

function validateSubdomain(value: string): string | null {
  if (!value) return null;
  if (value.length < 3 || value.length > 63) return "Must be 3-63 characters";
  if (!SUBDOMAIN_PATTERN.test(value)) {
    return "Lowercase letters, numbers, hyphens only — can't start/end with a hyphen";
  }
  return null;
}

function validatePort(value: string): string | null {
  if (!value) return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return "Must be a port number between 1 and 65535";
  }
  return null;
}

export function AddProjectDialog({ open, onClose }: AddProjectDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [mode, setMode] = useState<"select" | "link">("select");
  const utils = trpc.useUtils();

  const subdomainError = validateSubdomain(form.subdomain.trim());
  const portError = validatePort(form.containerPort.trim());

  const repos = trpc.projects.listGithubRepos.useQuery(undefined, {
    enabled: open && mode === "select",
  });

  const addProject = trpc.projects.add.useMutation({
    onSuccess: () => {
      utils.projects.listWithLatestDeployment.invalidate();
      setForm(initialForm);
      onClose();
    },
  });

  const handleClose = () => {
    if (addProject.isPending) return;
    addProject.reset();
    setForm(initialForm);
    setMode("select");
    onClose();
  };

  const handleSubmit = () => {
    const githubRepo = form.githubRepo.trim();
    addProject.mutate({
      githubRepo: githubRepo.startsWith("http") ? githubRepo : `https://github.com/${githubRepo}`,
      subdomain: form.subdomain.trim(),
      customDomain: form.customDomain.trim() || undefined,
      containerPort: Number(form.containerPort),
      envVars: form.envVars.trim() || undefined,
      isActive: true,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pb: 1,
        }}
      >
        Connect a repo
        <Box
          component="button"
          onClick={handleClose}
          disabled={addProject.isPending}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "8px",
            border: "none",
            bgcolor: "transparent",
            color: colors.textMuted,
            cursor: "pointer",
            "&:hover": { bgcolor: colors.bgSurfaceHover, color: colors.textPrimary },
          }}
        >
          <CloseRounded fontSize="small" />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 0.5 }}>
          {addProject.error && (
            <Alert
              severity="error"
              sx={{ bgcolor: "#2c1815", border: "1px solid #4a2620", borderRadius: "8px" }}
            >
              {addProject.error.message}
            </Alert>
          )}

          <Box>
            <Typography
              sx={{
                fontSize: "12px",
                fontWeight: 700,
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                mb: 1.25,
              }}
            >
              Repository
            </Typography>

            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={(_, next) => {
                if (!next) return;
                setForm((f) => ({ ...f, githubRepo: "" }));
                setMode(next);
              }}
              fullWidth
              sx={{
                mb: 2,
                bgcolor: colors.bgSunkenAlt,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: "8px",
                p: "3px",
                "& .MuiToggleButton-root": {
                  border: "none",
                  borderRadius: "6px !important",
                  textTransform: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: colors.textMuted,
                  gap: 1,
                  py: "6px",
                  "&.Mui-selected": {
                    bgcolor: colors.bgSurfaceHover,
                    color: colors.textPrimary,
                    "&:hover": { bgcolor: colors.bgSurfaceHover },
                  },
                  "&:hover": { bgcolor: colors.bgSurface },
                },
              }}
            >
              <ToggleButton value="select">
                <FolderOutlined sx={{ fontSize: 16 }} />
                Your repos
              </ToggleButton>
              <ToggleButton value="link">
                <LinkOutlined sx={{ fontSize: 16 }} />
                Paste a link
              </ToggleButton>
            </ToggleButtonGroup>

            {mode === "link" ? (
              <TextField
                placeholder="https://github.com/owner/repo"
                value={form.githubRepo}
                onChange={(e) => setForm((f) => ({ ...f, githubRepo: e.target.value }))}
                fullWidth
                autoFocus
                sx={fieldSx}
              />
            ) : (
              <Autocomplete
                options={repos.data ?? []}
                getOptionLabel={(repo) => repo.fullName}
                loading={repos.isLoading}
                value={repos.data?.find((repo) => repo.fullName === form.githubRepo) ?? null}
                onChange={(_, repo) =>
                  setForm((f) => ({
                    ...f,
                    githubRepo: repo?.fullName ?? "",
                    subdomain: f.subdomain || repo?.fullName.split("/")[1] || "",
                  }))
                }
                slotProps={{
                  paper: {
                    sx: {
                      bgcolor: colors.bgSurface,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: "8px",
                      mt: 0.5,
                    },
                  },
                }}
                renderOption={(props, repo) => {
                  const { key, ...optionProps } = props;
                  return (
                    <Box
                      component="li"
                      key={key}
                      {...optionProps}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        fontSize: "13px",
                        fontFamily: "var(--font-geist-mono)",
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {repo.fullName}
                      </span>
                      {repo.private && (
                        <Chip
                          size="small"
                          icon={<LockOutlined sx={{ fontSize: 12 }} />}
                          label="Private"
                          sx={{
                            height: 20,
                            fontSize: "11px",
                            bgcolor: colors.bgSurfaceHover,
                            border: `1px solid ${colors.borderDefault}`,
                            color: colors.textMuted,
                          }}
                        />
                      )}
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search your repos…"
                    autoFocus
                    error={!!repos.error}
                    helperText={repos.error?.message}
                    sx={fieldSx}
                    slotProps={{
                      ...params.slotProps,
                      input: {
                        ...params.slotProps.input,
                        endAdornment: (
                          <>
                            {repos.isLoading && <CircularProgress size={16} />}
                            {params.slotProps.input.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />
            )}
          </Box>

          <Box>
            <Typography
              sx={{
                fontSize: "12px",
                fontWeight: 700,
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                mb: 1.25,
              }}
            >
              Deployment settings
            </Typography>

            <Stack spacing={2}>
              <TextField
                label="Subdomain"
                placeholder="my-project"
                helperText={subdomainError || "Lowercase letters, numbers, hyphens. 3-63 chars."}
                error={!!subdomainError}
                value={form.subdomain}
                onChange={(e) => setForm((f) => ({ ...f, subdomain: e.target.value }))}
                fullWidth
                sx={fieldSx}
              />

              <Stack direction="row" spacing={2}>
                <TextField
                  label="Custom domain"
                  placeholder="app.example.com (optional)"
                  value={form.customDomain}
                  onChange={(e) => setForm((f) => ({ ...f, customDomain: e.target.value }))}
                  fullWidth
                  sx={fieldSx}
                />

                <TextField
                  label="Container port"
                  type="number"
                  helperText={portError || "1-65535"}
                  error={!!portError}
                  value={form.containerPort}
                  onChange={(e) => setForm((f) => ({ ...f, containerPort: e.target.value }))}
                  sx={{ ...fieldSx, minWidth: 140 }}
                />
              </Stack>

              <TextField
                label="Environment Variables (.env)"
                placeholder={"VITE_API_URL=https://api.example.com\nNODE_ENV=production"}
                helperText="Paste your environment variables (KEY=VALUE per line)"
                value={form.envVars}
                onChange={(e) => setForm((f) => ({ ...f, envVars: e.target.value }))}
                multiline
                rows={4}
                fullWidth
                sx={fieldSx}
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button
          onClick={handleClose}
          disabled={addProject.isPending}
          sx={{ color: colors.textMuted, textTransform: "none", fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            addProject.isPending ||
            !form.githubRepo.trim() ||
            !form.subdomain.trim() ||
            !!subdomainError ||
            !!portError
          }
          variant="contained"
          disableElevation
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "8px",
            px: 2.5,
            bgcolor: colors.brand,
            "&:hover": { bgcolor: colors.brandHover },
            "&.Mui-disabled": { bgcolor: colors.borderDefault, color: colors.textFaint },
          }}
        >
          {addProject.isPending ? "Connecting…" : "Connect repo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
