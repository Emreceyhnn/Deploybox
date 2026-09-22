"use client";

import { useState, type MouseEvent } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Typography,
} from "@mui/material";
import { DeleteForever, Logout } from "@mui/icons-material";
import { trpc } from "@/app/lib/trpc/client";
import { colors } from "@/app/theme";

export function ProjectsHeader() {
  const pathname = usePathname();
  const { data: user } = trpc.auth.me.useQuery();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const menuOpen = Boolean(anchorEl);

  const isProjects = pathname?.includes("/projects");

  const handleOpenMenu = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => setAnchorEl(null);

  const logout = trpc.auth.logout.useMutation();
  const deleteAccount = trpc.auth.deleteAccount.useMutation();

  const handleSignOut = async () => {
    handleCloseMenu();
    try {
      await logout.mutateAsync();
    } catch {
      // Even if revocation fails, still sign the user out locally.
    }
    signOut({ callbackUrl: "/auth" });
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount.mutateAsync();
    } catch {
      // Even if the mutation fails partway, still sign the user out locally
      // rather than leaving them on a page for an account that may be gone.
    }
    signOut({ callbackUrl: "/auth" });
  };

  return (
    <Paper
      square
      elevation={0}
      sx={{
        borderBottom: `1px solid ${colors.borderDefault}`,
        px: { xs: 2, sm: 4 },
        py: 1.5,
        bgcolor: colors.bgPage,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.5, sm: 3.5 }, minWidth: 0 }}>
        <Typography
          component={NextLink}
          href="/projects"
          sx={{
            fontWeight: 800,
            fontSize: "18px",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-geist-sans)",
            color: colors.textPrimary,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 1,
            "&:hover": { color: colors.brand },
          }}
        >
          <Box
            component="span"
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: colors.brand,
              flex: "none",
            }}
          />
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            DeployBox
          </Box>
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            component={NextLink}
            href="/projects"
            size="small"
            sx={{
              color: isProjects ? colors.textPrimary : colors.textMuted,
              bgcolor: isProjects ? colors.bgSurfaceHover : "transparent",
              border: isProjects ? `1px solid ${colors.borderDefault}` : "1px solid transparent",
              fontWeight: isProjects ? 700 : 500,
              fontSize: "13px",
              px: 1.5,
              py: "4px",
              textTransform: "none",
              borderRadius: "8px",
              whiteSpace: "nowrap",
              "&:hover": { bgcolor: colors.bgSurfaceHover, color: colors.textPrimary },
            }}
          >
            Projects
          </Button>
        </Box>
      </Box>

      <Box
        onClick={handleOpenMenu}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpenMenu(e as unknown as MouseEvent<HTMLElement>);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          cursor: "pointer",
          px: 1,
          py: "4px",
          borderRadius: "8px",
          flex: "none",
          "&:hover": { bgcolor: colors.bgSurfaceHover },
        }}
      >
        <Typography
          sx={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "13px",
            color: colors.textMuted,
            display: { xs: "none", sm: "block" },
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user?.username ?? ""}
        </Typography>
        <Avatar
          src={user?.avatarUrl ?? undefined}
          alt={user?.username ?? ""}
          sx={{
            width: 32,
            height: 32,
            flex: "none",
            background: "linear-gradient(135deg, #7db8d8, #4a6f8a)",
          }}
        />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { mt: 1, minWidth: 200, boxShadow: "none" } },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: "13px", fontWeight: 600, color: colors.textPrimary }}>
            {user?.username ?? "—"}
          </Typography>
          {user?.email && (
            <Typography
              sx={{
                fontSize: "12px",
                color: colors.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.email}
            </Typography>
          )}
        </Box>
        <Divider sx={{ borderColor: colors.borderDefault }} />
        <MenuItem
          onClick={handleSignOut}
          sx={{
            fontSize: "13px",
            color: colors.textPrimary,
            gap: 1,
            "&:hover": { bgcolor: colors.bgSurfaceHover },
          }}
        >
          <ListItemIcon sx={{ minWidth: "auto !important" }}>
            <Logout fontSize="small" sx={{ color: colors.textMuted }} />
          </ListItemIcon>
          Sign out
        </MenuItem>
        <Divider sx={{ borderColor: colors.borderDefault }} />
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            setDeleteDialogOpen(true);
          }}
          sx={{
            fontSize: "13px",
            color: colors.error,
            gap: 1,
            "&:hover": { bgcolor: "rgba(255,107,87,0.08)" },
          }}
        >
          <ListItemIcon sx={{ minWidth: "auto !important" }}>
            <DeleteForever fontSize="small" sx={{ color: colors.error }} />
          </ListItemIcon>
          Delete account & data
        </MenuItem>
      </Menu>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ color: colors.textPrimary }}>Delete account and all data?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: colors.textMuted }}>
            This permanently deletes your DeployBox account and every project and
            deployment record you own. It does not stop already-running
            containers or remove GitHub webhooks — disconnect each project
            first if you want those cleaned up. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ color: colors.textMuted, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAccount}
            disabled={deleteAccount.isPending}
            variant="contained"
            sx={{
              textTransform: "none",
              bgcolor: colors.brand,
              "&:hover": { bgcolor: colors.brandHover },
            }}
          >
            {deleteAccount.isPending ? "Deleting…" : "Delete everything"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
