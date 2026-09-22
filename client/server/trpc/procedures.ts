import { baseProcedure } from ".";
import { errorHandler } from "./middleware/errorHandler";
import { isAuthed } from "./middleware/isAuthed";

export const publicProcedure = baseProcedure.use(errorHandler);
export const protectedProcedure = baseProcedure.use(errorHandler).use(isAuthed);
