import "server-only";

import { cache } from "react";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc/context";
import { makeQueryClient } from "./query-client";

export const getQueryClient = cache(makeQueryClient);

export async function getServerHelpers() {
  return createServerSideHelpers({
    router: appRouter,
    ctx: await createContext(),
    queryClient: getQueryClient(),
  });
}
