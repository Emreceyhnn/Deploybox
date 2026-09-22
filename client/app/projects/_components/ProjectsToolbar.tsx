"use client";

import { Button } from "@mui/material";

export function ProjectsToolbar({ onConnect }: { onConnect: () => void }) {
  return (
    <Button
      onClick={onConnect}
      variant="contained"
      sx={{
        px: "22px",
        py: "10px",
        fontSize: "14px",
      }}
    >
      + Connect Repo
    </Button>
  );
}
