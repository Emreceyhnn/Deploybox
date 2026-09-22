"use client";

import { ThemeProvider, CssBaseline } from "@mui/material";
import { darkTheme } from "@/app/theme";

// `createTheme()`'s returned object contains functions (breakpoint helpers,
// etc.) that aren't serializable across the server/client boundary, so
// `ThemeProvider` must live inside a Client Component rather than directly
// in the (Server Component) root layout.
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
