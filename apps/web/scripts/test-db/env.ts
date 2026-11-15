import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = path.resolve(scriptDirectory, "../../../..");

loadEnv({
  path: path.join(workspaceRoot, ".env.test"),
  override: true,
  quiet: true,
});

const booleanFlag = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const credentialSchema = z
  .string()
  .min(12, "Test passwords must contain at least 12 characters")
  .max(128)
  .refine(
    (value) => !value.startsWith("REPLACE_WITH_"),
    "Test passwords must be replaced locally",
  );

const testEnvSchema = z
  .object({
    TEST_DATABASE_URL: z
      .string()
      .regex(
        /^postgres(?:ql)?:\/\//,
        "TEST_DATABASE_URL must be a PostgreSQL URL",
      ),
    TEST_DATABASE_ROLE: z.literal("elevator_test_app"),
    TEST_DATABASE_NAME: z.literal("elevator_advisor_test"),
    TEST_DATABASE_MARKER: z
      .string()
      .min(32)
      .refine(
        (value) => !value.startsWith("REPLACE_WITH_"),
        "TEST_DATABASE_MARKER must be replaced locally",
      ),
    TEST_DATABASE_CONFIRMATION: z.literal("elevator_advisor_test"),
    ALLOW_TEST_DB_INIT: booleanFlag,
    ALLOW_TEST_DB_RESET: booleanFlag,
    TEST_APP_BASE_URL: z.string().url(),
    TEST_PRIVATE_STORAGE_ROOT: z
      .string()
      .min(1)
      .default("storage/private-test"),
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32)
      .refine(
        (value) => !value.startsWith("REPLACE_WITH_"),
        "BETTER_AUTH_SECRET must be replaced locally",
      ),
    TEST_ADMIN_USERNAME: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[A-Za-z0-9_]+$/),
    TEST_ADMIN_NAME: z.string().trim().min(1).max(120),
    TEST_ADMIN_PASSWORD: credentialSchema,
    TEST_CUSTOMER_USERNAME: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[A-Za-z0-9_]+$/),
    TEST_CUSTOMER_NAME: z.string().trim().min(1).max(120),
    TEST_CUSTOMER_PASSWORD: credentialSchema,
    TEST_CUSTOMER_2_USERNAME: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[A-Za-z0-9_]+$/)
      .default("test_customer_2"),
    TEST_CUSTOMER_2_NAME: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .default("测试客户二"),
  })
  .superRefine((value, context) => {
    if (
      value.TEST_ADMIN_USERNAME.toLowerCase() ===
      value.TEST_CUSTOMER_USERNAME.toLowerCase()
    ) {
      context.addIssue({
        code: "custom",
        path: ["TEST_CUSTOMER_USERNAME"],
        message: "Test admin and customer usernames must differ",
      });
    }
  });

export type TestEnvironment = z.infer<typeof testEnvSchema>;

export class TestEnvironmentError extends Error {
  constructor(public readonly fields: string) {
    super(`Invalid test environment fields: ${fields}`);
    this.name = "TestEnvironmentError";
  }
}

export function readTestEnvironment(): TestEnvironment {
  const result = testEnvSchema.safeParse(process.env);

  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) => issue.path.join(".")),
      ),
    ].join(", ");
    throw new TestEnvironmentError(fields);
  }

  return result.data;
}
