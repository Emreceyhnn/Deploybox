import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import "./styles/globals.css";
import { TRPCProvider } from "./lib/trpc/Provider";
import { ToastProvider } from "./lib/toast/ToastProvider";
import { AppThemeProvider } from "./lib/theme/AppThemeProvider";
import { SITE_URL } from "./lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DeployBox — Push to a GitHub repo, get a live URL",
    template: "%s",
  },
  description: "Push to a GitHub repo, get a live URL.",
  applicationName: "DeployBox",
  robots: { index: true, follow: true },
  openGraph: {
    title: "DeployBox",
    description: "Push to a GitHub repo, get a live URL.",
    type: "website",
    siteName: "DeployBox",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeployBox",
    description: "Push to a GitHub repo, get a live URL.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppRouterCacheProvider>
          <AppThemeProvider>
            <TRPCProvider>
              <ToastProvider>{children}</ToastProvider>
            </TRPCProvider>
          </AppThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
