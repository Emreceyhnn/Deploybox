import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getServerHelpers, getQueryClient } from "@/app/lib/trpc/server";
import { ProjectsView } from "./_components/ProjectsView";

export default async function ProjectsPage() {
  const helpers = await getServerHelpers();
  await helpers.projects.listWithLatestDeployment.prefetch();

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ProjectsView />
    </HydrationBoundary>
  );
}
