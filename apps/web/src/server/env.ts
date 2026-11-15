import { z } from "zod";

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
