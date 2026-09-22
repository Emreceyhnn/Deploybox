"use client";

import { useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import { colors } from "@/app/theme";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side detail is intentionally not shown to the user below —
    // logged here for whoever is watching server/console output.
    console.error(error);
  }, [error]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: colors.bgPage,
        color: colors.textPrimary,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 3,
        textAlign: "center",
      }}
    >
      <Typography sx={{ fontSize: 22, fontWeight: 700 }}>Something went wrong</Typography>
      <Typography sx={{ fontSize: 14, color: colors.textMuted, maxWidth: 420 }}>
        An unexpected error occurred while loading this page. Try again, or
        head back to your projects.
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
        <Button
          onClick={reset}
          variant="outlined"
          sx={{
            textTransform: "none",
            borderColor: colors.borderDefault,
            color: colors.textPrimary,
            "&:hover": { borderColor: colors.borderHover, bgcolor: colors.bgSurfaceHover },
          }}
        >
          Try again
        </Button>
        <Button
          href="/projects"
          variant="contained"
          sx={{ textTransform: "none", bgcolor: colors.brand, "&:hover": { bgcolor: colors.brandHover } }}
        >
          Back to Projects
        </Button>
      </Box>
    </Box>
  );
}
