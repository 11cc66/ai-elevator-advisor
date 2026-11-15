import { z } from "zod";

import { FILE_PROCESSING_RETRY_DEFAULTS } from "@elevator/contracts";

const webEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(?:ql)?:\/\//,
      "DATABASE_URL must use a PostgreSQL connection URL",
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must contain at least 32 characters")
    .refine(
      (value) => !value.startsWith("REPLACE_WITH_"),
      "BETTER_AUTH_SECRET must be replaced locally",
    ),
  PRIVATE_STORAGE_ROOT: z.string().min(1).default("storage/private"),
  FILE_ACCESS_MODE: z.enum(["enforce", "test"]).default("enforce"),
  FILE_PROCESSING_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(FILE_PROCESSING_RETRY_DEFAULTS.maxAttempts),
  FILE_PROCESSING_RETRY_DELAY_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(300)
    .default(FILE_PROCESSING_RETRY_DEFAULTS.retryDelaySeconds),
  FILE_PROCESSING_RETRY_MAX_SECONDS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3_600)
    .default(FILE_PROCESSING_RETRY_DEFAULTS.retryDelayMaxSeconds),
  FILE_PROCESSING_JOB_EXPIRE_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3_600)
    .default(FILE_PROCESSING_RETRY_DEFAULTS.jobExpireSeconds),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function readWebEnv(
  source: NodeJS.ProcessEnv = process.env,
): WebEnv {
  const result = webEnvSchema.safeParse(source);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ].join(", ");
    throw new Error(`Invalid web environment fields: ${fields}`);
  }

  return result.data;
}
