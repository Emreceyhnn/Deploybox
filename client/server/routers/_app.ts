import { router } from "../trpc";
import { publicProcedure } from "../trpc/procedures";
import { authRouter } from "./auth";
import { deploymentsRouter } from "./deployments";
import { projectsRouter } from "./projects";

export const appRouter = router({
  ping: publicProcedure.query(() => {
    return "pong";
  }),
  auth: authRouter,
  projects: projectsRouter,
  deployments: deploymentsRouter,
});

export type AppRouter = typeof appRouter;
