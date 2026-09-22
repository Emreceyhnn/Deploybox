import { z } from "zod";

export const addDeploymentSchema = z.object({
  projectId: z.string(),
  branch: z.string(),
  commitSha: z.string(),
  triggerType: z.enum(["push", "manuel", "manual", "rollback"]),
  commitMessage: z.string().optional(),
  authorName: z.string().optional(),
  authorAvatarUrl: z.string().optional(),
  imageTag: z.string().optional(),
  containerPort: z.number().int().positive().optional(),
  rollbackOfDeploymentId: z.string().optional(),
});
