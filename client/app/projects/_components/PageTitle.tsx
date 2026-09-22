import { Typography } from "@mui/material";

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <Typography variant="h1">{children}</Typography>;
}
