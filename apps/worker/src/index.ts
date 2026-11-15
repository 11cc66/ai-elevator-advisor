import {
  FILE_MAINTENANCE_QUEUE,
  FILE_RECOGNITION_QUEUE,
  fileRecognitionJobSchema,
} from "@elevator/contracts";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";

import { readWorkerEnv } from "./config.js";
import { runFileMaintenance } from "./file-maintenance.js";
import { processFileRecognitionJob } from "./file-processing.js";
import { logger } from "./logger.js";
import { createWorkerStorage } from "./storage.js";
import { WORKER_SERVICE_NAME } from "./worker-identity.js";

async function startWorker(): Promise<void> {
  const env = readWorkerEnv();
  const prisma = new PrismaClient();
  const storage = createWorkerStorage(env);
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    application_name: WORKER_SERVICE_NAME,
    max: 4,
  });

  boss.on("error", (error) => {
    logger.error({ err: error, event: "pg_boss.error" }, "pg-boss error");
  });

  boss.on("warning", (warning) => {
    logger.warn(
      {
        event: "pg_boss.warning",
        message: warning.message,
      },
      "pg-boss warning",
    );
  });

  try {
    await boss.start({ attempts: 3 });

    await Promise.all([
      boss.createQueue(env.WORKER_QUEUE_NAME),
      boss.createQueue(FILE_RECOGNITION_QUEUE, {
        retryLimit: 2,
        retryDelay: 5,
        expireInSeconds: 180,
      }),
      boss.createQueue(FILE_MAINTENANCE_QUEUE, {
        retryLimit: 1,
        expireInSeconds: 120,
      }),
    ]);

    await boss.work<Record<string, unknown>>(
      env.WORKER_QUEUE_NAME,
      async (jobs) => {
        for (const job of jobs) {
          logger.info(
            {
              event: "worker.job_received",
              jobId: job.id,
              jobName: job.name,
            },
            "Worker job received",
          );
        }
        return { processed: jobs.length };
      },
    );

    await boss.work(
      FILE_RECOGNITION_QUEUE,
      {
        batchSize: 1,
        pollingIntervalSeconds: 1,
      },
      async (jobs) => {
        for (const job of jobs) {
          const parsed = fileRecognitionJobSchema.parse(job.data);
          const result = await processFileRecognitionJob(parsed);
          logger.info(
            {
              event: "file.job_finished",
              jobId: job.id,
              extractionId: parsed.extractionId,
              result,
            },
            "File recognition job finished",
          );
        }
        return { processed: jobs.length };
      },
    );

    await boss.work(
      FILE_MAINTENANCE_QUEUE,
      { batchSize: 1 },
      async () => {
        await runFileMaintenance({
          prisma,
          boss,
          storage,
          env,
        });
        return { processed: 1 };
      },
    );

    await boss.schedule(
      FILE_MAINTENANCE_QUEUE,
      "*/15 * * * *",
      {},
      { key: "regular-file-maintenance" },
    );
    await runFileMaintenance({
      prisma,
      boss,
      storage,
      env,
    });

    logger.info(
      {
        event: "worker.started",
        queues: [
          env.WORKER_QUEUE_NAME,
          FILE_RECOGNITION_QUEUE,
          FILE_MAINTENANCE_QUEUE,
        ],
        service: WORKER_SERVICE_NAME,
      },
      "Worker started",
    );
  } catch (error) {
    await boss.stop({ graceful: true, timeout: 10_000 }).catch(() => undefined);
    await prisma.$disconnect();
    throw error;
  }

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info({ event: "worker.stopping", signal }, "Worker stopping");

    try {
      await boss.stop({ graceful: true, timeout: 10_000 });
      await prisma.$disconnect();
      logger.info({ event: "worker.stopped", signal }, "Worker stopped");
      process.exitCode = 0;
    } catch (error) {
      logger.error(
        { err: error, event: "worker.stop_failed", signal },
        "Worker failed to stop cleanly",
      );
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

startWorker().catch((error: unknown) => {
  logger.fatal(
    { err: error, event: "worker.start_failed" },
    "Worker failed to start",
  );
  process.exitCode = 1;
});
