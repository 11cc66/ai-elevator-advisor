import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const workerWorkspaceRoot = path.resolve(packageDirectory, "../..");

loadEnv({ path: path.join(workerWorkspaceRoot, ".env") });

const workerEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(?:ql)?:\/\//,
      "DATABASE_URL must use a PostgreSQL connection URL",
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  WORKER_QUEUE_NAME: z
    .string()
    .min(1)
    .max(100)
    .default("system-jobs"),
  PRIVATE_STORAGE_ROOT: z
    .string()
    .min(1)
    .default("storage/private"),
  FILE_ACCESS_MODE: z
    .enum(["enforce", "test"])
    .default("enforce"),
  PDF_MAX_PAGES: z.coerce.number().int().min(1).max(200).default(200),
  PDF_MAX_TEXT_CHARS: z.coerce
    .number()
    .int()
    .min(1)
    .max(2_000_000)
    .default(2_000_000),
  IMAGE_MAX_PIXELS: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000_000)
    .default(40_000_000),
  PDF_PARSE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(60_000),
  TEMP_RETENTION_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(3_600_000),
  TEST_DATABASE_NAME: z.string().optional(),
  TEST_DATABASE_ROLE: z.string().optional(),
  TEST_DATABASE_MARKER: z.string().optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function readWorkerEnv(
  source: NodeJS.ProcessEnv = process.env,
): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ].join(", ");
    throw new Error(`Invalid worker environment fields: ${fields}`);
  }

  return result.data;
}
