"use client";

import { Box, Button, Typography } from "@mui/material";
import { colors } from "@/app/theme";

export function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        textAlign: "center",
        py: "100px",
        px: 3,
        border: `2px dashed ${colors.borderDefault}`,
        borderRadius: "8px",
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          border: `2px solid ${colors.borderHover}`,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "26px",
          color: colors.textFaint,
        }}
      >
        +
      </Box>
      <Box>
        <Typography sx={{ fontSize: "18px", fontWeight: 600, mb: 0.75 }}>No projects yet</Typography>
        <Typography sx={{ fontSize: "14px", color: colors.textMuted }}>
          Connect a GitHub repo to trigger your first build.
        </Typography>
      </Box>
      <Button
        onClick={onConnect}
        variant="contained"
        sx={{
          mt: 1,
          px: "26px",
          py: "12px",
          fontSize: "14px",
        }}
      >
        Connect your first repo
      </Button>
    </Box>
  );
}
