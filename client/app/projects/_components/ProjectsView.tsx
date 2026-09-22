"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import { trpc } from "@/app/lib/trpc/client";
import { colors } from "@/app/theme";
import { ProjectsHeader } from "./ProjectsHeader";
import { PageTitle } from "./PageTitle";
import { ProjectsToolbar } from "./ProjectsToolbar";
import { EmptyState } from "./EmptyState";
import { ProjectCard } from "./ProjectCard";
import { AddProjectDialog } from "./AddProjectDialog";

const ACTIVE_STATUSES = ["queued", "clonning", "building"];

export function ProjectsView() {
  const { data: projects } = trpc.projects.listWithLatestDeployment.useQuery(undefined, {
    // Only poll while at least one project has a deployment actively in
    // flight; an idle list of already-deployed projects has nothing new to
    // show every 3 seconds.
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (p) => p.latestDeployment && ACTIVE_STATUSES.includes(p.latestDeployment.status),
      );
      return hasActive ? 3000 : false;
    },
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsList = projects ?? [];
  const hasProjects = projectsList.length > 0;

  return (
    <Box sx={{ bgcolor: colors.bgPage, minHeight: "100vh", color: colors.textPrimary }}>
      <ProjectsHeader />

      <Box sx={{ maxWidth: "960px", mx: "auto", px: 3, pt: 6, pb: 10 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            mb: 4,
          }}
        >
          <PageTitle>Projects</PageTitle>

          {hasProjects && <ProjectsToolbar onConnect={() => setDialogOpen(true)} />}
        </Box>

        {!hasProjects && <EmptyState onConnect={() => setDialogOpen(true)} />}

        {hasProjects && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            {projectsList.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                repoFullName={project.repoFullName}
                defaultBranch={project.defaultBranch}
                subdomain={project.subdomain}
                customDomain={project.customDomain}
                latestDeployment={project.latestDeployment}
              />
            ))}
          </Box>
        )}
      </Box>

      <AddProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Box>
  );
}
