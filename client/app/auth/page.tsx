"use client";

import { Box, Button, Typography } from "@mui/material";
import { signIn } from "next-auth/react";
import NextLink from "next/link";
import { colors } from "@/app/theme";

export default function AuthPage() {
  return (
    <Box
      sx={{
        backgroundColor: colors.bgPage,
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        px: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          width: "100%",
          maxWidth: 360,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <Typography variant="h1" sx={{ fontSize: 28 }}>
            Sign in to DeployBox
          </Typography>
          <Typography sx={{ fontSize: 14, color: colors.textMuted, fontWeight: 400 }}>
            Connect a repo, push to deploy. No credit card, no config files.
          </Typography>
        </Box>
        <Button
          onClick={() => signIn("github", { callbackUrl: "/projects" })}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: "12px",
            width: "100%",
            padding: "14px 20px",
            color: colors.bgPage,
            border: `1px solid ${colors.textPrimary}`,
            borderRadius: "8px",
            fontFamily: "var(--font-geist-sans)",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
            backgroundColor: colors.textPrimary,
            textTransform: "none",
            "&:hover": {
              backgroundColor: "#d8d6db",
            },
            "&:focus-visible": {
              outline: "2px solid #7db8d8",
              outlineOffset: "3px",
            },
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
            style={{ flex: "none" }}
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.02 1.93-.02 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          Continue with GitHub
        </Button>
        <Typography sx={{ fontSize: 12, color: colors.textFaint, maxWidth: 320, lineHeight: 1.5 }}>
          We request read access to your repositories and commit status, plus
          permission to create deploy webhooks — never write or admin access.
          By continuing you agree to our{" "}
          <NextLink href="/terms" style={{ color: colors.textMuted, textDecoration: "underline" }}>
            Terms
          </NextLink>{" "}
          and{" "}
          <NextLink href="/privacy" style={{ color: colors.textMuted, textDecoration: "underline" }}>
            Privacy Policy
          </NextLink>
          .
        </Typography>
      </Box>
    </Box>
  );
}
