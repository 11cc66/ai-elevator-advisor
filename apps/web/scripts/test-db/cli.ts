import { spawn } from "node:child_process";
import path from "node:path";

import {
  readTestEnvironment,
  TestEnvironmentError,
  workspaceRoot,
} from "./env.js";
import {
  TestDatabaseIdentityError,
  verifyTestDatabaseIdentity,
  type DatabaseGuardMode,
} from "./guard.js";
import { seedTestDatabase } from "./seed.js";

type Command = "init" | "reset" | "verify";

function readCommand(): Command {
  const command = process.argv[2];

  if (command === "init" || command === "reset" || command === "verify") {
    return command;
  }

  throw new Error("TEST_DB_COMMAND_INVALID");
}

async function runPrismaCommand(
  args: string[],
  testDatabaseUrl: string,
  errorCode: string,
): Promise<void> {
  const prismaCli = path.join(
    workspaceRoot,
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCli, ...args], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
      },
      stdio: "inherit",
      windowsHide: true,
    });

    child.once("error", () => reject(new Error(errorCode)));
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(errorCode));
      }
    });
  });
}

async function main(): Promise<void> {
  const command = readCommand();
  const env = readTestEnvironment();
  const mode: DatabaseGuardMode =
    command === "init"
      ? "init"
      : command === "reset"
        ? "reset"
        : "verify";

  await verifyTestDatabaseIdentity(mode, env);

  if (command === "reset") {
    await runPrismaCommand(
      [
        "migrate",
        "reset",
        "--force",
        "--skip-seed",
        "--skip-generate",
        "--schema",
        path.join(workspaceRoot, "prisma", "schema.prisma"),
      ],
      env.TEST_DATABASE_URL,
      "PRISMA_RESET_FAILED",
    );
    await seedTestDatabase(env);
  }

  if (command === "init") {
    await runPrismaCommand(
      [
        "migrate",
        "deploy",
        "--schema",
        path.join(workspaceRoot, "prisma", "schema.prisma"),
      ],
      env.TEST_DATABASE_URL,
      "PRISMA_DEPLOY_FAILED",
    );
    await seedTestDatabase(env);
  }

  const result = await verifyTestDatabaseIdentity("verify", env);
  console.log(
    JSON.stringify({
      command,
      databaseName: result.databaseName,
      databaseRole: result.databaseRole,
      markerVerified: result.markerVerified,
      developmentUrlDiffers: result.developmentUrlDiffers,
    }),
  );
}

main().catch((error: unknown) => {
  if (error instanceof TestDatabaseIdentityError) {
    console.error(`test_db_guard_failed=${error.code}`);
  } else if (error instanceof TestEnvironmentError) {
    console.error(`test_environment_invalid_fields=${error.fields}`);
  } else {
    console.error(
      `test_db_command_failed=${error instanceof Error ? error.name : "UnknownError"}`,
    );
  }
  process.exitCode = 1;
});
