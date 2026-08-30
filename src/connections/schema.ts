import { z } from "zod";

const operationSchema = z.object({
  path: z.string().startsWith("/"),
  method: z.enum(["GET", "POST"]).default("POST"),
});

export const connectionProfileSchema = z.object({
  base_url: z.url(),
  token_env: z.string().min(1).optional(),
  timeout_ms: z.number().int().positive().max(120_000).default(10_000),
  retries: z.number().int().min(0).max(3).default(1),
  operations: z.record(z.string(), operationSchema).default({}),
});

export const connectionsSchema = z.object({
  connections: z.record(z.string(), connectionProfileSchema),
});

export type ConnectionProfile = z.infer<typeof connectionProfileSchema>;
export type ConnectionProfiles = z.infer<typeof connectionsSchema>;
