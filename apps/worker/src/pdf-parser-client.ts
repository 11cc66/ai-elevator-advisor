import path from "node:path";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";

export interface PdfParserLimits {
  maxPages: number;
  maxCharacters: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface PdfParserBlock {
  pageNumber: number;
  blockIndex: number;
  text: string;
  sourceKind: "PDF_TEXT_LAYER";
  sourceRef: string;
  positionData: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  characterCount: number;
}

export interface PdfParserResult {
  pageCount: number;
  extractedText: string;
  outputCharacterCount: number;
  blocks: PdfParserBlock[];
  textLayerEmpty: boolean;
}

interface WorkerMessage {
  ok: boolean;
  result?: PdfParserResult;
  code?: string;
}

export class PdfParserError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PdfParserError";
  }
}

export async function runWorkerWithDeadline<T>(
  worker: Worker,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timeoutTriggered = false;
    let abortReason: Error | null = null;

    const finishWithError = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortHandler);
      reject(error);
    };

    const finishWithResult = (result: T): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abortHandler);
      void worker.terminate();
      resolve(result);
    };

    const abortHandler = (): void => {
      abortReason =
        signal?.reason instanceof Error
          ? signal.reason
          : new Error("PDF_WORKER_ABORTED");
      void worker.terminate().finally(() => {
        finishWithError(abortReason ?? new Error("PDF_WORKER_ABORTED"));
      });
    };

    const timer = setTimeout(() => {
      timeoutTriggered = true;
      void worker.terminate().finally(() => {
        finishWithError(new PdfParserError("PDF_WORKER_TIMEOUT"));
      });
    }, timeoutMs);

    if (signal?.aborted) {
      abortHandler();
    } else {
      signal?.addEventListener("abort", abortHandler, { once: true });
    }

    worker.once("message", (message: WorkerMessage) => {
      if (abortReason) {
        finishWithError(abortReason);
        return;
      }
      if (message.ok && message.result) {
        finishWithResult(message.result as T);
      } else {
        void worker.terminate();
        finishWithError(
          new PdfParserError(message.code ?? "PDF_PARSE_FAILED"),
        );
      }
    });

    worker.once("error", () => {
      void worker.terminate();
      finishWithError(
        abortReason ?? new PdfParserError("PDF_WORKER_ERROR"),
      );
    });

    worker.once("exit", (code) => {
      if (!settled) {
        finishWithError(
          abortReason ??
            new PdfParserError(
              timeoutTriggered
                ? "PDF_WORKER_TIMEOUT"
                : code === 0
                  ? "PDF_WORKER_EXITED"
                  : "PDF_WORKER_CRASHED",
            ),
        );
      }
    });
  });
}

export async function parsePdfInWorker(
  data: Uint8Array,
  limits: PdfParserLimits,
): Promise<PdfParserResult> {
  const currentFile = fileURLToPath(import.meta.url);
  const isTypeScript = path.extname(currentFile) === ".ts";
  const workerFile = fileURLToPath(
    new URL(
      isTypeScript
        ? "./pdf-extractor.worker.ts"
        : "./pdf-extractor.worker.js",
      import.meta.url,
    ),
  );
  const worker = new Worker(workerFile, {
    workerData: {
      data,
      maxPages: limits.maxPages,
      maxCharacters: limits.maxCharacters,
    },
    execArgv: isTypeScript ? ["--import", "tsx"] : undefined,
    resourceLimits: {
      maxOldGenerationSizeMb: 384,
      maxYoungGenerationSizeMb: 64,
    },
  });

  return runWorkerWithDeadline<PdfParserResult>(
    worker,
    limits.timeoutMs,
    limits.signal,
  );
}
