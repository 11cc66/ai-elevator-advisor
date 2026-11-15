import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageDirectory, "../..");

loadEnv({ path: path.join(workspaceRoot, ".env") });

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
