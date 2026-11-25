import {
  buildFileProcessingRetryOptions,
  FILE_MAINTENANCE_QUEUE,
  FILE_RECOGNITION_QUEUE,
  fileRecognitionJobSchema,
} from "@elevator/contracts";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";

import { readWorkerEnv } from "./config.js";
import {
  runFileMaintenance,
  type FileMaintenanceQueue,
} from "./file-maintenance.js";
import { FileProcessingRetryError } from "./file-processing-errors.js";
import { processFileRecognitionJob } from "./file-processing.js";
import { logger } from "./logger.js";
import { createWorkerStorage } from "./storage.js";
import { WORKER_SERVICE_NAME } from "./worker-identity.js";

type MaintenanceRunner = typeof runFileMaintenance;
type MaintenanceScheduler = Pick<PgBoss, "work" | "schedule"> &
  FileMaintenanceQueue;

export async function registerFileMaintenanceJob(input: {
  boss: MaintenanceScheduler;
  prisma: PrismaClient;
  env: ReturnType<typeof readWorkerEnv>;
  maintenanceRunner?: MaintenanceRunner;
}): Promise<void> {
  const maintenanceRunner =
    input.maintenanceRunner ?? runFileMaintenance;

  await input.boss.work(
    FILE_MAINTENANCE_QUEUE,
    { batchSize: 1 },
    async () => {
      await maintenanceRunner({
        prisma: input.prisma,
        boss: input.boss,
        env: input.env,
      });
      return { processed: 1 };
    },
  );

  await input.boss.schedule(
    FILE_MAINTENANCE_QUEUE,
    "*/15 * * * *",
    {},
    { key: "regular-file-maintenance" },
  );
  await maintenanceRunner({
    prisma: input.prisma,
    boss: input.boss,
    env: input.env,
  });
}

export async function startWorker(): Promise<void> {
  const env = readWorkerEnv();
  const prisma = new PrismaClient();
  const storage = createWorkerStorage(env);
  const recognitionRetryOptions = buildFileProcessingRetryOptions({
    maxAttempts: env.FILE_PROCESSING_MAX_ATTEMPTS,
    retryDelaySeconds: env.FILE_PROCESSING_RETRY_DELAY_SECONDS,
    retryDelayMaxSeconds: env.FILE_PROCESSING_RETRY_MAX_SECONDS,
    jobExpireSeconds: env.FILE_PROCESSING_JOB_EXPIRE_SECONDS,
  });
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
        ...recognitionRetryOptions,
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
          try {
            const result = await processFileRecognitionJob(parsed, {
              jobId: job.id,
              storage,
            });
            logger.info(
              {
                event: "file.job_finished",
                jobId: job.id,
                extractionId: parsed.extractionId,
                retryCount: job.retryCount,
                result,
              },
              "File recognition job finished",
            );
          } catch (error) {
            logger.warn(
              {
                event: "file.job_retry_pending",
                jobId: job.id,
                extractionId: parsed.extractionId,
                retryCount: job.retryCount,
                retryScheduled:
                  error instanceof FileProcessingRetryError,
              },
              "File recognition job will be retried by pg-boss",
            );
            throw error;
          }
        }
        return { processed: jobs.length };
      },
    );

    await registerFileMaintenanceJob({
      boss,
      prisma,
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
