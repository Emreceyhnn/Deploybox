"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Skeleton,
} from "@mui/material";
import { DeleteOutlined, MoreVert, RocketLaunchOutlined } from "@mui/icons-material";
import { trpc } from "@/app/lib/trpc/client";
import { useToast } from "@/app/lib/toast/ToastProvider";
import { colors } from "@/app/theme";
import { ProjectsHeader } from "../../_components/ProjectsHeader";
import { ProjectDetailsHeader } from "./ProjectDetailsHeader";
import { ProjectInfoBar } from "./ProjectInfoBar";
import { DeploymentsList } from "./DeploymentsList";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { DeploymentLogsPanel } from "./DeploymentLogsPanel";
import { EnvVarsPanel } from "./EnvVarsPanel";
import { getProjectDomain, getProjectFullUrl } from "@/app/lib/domain";

const ACTIVE_STATUSES = ["queued", "clonning", "building"];

interface ProjectDetailsViewProps {
  id: string;
}

export function ProjectDetailsView({ id }: ProjectDetailsViewProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const { data: project, error: projectError, isLoading: projectLoading } =
    trpc.projects.getById.useQuery({ id });
  const { data: deployments } = trpc.deployments.list.useQuery(
    { projectId: id },
    {
      // Only keep polling while something is actually in flight; once every
      // deployment has settled into a terminal state, stop hammering the
      // server every 3s for no reason.
      refetchInterval: (query) => {
        const latest = query.state.data?.[0];
        return latest && ACTIVE_STATUSES.includes(latest.status) ? 3000 : false;
      },
    },
  );

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.getById.invalidate({ id });
      utils.projects.listWithLatestDeployment.invalidate();
    },
  });

  const triggerDeploy = trpc.deployments.trigger.useMutation({
    onSuccess: () => {
      utils.deployments.list.invalidate({ projectId: id });
      showToast("Deployment queued", "success");
    },
    onError: (err) => {
      showToast(`Failed to start deploy: ${err.message}`, "error");
    },
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.listWithLatestDeployment.invalidate();
      showToast("Project deleted", "success");
      router.push("/projects");
    },
    onError: (err) => {
      showToast(`Failed to delete project: ${err.message}`, "error");
    },
  });

  const rollback = trpc.deployments.rollback.useMutation({
    onSuccess: () => {
      utils.deployments.list.invalidate({ projectId: id });
      showToast("Rollback queued", "success");
    },
    onError: (err) => {
      showToast(`Failed to roll back: ${err.message}`, "error");
    },
  });

  if (projectLoading || (!project && !projectError)) {
    return (
      <Box sx={{ bgcolor: colors.bgPage, minHeight: "100vh", color: colors.textPrimary }}>
        <ProjectsHeader />
        <Box sx={{ maxWidth: "960px", mx: "auto", px: 3, pt: 6, pb: 10 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
            <Skeleton variant="text" width={280} height={40} sx={{ bgcolor: colors.bgSurfaceHover }} />
            <Skeleton
              variant="rounded"
              width={140}
              height={40}
              sx={{ bgcolor: colors.bgSurfaceHover, borderRadius: `${8}px` }}
            />
          </Box>
          <Skeleton
            variant="rounded"
            height={72}
            sx={{ bgcolor: colors.bgSurfaceHover, mb: 4, borderRadius: `${8}px` }}
          />
          <Skeleton variant="text" width={140} height={28} sx={{ bgcolor: colors.bgSurfaceHover, mb: 1 }} />
          <Skeleton
            variant="rounded"
            height={140}
            sx={{ bgcolor: colors.bgSurfaceHover, borderRadius: `${8}px` }}
          />
        </Box>
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ bgcolor: colors.bgPage, minHeight: "100vh", color: colors.textPrimary }}>
        <ProjectsHeader />
        <Box
          sx={{
            maxWidth: "960px",
            mx: "auto",
            px: 3,
            pt: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 1.5,
          }}
        >
          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Couldn&apos;t load this project</Typography>
          <Typography sx={{ color: colors.textMuted, fontSize: 14, maxWidth: 380 }}>
            It may have been deleted, or you may not have access to it.
          </Typography>
          <Button
            onClick={() => router.push("/projects")}
            variant="outlined"
            sx={{
              mt: 1,
              textTransform: "none",
              borderColor: colors.borderDefault,
              color: colors.textPrimary,
              "&:hover": { borderColor: colors.borderHover, bgcolor: colors.bgSurfaceHover },
            }}
          >
            Back to Projects
          </Button>
        </Box>
      </Box>
    );
  }

  const latestDeployment = deployments?.[0];
  const domain = getProjectDomain(project.subdomain, project.customDomain);
  const fullUrl = getProjectFullUrl(
    project.subdomain,
    project.customDomain,
    latestDeployment?.containerPort
  );
  const isDeploying = latestDeployment && ACTIVE_STATUSES.includes(latestDeployment.status);

  return (
    <Box sx={{ bgcolor: colors.bgPage, minHeight: "100vh", color: colors.textPrimary }}>
      <ProjectsHeader />

      <Box sx={{ maxWidth: "960px", mx: "auto", px: 3, pt: 6, pb: 10 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <ProjectDetailsHeader repoFullName={project.repoFullName} />

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              onClick={() => triggerDeploy.mutate({ projectId: project.id })}
              disabled={triggerDeploy.isPending}
              startIcon={<RocketLaunchOutlined fontSize="small" />}
              variant="contained"
              sx={{
                bgcolor: colors.brand,
                "&:hover": { bgcolor: colors.brandHover },
              }}
            >
              {triggerDeploy.isPending ? "Deploying…" : "Deploy"}
            </Button>

            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Project actions"
              sx={{
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: "8px",
                color: colors.textMuted,
                "&:hover": { bgcolor: colors.bgSurfaceHover, color: colors.textPrimary },
              }}
            >
              <MoreVert fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  setDeleteOpen(true);
                }}
                sx={{
                  fontSize: "13px",
                  color: colors.error,
                  gap: 1,
                  "&:hover": { bgcolor: "rgba(255,107,87,0.08)" },
                }}
              >
                <ListItemIcon sx={{ minWidth: "auto !important" }}>
                  <DeleteOutlined fontSize="small" sx={{ color: colors.error }} />
                </ListItemIcon>
                Delete project
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        <ProjectInfoBar
          domain={domain}
          fullUrl={fullUrl}
          defaultBranch={project.defaultBranch}
          containerPort={project.containerPort}
          isActive={project.isActive}
          isUpdating={updateProject.isPending}
          onToggleActive={(next) => updateProject.mutate({ id: project.id, isActive: next })}
        />

        {isDeploying && latestDeployment && (
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ fontSize: "18px", fontWeight: 700, mb: 1 }}>Live build output</Typography>
            <DeploymentLogsPanel key={latestDeployment.id} deploymentId={latestDeployment.id} />
          </Box>
        )}

        <Box sx={{ mt: 5 }}>
          <Typography sx={{ fontSize: "18px", fontWeight: 700, mb: 2 }}>Deployments</Typography>
          <DeploymentsList
            deployments={deployments ?? []}
            onRollback={(deploymentId) => rollback.mutate({ deploymentId })}
            isRollingBack={rollback.isPending}
          />
        </Box>

        <EnvVarsPanel projectId={project.id} />
      </Box>

      <DeleteProjectDialog
        open={deleteOpen}
        repoFullName={project.repoFullName}
        isDeleting={deleteProject.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteProject.mutate({ id: project.id })}
      />
    </Box>
  );
}
