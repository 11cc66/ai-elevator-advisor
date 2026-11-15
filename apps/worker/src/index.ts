import { PgBoss } from "pg-boss";

import { readWorkerEnv } from "./config.js";
import { logger } from "./logger.js";
import { WORKER_SERVICE_NAME } from "./worker-identity.js";

async function startWorker(): Promise<void> {
  const env = readWorkerEnv();
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    application_name: WORKER_SERVICE_NAME,
    max: 2,
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

  await boss.start({ attempts: 3 });
  await boss.createQueue(env.WORKER_QUEUE_NAME);
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

  logger.info(
    {
      event: "worker.started",
      queue: env.WORKER_QUEUE_NAME,
      service: WORKER_SERVICE_NAME,
    },
    "Worker started",
  );

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info({ event: "worker.stopping", signal }, "Worker stopping");

    try {
      await boss.stop({ graceful: true, timeout: 10_000 });
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
