import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  detectAllowedFileType,
  filenameMatchesMimeType,
  LegacyStorageCleanupDisabledError,
  LocalPrivateStorage,
  QuarantinedLegacyStorageCleanup,
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
  let legacyCleanup: QuarantinedLegacyStorageCleanup;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "elevator-files-"));
    storage = new LocalPrivateStorage(root);
    legacyCleanup = new QuarantinedLegacyStorageCleanup();
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
      fs.access(path.join(root, written.stagingKey)),
    ).resolves.toBeUndefined();
    await expect(
      storage.finalize("staging/demo.part", "objects/demo.bin"),
    ).resolves.toBeUndefined();
  });

  it("re-verifies staging after close and rejects replacement", async () => {
    const hookedStorage = new LocalPrivateStorage(root, {
      afterStagingClose: async () => {
        const stagingPath = path.join(root, "staging/replaced.part");
        await fs.unlink(stagingPath);
        await fs.writeFile(
          stagingPath,
          Buffer.alloc(PDF_BYTES.byteLength, 0x41),
        );
      },
    });

    await expect(
      hookedStorage.writeToStaging(
        "staging/replaced.part",
        Readable.from([PDF_BYTES]),
        20n * 1024n * 1024n,
      ),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_IDENTITY_CHANGED",
    });
  });

  it("rejects staging replaced with a symlink after close", async () => {
    const outside = path.join(root, "outside-staging");
    await fs.mkdir(outside, { recursive: true });
    const hookedStorage = new LocalPrivateStorage(root, {
      afterStagingClose: async () => {
        const stagingPath = path.join(root, "staging/linked.part");
        await fs.unlink(stagingPath);
        await fs.symlink(
          outside,
          stagingPath,
          process.platform === "win32" ? "junction" : "dir",
        );
      },
    });

    await expect(
      hookedStorage.writeToStaging(
        "staging/linked.part",
        Readable.from([PDF_BYTES]),
        20n * 1024n * 1024n,
      ),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_IDENTITY_CHANGED",
    });
  });

  it("rejects a target created before atomic no-overwrite finalize", async () => {
    const written = await storage.writeToStaging(
      "staging/target-race.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    const racedStorage = new LocalPrivateStorage(root, {
      beforeFinalizeLink: async () => {
        await fs.mkdir(path.join(root, "objects"), { recursive: true });
        await fs.writeFile(
          path.join(root, "objects/target-race.bin"),
          Buffer.from("other"),
        );
      },
    });

    await expect(
      racedStorage.finalize(
        written.stagingKey,
        "objects/target-race.bin",
        {
          sizeBytes: written.sizeBytes,
          checksumSha256: written.checksumSha256,
        },
      ),
    ).rejects.toMatchObject({ code: "STORAGE_OBJECT_EXISTS" });
  });

  it("verifies target identity and hash before retaining staging", async () => {
    const written = await storage.writeToStaging(
      "staging/target-change.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    const changedStorage = new LocalPrivateStorage(root, {
      afterFinalizeLink: async () => {
        const targetPath = path.join(root, "objects/target-change.bin");
        await fs.unlink(targetPath);
        await fs.writeFile(
          targetPath,
          Buffer.alloc(PDF_BYTES.byteLength, 0x43),
        );
      },
    });

    await expect(
      changedStorage.finalize(
        written.stagingKey,
        "objects/target-change.bin",
        {
          sizeBytes: written.sizeBytes,
          checksumSha256: written.checksumSha256,
        },
      ),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_CHECKSUM_MISMATCH",
    });
    await expect(
      fs.access(path.join(root, written.stagingKey)),
    ).resolves.toBeUndefined();
  });

  it("reads one verified object buffer without reopening the path", async () => {
    const written = await storage.writeToStaging(
      "staging/verified.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    await storage.finalize("staging/verified.part", "objects/verified.bin");

    const verified = await storage.readVerifiedObject({
      objectKey: "objects/verified.bin",
      expectedSizeBytes: written.sizeBytes,
      expectedChecksumSha256: written.checksumSha256,
      maxBytes: 20n * 1024n * 1024n,
    });

    expect(verified.bytes).toEqual(PDF_BYTES);
    expect(verified.sizeBytes).toBe(BigInt(PDF_BYTES.byteLength));
    expect(verified.checksumSha256).toBe(written.checksumSha256);

    await fs.writeFile(
      path.join(root, "objects/verified.bin"),
      Buffer.from("replaced"),
    );
    expect(verified.bytes).toEqual(PDF_BYTES);
  });

  it("rejects size, checksum and non-regular-object mismatches", async () => {
    const written = await storage.writeToStaging(
      "staging/mismatch.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    await storage.finalize("staging/mismatch.part", "objects/mismatch.bin");

    await expect(
      storage.readVerifiedObject({
        objectKey: "objects/mismatch.bin",
        expectedSizeBytes: written.sizeBytes + 1n,
        expectedChecksumSha256: written.checksumSha256,
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_OBJECT_SIZE_MISMATCH" });

    await expect(
      storage.readVerifiedObject({
        objectKey: "objects/mismatch.bin",
        expectedSizeBytes: written.sizeBytes,
        expectedChecksumSha256: "0".repeat(64),
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_CHECKSUM_MISMATCH",
    });

    await fs.mkdir(path.join(root, "objects/not-a-file"), {
      recursive: true,
    });
    await expect(
      storage.readVerifiedObject({
        objectKey: "objects/not-a-file",
        expectedSizeBytes: 1n,
        expectedChecksumSha256: "0".repeat(64),
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_OBJECT_NOT_REGULAR" });
  });

  it("rejects a final file identity change between precheck and open", async () => {
    const written = await storage.writeToStaging(
      "staging/identity.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    await storage.finalize("staging/identity.part", "objects/identity.bin");
    const objectPath = path.join(root, "objects/identity.bin");
    const replacement = Buffer.alloc(PDF_BYTES.byteLength, 0x41);
    const hookedStorage = new LocalPrivateStorage(root, {
      afterPrecheck: async () => {
        await fs.rename(objectPath, `${objectPath}.old`);
        await fs.writeFile(objectPath, replacement);
      },
    });

    await expect(
      hookedStorage.readVerifiedObject({
        objectKey: "objects/identity.bin",
        expectedSizeBytes: written.sizeBytes,
        expectedChecksumSha256: written.checksumSha256,
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_IDENTITY_CHANGED",
    });
  });

  it("rejects a parent directory identity change even when the file inode is unchanged", async () => {
    const written = await storage.writeToStaging(
      "staging/component.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    await fs.mkdir(path.join(root, "objects/component"), {
      recursive: true,
    });
    await storage.finalize(
      "staging/component.part",
      "objects/component/file.bin",
    );
    const componentPath = path.join(root, "objects/component");
    const movedPath = path.join(root, "objects/component-old");
    const hookedStorage = new LocalPrivateStorage(root, {
      afterPrecheck: async () => {
        await fs.rename(componentPath, movedPath);
        await fs.mkdir(componentPath);
        await fs.link(
          path.join(movedPath, "file.bin"),
          path.join(componentPath, "file.bin"),
        );
      },
    });

    await expect(
      hookedStorage.readVerifiedObject({
        objectKey: "objects/component/file.bin",
        expectedSizeBytes: written.sizeBytes,
        expectedChecksumSha256: written.checksumSha256,
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_IDENTITY_CHANGED",
    });
  });

  it("rejects file truncation during the same-handle read", async () => {
    const bytes = Buffer.concat([
      PDF_BYTES,
      Buffer.alloc(70 * 1024, 0x42),
    ]);
    const written = await storage.writeToStaging(
      "staging/truncate.part",
      Readable.from([bytes]),
      20n * 1024n * 1024n,
    );
    await storage.finalize("staging/truncate.part", "objects/truncate.bin");
    const objectPath = path.join(root, "objects/truncate.bin");
    let truncated = false;
    const hookedStorage = new LocalPrivateStorage(root, {
      afterReadChunk: async () => {
        if (!truncated) {
          truncated = true;
          await fs.truncate(objectPath, 16);
        }
      },
    });

    await expect(
      hookedStorage.readVerifiedObject({
        objectKey: "objects/truncate.bin",
        expectedSizeBytes: written.sizeBytes,
        expectedChecksumSha256: written.checksumSha256,
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_SIZE_MISMATCH",
    });
  });

  it("rejects file expansion during the same-handle read", async () => {
    const bytes = Buffer.concat([
      PDF_BYTES,
      Buffer.alloc(70 * 1024, 0x42),
    ]);
    const written = await storage.writeToStaging(
      "staging/expand.part",
      Readable.from([bytes]),
      20n * 1024n * 1024n,
    );
    await storage.finalize("staging/expand.part", "objects/expand.bin");
    const objectPath = path.join(root, "objects/expand.bin");
    let expanded = false;
    const hookedStorage = new LocalPrivateStorage(root, {
      afterReadChunk: async () => {
        if (!expanded) {
          expanded = true;
          await fs.appendFile(objectPath, Buffer.from([0x43]));
        }
      },
    });

    await expect(
      hookedStorage.readVerifiedObject({
        objectKey: "objects/expand.bin",
        expectedSizeBytes: written.sizeBytes,
        expectedChecksumSha256: written.checksumSha256,
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_SIZE_MISMATCH",
    });
  });

  it("rejects equal-size content changes during the same-handle read", async () => {
    const bytes = Buffer.concat([
      PDF_BYTES,
      Buffer.alloc(70 * 1024, 0x42),
    ]);
    const written = await storage.writeToStaging(
      "staging/rewrite.part",
      Readable.from([bytes]),
      20n * 1024n * 1024n,
    );
    await storage.finalize("staging/rewrite.part", "objects/rewrite.bin");
    const objectPath = path.join(root, "objects/rewrite.bin");
    let rewritten = false;
    const hookedStorage = new LocalPrivateStorage(root, {
      afterReadChunk: async () => {
        if (!rewritten) {
          rewritten = true;
          await fs.writeFile(
            objectPath,
            Buffer.alloc(bytes.byteLength, 0x43),
          );
        }
      },
    });

    await expect(
      hookedStorage.readVerifiedObject({
        objectKey: "objects/rewrite.bin",
        expectedSizeBytes: written.sizeBytes,
        expectedChecksumSha256: written.checksumSha256,
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_OBJECT_CHECKSUM_MISMATCH",
    });
  });

  it("rejects directory links instead of following them (Windows Junction / POSIX symlink)", async () => {
    const targetDirectory = path.join(root, "outside-target");
    const linkPath = path.join(root, "objects/link-directory");
    await fs.mkdir(targetDirectory, { recursive: true });
    await fs.writeFile(path.join(targetDirectory, "target.bin"), PDF_BYTES);
    await fs.mkdir(path.dirname(linkPath), { recursive: true });
    await fs.symlink(
      targetDirectory,
      linkPath,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(
      storage.readVerifiedObject({
        objectKey: "objects/link-directory/target.bin",
        expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
        expectedChecksumSha256: createHash("sha256")
          .update(PDF_BYTES)
          .digest("hex"),
        maxBytes: 20n * 1024n * 1024n,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_OBJECT_SYMLINK" });
  });

  it("classifies temporary access, resource and I/O errors without conflating them", async () => {
    const written = await storage.writeToStaging(
      "staging/errors.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    await storage.finalize("staging/errors.part", "objects/errors.bin");

    for (const [nativeCode, expectedCode] of [
      ["EACCES", "STORAGE_OBJECT_ACCESS_DENIED"],
      ["EMFILE", "STORAGE_RESOURCE_EXHAUSTED"],
      ["EIO", "STORAGE_IO_ERROR"],
    ] as const) {
      const hookedStorage = new LocalPrivateStorage(root, {
        afterPrecheck: () => {
          const error = new Error(nativeCode) as Error & {
            code: string;
          };
          error.code = nativeCode;
          throw error;
        },
      });

      await expect(
        hookedStorage.readVerifiedObject({
          objectKey: "objects/errors.bin",
          expectedSizeBytes: written.sizeBytes,
          expectedChecksumSha256: written.checksumSha256,
          maxBytes: 20n * 1024n * 1024n,
        }),
      ).rejects.toMatchObject({ code: expectedCode });
    }
  });

  it("rejects path traversal and preserves a failed staging write for recovery", async () => {
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
    ).resolves.toBeDefined();
  });

  it("fails closed for every legacy business-object deletion method", async () => {
    const written = await storage.writeToStaging(
      "staging/legacy-cleanup.part",
      Readable.from([PDF_BYTES]),
      20n * 1024n * 1024n,
    );
    const stagingPath = path.join(root, written.stagingKey);
    await expect(
      legacyCleanup.removeStaging(written.stagingKey),
    ).rejects.toBeInstanceOf(
      LegacyStorageCleanupDisabledError,
    );
    await expect(fs.access(stagingPath)).resolves.toBeUndefined();

    await storage.finalize(
      written.stagingKey,
      "objects/legacy-cleanup.bin",
    );
    const objectPath = path.join(root, "objects/legacy-cleanup.bin");
    await expect(
      legacyCleanup.removeObject("objects/legacy-cleanup.bin"),
    ).rejects.toBeInstanceOf(LegacyStorageCleanupDisabledError);
    await expect(fs.access(objectPath)).resolves.toBeUndefined();

    const old = new Date(Date.now() - 2 * 60 * 60_000);
    await fs.utimes(objectPath, old, old);
    await expect(
      legacyCleanup.cleanupOrphanObjects([], 60_000),
    ).rejects.toBeInstanceOf(LegacyStorageCleanupDisabledError);
    await expect(fs.access(objectPath)).resolves.toBeUndefined();

    const tempDirectory = path.join(root, "temp/legacy-entry");
    await fs.mkdir(tempDirectory, { recursive: true });
    await fs.writeFile(path.join(tempDirectory, "partial"), "temp");
    await fs.utimes(tempDirectory, old, old);
    await expect(
      legacyCleanup.cleanupTemp(60_000),
    ).rejects.toBeInstanceOf(LegacyStorageCleanupDisabledError);
    await expect(fs.access(tempDirectory)).resolves.toBeUndefined();
  });

  it("does not validate or resolve a legacy delete key before rejecting it", async () => {
    await expect(
      legacyCleanup.removeObject("../outside.bin"),
    ).rejects.toBeInstanceOf(LegacyStorageCleanupDisabledError);
    await expect(
      legacyCleanup.removeStaging("objects/not-staging.bin"),
    ).rejects.toBeInstanceOf(LegacyStorageCleanupDisabledError);
  });

  it("does not expose cleanup capability on ordinary storage", () => {
    expect("removeStaging" in storage).toBe(false);
    expect("removeObject" in storage).toBe(false);
    expect("cleanupOrphanObjects" in storage).toBe(false);
    expect("cleanupTemp" in storage).toBe(false);
  });
});
