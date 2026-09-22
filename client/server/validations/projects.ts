import { z } from "zod";

export const addProjectSchema = z.object({
  githubRepo: z
    .string()
    .refine((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    })
    .refine((value) => {
      const url = new URL(value);
      return url.hostname === "github.com";
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
