import { Box, Typography } from "@mui/material";
import { RocketLaunchOutlined, TerminalOutlined, HubOutlined, BoltOutlined } from "@mui/icons-material";
import { colors, radius } from "./theme";

const features = [
  {
    icon: RocketLaunchOutlined,
    title: "Push to deploy",
    description: "Connect a GitHub repo and every push builds and ships automatically.",
  },
  {
    icon: TerminalOutlined,
    title: "No Dockerfile needed",
    description: "Node.js, Python, .NET, and static sites are detected and containerized for you.",
  },
  {
    icon: BoltOutlined,
    title: "Live build logs",
    description: "Watch every step stream in real time, from clone to container start.",
  },
  {
    icon: HubOutlined,
    title: "Your own domain",
    description: "Every project gets a live subdomain, or bring your own custom domain.",
  },
];

export default function LandingPage() {
  return (
    <Box sx={{ bgcolor: colors.bgPage, minHeight: "100vh", color: colors.textPrimary }}>
      <Box
        component="header"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 3, sm: 5 },
          py: 3,
        }}
      >
        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colors.brand }} />
        <Typography sx={{ fontWeight: 800, fontSize: "18px", letterSpacing: "-0.02em" }}>
          DeployBox
        </Typography>
      </Box>

      <Box
        component="main"
        sx={{
          maxWidth: 720,
          mx: "auto",
          px: 3,
          pt: { xs: 6, sm: 10 },
          pb: 12,
          textAlign: "center",
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: 30, sm: 48 },
            lineHeight: 1.15,
            mb: 2,
          }}
        >
          <Box component="span" sx={{ display: { xs: "inline", sm: "block" } }}>
            Push to a GitHub repo.{" "}
          </Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "block" } }}>
            Get a live URL.
          </Box>
        </Typography>
        <Typography sx={{ fontSize: { xs: 15, sm: 17 }, color: colors.textMuted, mb: 4, maxWidth: 520, mx: "auto" }}>
          DeployBox watches your repo, builds a container, and puts it online —
          no Dockerfile, no config files, no credit card.
        </Typography>

        <Box
          component="a"
          href="/auth"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            textDecoration: "none",
            bgcolor: colors.brand,
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "16px",
            px: 4,
            py: 1.5,
            borderRadius: `${radius.md}px`,
            "&:hover": { bgcolor: colors.brandHover },
          }}
        >
          <RocketLaunchOutlined />
          Get started with GitHub
        </Box>

        <Box
          sx={{
            mt: { xs: 8, sm: 10 },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            textAlign: "left",
          }}
        >
          {features.map((feature) => (
            <Box
              key={feature.title}
              sx={{
                p: 2.5,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: "8px",
                bgcolor: colors.bgSurface,
              }}
            >
              <feature.icon sx={{ color: colors.brand, fontSize: 22, mb: 1 }} />
              <Typography sx={{ fontSize: "15px", fontWeight: 700, mb: 0.5 }}>
                {feature.title}
              </Typography>
              <Typography sx={{ fontSize: "13px", color: colors.textMuted, lineHeight: 1.5 }}>
                {feature.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        component="footer"
        sx={{
          textAlign: "center",
          pb: 5,
          fontSize: "12px",
          color: colors.textFaint,
        }}
      >
        © {new Date().getFullYear()} DeployBox
      </Box>
    </Box>
  );
}
