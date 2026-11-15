import { z } from "zod";

export const healthStatusSchema = z.enum(["ok", "degraded"]);

export const healthCheckSchema = z.object({
  status: healthStatusSchema,
  service: z.literal("web"),
  timestamp: z.string().datetime({ offset: true }),
  durationMs: z.number().int().nonnegative(),
  checks: z.object({
    database: z.enum(["ok", "unavailable"]),
  }),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
    timestamp: z.string().datetime({ offset: true }),
  }),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
