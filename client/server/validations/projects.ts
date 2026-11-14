import { z } from "zod";

export const addProjectSchema = z.object({
  // Single refine: a second refine would still run after the first one fails
  // (Zod runs all refinements), and an unguarded `new URL(value)` there would
  // throw out of safeParse() on user-supplied strings.
  githubRepo: z.string().refine((value) => {
    try {
      return new URL(value).hostname === "github.com";
    } catch {
      return false;
    }
  }),

  subdomain: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .refine((value) => {
      return value.length >= 3 && value.length <= 63;
    })
    .refine((v) => !["www", "api", "admin", "app"].includes(v.toLowerCase()), {
      message: "Bu subdomain ayrılmıştır (reserved).",
    }),

  customDomain: z.string().optional(),

  containerPort: z
    .number()
    .int()
    .positive()
    .refine((port) => port >= 1 && port <= 65535),

  envVars: z.string().optional(),

  isActive: z.boolean().default(true),
});
