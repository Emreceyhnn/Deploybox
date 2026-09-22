import { Box, Typography } from "@mui/material";
import NextLink from "next/link";
import { colors } from "@/app/theme";

export const metadata = {
  title: "Terms of Service — DeployBox",
};

export default function TermsPage() {
  return (
    <Box sx={{ bgcolor: colors.bgPage, minHeight: "100vh", color: colors.textPrimary, py: 8, px: 3 }}>
      <Box sx={{ maxWidth: 680, mx: "auto" }}>
        <Typography variant="h1" sx={{ fontSize: 28, mb: 1 }}>
          Terms of Service
        </Typography>
        <Typography sx={{ fontSize: 13, color: colors.textFaint, mb: 4 }}>
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 14, lineHeight: 1.7, color: colors.textMuted }}>
          <Section title="1. What DeployBox does">
            DeployBox connects to a GitHub repository you choose, builds a container
            image from it, and runs that container on our infrastructure so it&apos;s
            reachable at a subdomain (or a custom domain you configure) we provide.
            Deploys are triggered by pushes to your repository&apos;s default branch, or
            manually from the dashboard.
          </Section>

          <Section title="2. Your account and GitHub access">
            You sign in with GitHub OAuth. We request read access to your
            repositories and commit metadata, and permission to create a webhook on
            repositories you connect — we do not request write or admin access to
            your code. You can disconnect a repository (which removes its webhook)
            or delete your account and all associated data at any time from the
            dashboard.
          </Section>

          <Section title="3. Acceptable use">
            You&apos;re responsible for the code you deploy. Don&apos;t use DeployBox to
            run anything illegal, to attack or scan systems you don&apos;t own, to mine
            cryptocurrency, to abuse shared infrastructure (e.g. deliberately
            exhausting CPU, memory, disk, or network resources), or to host content
            that infringes someone else&apos;s rights. We may suspend or remove a
            deployment that violates this without prior notice if it threatens the
            platform or other users.
          </Section>

          <Section title="4. Resource limits and no uptime guarantee">
            Deployed containers run under CPU, memory, and process limits, and this
            service is provided on a best-effort basis with no uptime or
            availability guarantee. We may change limits, restart services, or take
            the platform down for maintenance at any time.
          </Section>

          <Section title="5. No warranty">
            DeployBox is provided &quot;as is,&quot; without warranties of any kind. We
            aren&apos;t liable for data loss, downtime, or damages arising from your
            use of the service, to the maximum extent permitted by law.
          </Section>

          <Section title="6. Changes">
            We may update these terms as the product changes. Continuing to use
            DeployBox after an update means you accept the revised terms.
          </Section>

          <Section title="7. Contact">
            Questions about these terms can be sent to the project maintainer via
            the repository this project is hosted in.
          </Section>
        </Box>

        <Typography sx={{ mt: 5, fontSize: 13 }}>
          <NextLink href="/auth" style={{ color: colors.textMono }}>
            ← Back to sign in
          </NextLink>
        </Typography>
      </Box>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography component="div" sx={{ fontSize: 14, lineHeight: 1.7, color: colors.textMuted }}>
        {children}
      </Typography>
    </Box>
  );
}
