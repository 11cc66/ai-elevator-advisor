import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

import {
  readTestEnvironment,
  type TestEnvironment,
} from "../../scripts/test-db/env";
import {
  verifyTestDatabaseIdentity,
} from "../../scripts/test-db/guard";
import { resolveVerifiedTestStorageRoot } from "../../scripts/test-db/storage-root";

let workerProcess: ChildProcess | null = null;

async function stopWorker(): Promise<void> {
  if (!workerProcess || workerProcess.exitCode !== null) {
    return;
  }

  const exited = new Promise<void>((resolve) => {
    workerProcess?.once("exit", () => resolve());
  });
  workerProcess.kill("SIGTERM");

  await Promise.race([
    exited,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        workerProcess?.kill();
        resolve();
      }, 12_000),
    ),
  ]);
}

async function startWorker(
  testEnvironment: TestEnvironment,
  storageRoot: string,
): Promise<void> {
  const workspaceRoot = path.resolve(process.cwd(), "../..");
  const workerDirectory = path.join(workspaceRoot, "apps", "worker");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "tests/test-worker-entry.ts"],
    {
      cwd: workerDirectory,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: testEnvironment.TEST_DATABASE_URL,
        PRIVATE_STORAGE_ROOT: storageRoot,
        FILE_ACCESS_MODE: "test",
        PDF_MAX_PAGES: "200",
        PDF_MAX_TEXT_CHARS: "2000000",
        PDF_PARSE_TIMEOUT_MS: "60000",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  workerProcess = child;
  let output = "";

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("WORKER_START_TIMEOUT"));
    }, 20_000);

    const onData = (chunk: Buffer): void => {
      output += chunk.toString("utf8");
      if (output.includes('"event":"worker.started"')) {
        clearTimeout(timer);
        resolve();
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(
          `WORKER_EXITED_DURING_STARTUP:${code ?? "unknown"}`,
        ),
      );
    });
  });
}

export default async function globalSetup(): Promise<
  () => Promise<void>
> {
  const testEnvironment = readTestEnvironment();
  await verifyTestDatabaseIdentity("verify", testEnvironment);
  const storageRoot = await resolveVerifiedTestStorageRoot(
    path.resolve(process.cwd(), "../.."),
    testEnvironment.TEST_PRIVATE_STORAGE_ROOT,
  );
  await startWorker(testEnvironment, storageRoot);
  return stopWorker;
}
