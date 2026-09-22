import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { deployments, deploymentStatusEnum } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import z from "zod";

const VALID_STATUSES = deploymentStatusEnum.enumValues;

const bodySchema = z.object({
  status: z.enum(VALID_STATUSES).optional().nullable(),
  imageTag: z.string().optional().nullable(),
  hostPort: z.number().int().optional().nullable(),
  containerPort: z.number().int().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  // The orchestrator (.NET) sends `startedAt?.ToString("o")`, which is `null`
  // rather than omitted when the DateTime? is unset.
  startedAt: z.string().datetime().optional().nullable(),
  finishedAt: z.string().datetime().optional().nullable(),
});

type DeploymentUpdate = Partial<InferInsertModel<typeof deployments>>;

function isAuthorized(request: Request): boolean {
  const expected = process.env.ORCHESTRATOR_API_TOKEN;
  // Fail closed: if the token isn't configured, refuse all requests rather
  // than silently accepting unauthenticated writes.
  if (!expected) return false;

  const provided = request.headers.get("x-orchestrator-token");
  return provided === expected;
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> | { id: string } }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = await props.params;
    const deploymentId = params.id;
    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: "Deployment ID is required" },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }
    const { status, imageTag, hostPort, containerPort, errorMessage, startedAt, finishedAt } =
      parsed.data;

    const updateData: DeploymentUpdate = {};

    if (status) {
      updateData.status = status;
    }
    if (imageTag !== undefined) {
      updateData.imageTag = imageTag;
    }
    const resolvedPort = hostPort ?? containerPort;
    if (resolvedPort !== undefined && resolvedPort !== null) {
      updateData.containerPort = resolvedPort;
    }
    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }
    if (startedAt) {
      updateData.startedAt = new Date(startedAt);
    }
    if (finishedAt) {
      updateData.finishedAt = new Date(finishedAt);
    }

    const [updated] = await db
      .update(deployments)
      .set(updateData)
      .where(eq(deployments.id, deploymentId))
      .returning();

    return NextResponse.json({ success: true, deployment: updated });
  } catch (error) {
    console.error("Error updating deployment status:", error);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
