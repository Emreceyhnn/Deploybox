import { initTRPC } from "@trpc/server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        appErrorCode: error.code,
        appErrorMessage: error.message,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const baseProcedure = t.procedure;
