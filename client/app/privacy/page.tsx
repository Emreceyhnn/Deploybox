import { Box, Typography } from "@mui/material";
import NextLink from "next/link";
import { colors } from "@/app/theme";

export const metadata = {
  title: "Privacy Policy — DeployBox",
};

export default function PrivacyPage() {
  return (
    <Box sx={{ bgcolor: colors.bgPage, minHeight: "100vh", color: colors.textPrimary, py: 8, px: 3 }}>
      <Box sx={{ maxWidth: 680, mx: "auto" }}>
        <Typography variant="h1" sx={{ fontSize: 28, mb: 1 }}>
          Privacy Policy
        </Typography>
        <Typography sx={{ fontSize: 13, color: colors.textFaint, mb: 4 }}>
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 14, lineHeight: 1.7, color: colors.textMuted }}>
          <Section title="1. What we collect">
            When you sign in with GitHub, we store your GitHub user ID, username,
            email, and avatar URL. We store an encrypted copy of the GitHub access
            token issued to us (scoped to read repositories and manage webhooks —
            never write access) so we can list your repos and create deploy
            webhooks on your behalf. For each project you connect, we store the
            repository name, branch, subdomain, container settings, and any
            environment variables you provide.
          </Section>

          <Section title="2. Build and runtime logs">
            When you trigger a deploy, the build and container startup output is
            streamed to your browser and buffered temporarily (currently up to
            about an hour) so a reconnecting client can catch up — it is not
            retained indefinitely. Avoid printing secrets to stdout in your own
            build/start scripts, since that output is visible to you (and only
            you) in the log stream.
          </Section>

          <Section title="3. How we use your data">
            Your data is used solely to operate the deployment pipeline: cloning
            your repository, building and running your container, routing traffic
            to it, and showing you its status and logs. We do not sell your data
            or share it with third parties for marketing.
          </Section>

          <Section title="4. Secrets and encryption">
            GitHub access tokens and webhook secrets are encrypted at rest before
            being stored. Environment variables you provide for your own
            deployments are passed to your container and written to a `.env` file
            inside its build context — treat this the same as you would any other
            place you&apos;d store application secrets.
          </Section>

          <Section title="5. Third parties">
            We use GitHub for authentication and repository access, and the
            infrastructure this service runs on (its hosting provider) to build
            and run your containers. We don&apos;t share your data with any other
            third party.
          </Section>

          <Section title="6. Your controls">
            You can disconnect any project (which removes its webhook from
            GitHub) at any time. You can permanently delete your account and every
            project/deployment record you own from the account menu — this cannot
            be undone. Deleting your account does not automatically stop
            already-running containers or remove GitHub webhooks; disconnect each
            project first if you want those cleaned up too.
          </Section>

          <Section title="7. Changes">
            We may update this policy as the product changes. Continuing to use
            DeployBox after an update means you accept the revised policy.
          </Section>

          <Section title="8. Contact">
            Questions about this policy can be sent to the project maintainer via
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
