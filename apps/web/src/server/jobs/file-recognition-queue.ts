import type { FileRecognitionJob } from "@elevator/contracts";
import {
  buildFileProcessingRetryOptions,
  FILE_RECOGNITION_QUEUE,
} from "@elevator/contracts";
import { PgBoss } from "pg-boss";

import { readWebEnv } from "@/server/env";
import { logger } from "@/server/logger";

const globalForQueue = globalThis as unknown as {
  fileRecognitionBoss?: Promise<PgBoss>;
};

async function createBoss(): Promise<PgBoss> {
  const env = readWebEnv();
  const retryOptions = buildFileProcessingRetryOptions({
    maxAttempts: env.FILE_PROCESSING_MAX_ATTEMPTS,
    retryDelaySeconds: env.FILE_PROCESSING_RETRY_DELAY_SECONDS,
    retryDelayMaxSeconds: env.FILE_PROCESSING_RETRY_MAX_SECONDS,
    jobExpireSeconds: env.FILE_PROCESSING_JOB_EXPIRE_SECONDS,
  });
  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    application_name: "elevator-web-file-queue",
    max: 1,
  });

  boss.on("error", (error) => {
    logger.error(
      { err: error, event: "file_queue.error" },
      "File queue error",
    );
  });

  await boss.start({ attempts: 3 });
  await boss.createQueue(FILE_RECOGNITION_QUEUE, {
    ...retryOptions,
  });
  return boss;
}

async function getBoss(): Promise<PgBoss> {
  globalForQueue.fileRecognitionBoss ??= createBoss().catch((error) => {
    globalForQueue.fileRecognitionBoss = undefined;
    throw error;
  });
  return globalForQueue.fileRecognitionBoss;
}

export async function enqueueFileRecognition(
  job: FileRecognitionJob,
): Promise<void> {
  const boss = await getBoss();
  const env = readWebEnv();
  await boss.send(FILE_RECOGNITION_QUEUE, job, {
    singletonKey: job.extractionId,
    ...buildFileProcessingRetryOptions({
      maxAttempts: env.FILE_PROCESSING_MAX_ATTEMPTS,
      retryDelaySeconds: env.FILE_PROCESSING_RETRY_DELAY_SECONDS,
      retryDelayMaxSeconds: env.FILE_PROCESSING_RETRY_MAX_SECONDS,
      jobExpireSeconds: env.FILE_PROCESSING_JOB_EXPIRE_SECONDS,
    }),
  });
}
