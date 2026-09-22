import { createTheme } from "@mui/material/styles";

/**
 * Single source of truth for DeployBox's dark theme. Every screen imports
 * `darkTheme` from here instead of declaring its own `createTheme()` — this
 * used to be duplicated byte-for-byte across ProjectsView and
 * ProjectDetailsView, which meant a palette change had to be made twice (or,
 * more realistically, only made in one place and silently drifted).
 *
 * Elevation ladder (page → surface → hover → sunken input), border, and
 * radius tokens are also centralized here so components reference `theme.*`
 * instead of hardcoding hex/px values inline.
 */

export const colors = {
  // Elevation ladder — each step should read as "one layer up" from the last.
  bgPage: "#17161b",
  bgSurface: "#1f1e24", // cards, dialogs, menus, popovers
  bgSurfaceHover: "#26252b", // hover/pressed state on a surface, and chip backgrounds
  bgSunken: "#0f0e12", // recessed elements: log panels, text inputs
  bgSunkenAlt: "#141318", // slightly lighter sunken tone, used for inline code/output blocks

  // Borders — two tones only: resting and hovered/focused-adjacent.
  borderDefault: "#3a383f",
  borderHover: "#5a5760",

  // Text
  textPrimary: "#f3f2f2",
  textMuted: "#9b979d", // body-adjacent muted text, meets AA at 12px+
  textFaint: "#7d7a82", // decorative-only (icons, disabled), never load-bearing copy
  textMono: "#7db8d8", // links/domains rendered in monospace

  // Brand
  brand: "#ec3013",
  brandHover: "#ff563c",

  // Semantic status
  success: "#4fbf79",
  error: "#ff6b57",
  warning: "#e8b34f",
  info: "#7db8d8",
} as const;

export const radius = {
  sm: 4, // chips, badges
  md: 8, // cards, dialogs, inputs, menus — the default for most surfaces
  full: "50%", // true circles only: avatars, dot indicators, icon-only round controls
} as const;

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: { default: colors.bgPage, paper: colors.bgSurface },
    primary: { main: colors.brand, light: colors.brandHover, dark: "#b52009", contrastText: "#ffffff" },
    error: { main: colors.error },
    success: { main: colors.success },
    warning: { main: colors.warning },
    text: { primary: colors.textPrimary, secondary: colors.textMuted },
  },
  typography: {
    fontFamily: "var(--font-geist-sans)",
    h1: { fontSize: 32, fontWeight: 700, letterSpacing: "-0.01em" },
    h2: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" },
    h3: { fontSize: 18, fontWeight: 700 },
    body1: { fontSize: 14, fontWeight: 400 },
    body2: { fontSize: 13, fontWeight: 400 },
    caption: { fontSize: 12, fontWeight: 500, color: colors.textMuted },
  },
  shape: {
    borderRadius: radius.md,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 6, fontWeight: 600 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.bgSurface,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: radius.md,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.bgSurface,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: radius.md,
        },
      },
    },
  },
});
