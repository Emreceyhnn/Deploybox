import { TRPCError } from "@trpc/server";
import { middleware } from "..";

export const errorHandler = middleware(async ({ path, type, next }) => {
  const result = await next();

  if (!result.ok) {
    const { error } = result;

    if (!(error instanceof TRPCError)) {
      console.error(`[trpc] unhandled error in ${type} ${path}:`, error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong",
        cause: error,
      });
    }

    if (error.code === "INTERNAL_SERVER_ERROR") {
      console.error(`[trpc] internal error in ${type} ${path}:`, error.cause ?? error);
    }
  }

  return result;
});
