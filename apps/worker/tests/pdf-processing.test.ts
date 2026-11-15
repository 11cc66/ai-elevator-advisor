import { Worker } from "node:worker_threads";

import { describe, expect, it } from "vitest";

import { extractImageMetadata } from "../src/image-metadata.js";
import {
  parsePdfInWorker,
  runWorkerWithDeadline,
} from "../src/pdf-parser-client.js";

function escapePdfText(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function createPdf(pageTexts: string[]): Buffer {
  const objects: string[] = [];
  const pageReferences = pageTexts.map(
    (_, index) => `${4 + index * 2} 0 R`,
  );
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageReferences.join(" ")}] /Count ${pageTexts.length} >>`,
  );
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );

  pageTexts.forEach((text, index) => {
    const contentObject = 5 + index * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`,
    );
    const stream = text
      ? `BT /F1 12 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`
      : "";
    objects.push(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

const limits = {
  maxPages: 10,
  maxCharacters: 10_000,
  timeoutMs: 15_000,
};

describe("PDF Worker Thread", () => {
  it("extracts two pages with page numbers and positions", async () => {
    const result = await parsePdfInWorker(
      createPdf(["First page text", "Second page text"]),
      limits,
    );

    expect(result.pageCount).toBe(2);
    expect(result.textLayerEmpty).toBe(false);
    expect(result.blocks.map((block) => block.pageNumber)).toEqual([
      1, 2,
    ]);
    expect(result.blocks[0]?.text).toContain("First page text");
    expect(result.blocks[1]?.text).toContain("Second page text");
    expect(result.blocks[0]?.positionData.x).toBeTypeOf("number");
    expect(result.blocks[0]?.positionData.y).toBeTypeOf("number");
  });

  it("reports a PDF without a text layer instead of inventing text", async () => {
    const result = await parsePdfInWorker(createPdf([""]), limits);

    expect(result.pageCount).toBe(1);
    expect(result.textLayerEmpty).toBe(true);
    expect(result.extractedText).toContain("[Page 1]");
  });

  it("rejects a damaged PDF", async () => {
    await expect(
      parsePdfInWorker(
        Buffer.from("%PDF-1.7\nthis is not a valid PDF body"),
        limits,
      ),
    ).rejects.toMatchObject({ code: "PDF_PARSE_FAILED" });
  });

  it("terminates a worker that exceeds the hard timeout", async () => {
    const worker = new Worker("while (true) {}", { eval: true });

    await expect(runWorkerWithDeadline(worker, 50)).rejects.toMatchObject({
      code: "PDF_WORKER_TIMEOUT",
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(worker.threadId).toBe(-1);
  });
});

describe("image metadata", () => {
  it("reads PNG dimensions without image recognition", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const metadata = extractImageMetadata(png);

    expect(metadata).toMatchObject({
      width: 1,
      height: 1,
      format: "png",
      fileSizeBytes: String(png.byteLength),
    });
  });

  it("rejects an image above the configured pixel limit", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    png.writeUInt32BE(10_000, 16);
    png.writeUInt32BE(10_000, 20);

    expect(() => extractImageMetadata(png, 40_000_000)).toThrow(
      "IMAGE_PIXEL_LIMIT_EXCEEDED",
    );
  });
});
