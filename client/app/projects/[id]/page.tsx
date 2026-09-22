import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getServerHelpers, getQueryClient } from "@/app/lib/trpc/server";
import { ProjectDetailsView } from "./_components/ProjectDetailsView";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const helpers = await getServerHelpers();

  await Promise.all([
    helpers.projects.getById.prefetch({ id }),
    helpers.deployments.list.prefetch({ projectId: id }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ProjectDetailsView id={id} />
    </HydrationBoundary>
  );
}
