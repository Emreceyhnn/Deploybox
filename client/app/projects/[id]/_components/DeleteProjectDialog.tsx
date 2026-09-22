"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
} from "@mui/material";
import { colors } from "@/app/theme";

type DeleteProjectDialogProps = {
  open: boolean;
  repoFullName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteProjectDialog({
  open,
  repoFullName,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteProjectDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={isDeleting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: "18px" }}>Delete project</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: colors.textMuted }}>
          This will permanently delete{" "}
          <strong style={{ color: colors.textPrimary }}>{repoFullName}</strong> and all of its
          deployments. This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isDeleting} sx={{ color: colors.textMuted }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isDeleting}
          variant="contained"
          sx={{
            bgcolor: colors.error,
            boxShadow: "none",
            "&:hover": { bgcolor: "#e05a48", boxShadow: "none" },
          }}
        >
          {isDeleting ? "Deleting…" : "Delete project"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
