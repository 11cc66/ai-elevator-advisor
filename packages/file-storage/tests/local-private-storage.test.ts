import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  detectAllowedFileType,
  filenameMatchesMimeType,
  LocalPrivateStorage,
  sanitizeDisplayFilename,
} from "../src/index.js";

const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
  0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xd9,
]);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("private file storage", () => {
  let root = "";
  let storage: LocalPrivateStorage;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "elevator-files-"));
    storage = new LocalPrivateStorage(root);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("sanitizes path-like and control-character filenames", () => {
    expect(sanitizeDisplayFilename("../folder\\bad\u0000.pdf")).toBe(
      "bad.pdf",
    );
    expect(sanitizeDisplayFilename("  ")).toBe("file");
  });

  it("detects allowed PDF, JPEG and PNG content from bytes", async () => {
    const pdf = await detectAllowedFileType(PDF_BYTES);
    const jpeg = await detectAllowedFileType(JPEG_BYTES);
    const png = await detectAllowedFileType(PNG_BYTES);

    expect(pdf.mimeType).toBe("application/pdf");
    expect(jpeg.mimeType).toBe("image/jpeg");
    expect(png.mimeType).toBe("image/png");
    expect(filenameMatchesMimeType("drawing.PDF", pdf.mimeType)).toBe(
      true,
    );
    expect(filenameMatchesMimeType("drawing.exe", pdf.mimeType)).toBe(
      false,
    );
  });

  it("streams to a private staging file, hashes it and finalizes it", async () => {
    const written = await storage.writeToStaging(
      "staging/demo.part",
      Readable.from([PDF_BYTES.subarray(0, 10), PDF_BYTES.subarray(10)]),
      20n * 1024n * 1024n,
    );

    expect(written.sizeBytes).toBe(BigInt(PDF_BYTES.byteLength));
    expect(written.checksumSha256).toMatch(/^[a-f0-9]{64}$/);

    await storage.finalize("staging/demo.part", "objects/demo.bin");
    const integrity = await storage.verifyObjectChecksum(
      "objects/demo.bin",
      written.checksumSha256,
    );

    expect(integrity.valid).toBe(true);
    await expect(
      storage.finalize("staging/demo.part", "objects/demo.bin"),
    ).rejects.toBeDefined();
  });

  it("rejects path traversal and sizes over the configured limit", async () => {
    await expect(
      storage.writeToStaging(
        "../outside.part",
        Readable.from([Buffer.from("x")]),
        10n,
      ),
    ).rejects.toBeDefined();

    await expect(
      storage.writeToStaging(
        "staging/too-large.part",
        Readable.from([Buffer.alloc(11)]),
        10n,
      ),
    ).rejects.toBeDefined();

    await expect(
      fs.stat(path.join(root, "staging", "too-large.part")),
    ).rejects.toBeDefined();
  });
});
