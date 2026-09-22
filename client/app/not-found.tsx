import { Box, Button, Typography } from "@mui/material";
import { colors } from "@/app/theme";

export default function NotFound() {
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
      <Typography sx={{ fontSize: 48, fontWeight: 800, color: colors.borderDefault }}>404</Typography>
      <Typography variant="h2">Page not found</Typography>
      <Typography sx={{ fontSize: 14, color: colors.textMuted, maxWidth: 380 }}>
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </Typography>
      <Button
        href="/projects"
        variant="contained"
        sx={{ textTransform: "none", bgcolor: colors.brand, "&:hover": { bgcolor: colors.brandHover }, mt: 1 }}
      >
        Back to Projects
      </Button>
    </Box>
  );
}
