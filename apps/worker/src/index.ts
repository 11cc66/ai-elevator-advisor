import {
  runWorkerBootstrap,
  safeWorkerStartupErrorCode,
} from "./bootstrap.js";

async function main(): Promise<void> {
  try {
    await runWorkerBootstrap();
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "worker.startup_rejected",
        errorCode: safeWorkerStartupErrorCode(error),
      }),
    );
    process.exitCode = 1;
  }
}

void main();
