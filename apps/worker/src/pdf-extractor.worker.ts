import { parentPort, workerData } from "node:worker_threads";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

interface PdfWorkerInput {
  data: Uint8Array;
  maxPages: number;
  maxCharacters: number;
}

interface PdfTextBlock {
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

interface PdfWorkerResult {
  pageCount: number;
  extractedText: string;
  outputCharacterCount: number;
  blocks: PdfTextBlock[];
  textLayerEmpty: boolean;
}

async function extractPdf(input: PdfWorkerInput): Promise<PdfWorkerResult> {
  const loadingTask = getDocument({
    data: input.data,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const document = await loadingTask.promise;

  try {
    if (document.numPages > input.maxPages) {
      throw Object.assign(new Error("PDF_PAGE_LIMIT_EXCEEDED"), {
        code: "PDF_PAGE_LIMIT_EXCEEDED",
      });
    }

    const blocks: PdfTextBlock[] = [];
    const pageTexts: string[] = [];
    let outputCharacterCount = 0;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageItems: string[] = [];
      let blockIndex = 0;

      for (const item of content.items) {
        if (!("str" in item) || !item.str) {
          continue;
        }

        outputCharacterCount += item.str.length;
        if (outputCharacterCount > input.maxCharacters) {
          throw Object.assign(new Error("PDF_TEXT_LIMIT_EXCEEDED"), {
            code: "PDF_TEXT_LIMIT_EXCEEDED",
          });
        }

        const transform = Array.isArray(item.transform)
          ? item.transform
          : [1, 0, 0, 1, 0, 0];
        const text = item.str.trim();
        if (text) {
          pageItems.push(text);
          blocks.push({
            pageNumber,
            blockIndex,
            text,
            sourceKind: "PDF_TEXT_LAYER",
            sourceRef: `pdf:page:${pageNumber}:item:${blockIndex}`,
            positionData: {
              x: Number(transform[4] ?? 0),
              y: Number(transform[5] ?? 0),
              width: Number(item.width ?? 0),
              height: Number(item.height ?? 0),
            },
            characterCount: item.str.length,
          });
          blockIndex += 1;
        }
      }

      pageTexts.push(`[Page ${pageNumber}]\n${pageItems.join(" ")}`);
      page.cleanup();
    }

    return {
      pageCount: document.numPages,
      extractedText: pageTexts.join("\n\n"),
      outputCharacterCount,
      blocks,
      textLayerEmpty: blocks.length === 0,
    };
  } finally {
    await loadingTask.destroy();
  }
}

const port = parentPort;

if (port) {
  void extractPdf(workerData as PdfWorkerInput)
    .then((result) => {
      port.postMessage({ ok: true, result });
    })
    .catch((error: unknown) => {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "PDF_PARSE_FAILED";
      port.postMessage({ ok: false, code });
    });
}
