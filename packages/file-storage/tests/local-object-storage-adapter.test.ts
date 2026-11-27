import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LocalObjectStorageAdapter,
  ObjectStorageError,
} from "../src/index.js";

const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");

describe("LocalObjectStorageAdapter", () => {
  let root = "";
  let adapter: LocalObjectStorageAdapter;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "elevator-objects-"));
    adapter = new LocalObjectStorageAdapter(root);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("persists and discovers one exact immutable version", async () => {
    const checksum = createHash("sha256").update(PDF_BYTES).digest("hex");
    const written = await adapter.writeImmutable({
      objectKey: "objects/exact-1",
      source: Readable.from([PDF_BYTES]),
      expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
      expectedChecksumSha256: checksum,
      idempotencyKey: "attempt-1",
    });

    const discovered = await adapter.discoverExact({
      objectKey: "objects/exact-1",
      idempotencyKey: "attempt-1",
      expectedSizeBytes: written.sizeBytes,
      expectedChecksumSha256: checksum,
      maxBytes: 1024n,
    });
    expect(discovered.status).toBe("FOUND");
    if (discovered.status !== "FOUND") {
      throw new Error("EXPECTED_FOUND");
    }
    expect(discovered.version.providerVersionId).toBe(
      written.version.providerVersionId,
    );

    const read = await adapter.readExact({
      version: written.version,
      expectedSizeBytes: written.sizeBytes,
      expectedChecksumSha256: checksum,
      maxBytes: 1024n,
    });
    expect(read.bytes).toEqual(PDF_BYTES);
  });

  it("returns NOT_FOUND without inventing a version", async () => {
    await expect(
      adapter.discoverExact({
        objectKey: "objects/missing",
        idempotencyKey: "attempt-missing",
        expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
        expectedChecksumSha256: createHash("sha256")
          .update(PDF_BYTES)
          .digest("hex"),
        maxBytes: 1024n,
      }),
    ).resolves.toMatchObject({ status: "NOT_FOUND" });
  });

  it("rejects an existing object key instead of overwriting it", async () => {
    const checksum = createHash("sha256").update(PDF_BYTES).digest("hex");
    await adapter.writeImmutable({
      objectKey: "objects/no-overwrite",
      source: Readable.from([PDF_BYTES]),
      expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
      expectedChecksumSha256: checksum,
      idempotencyKey: "attempt-no-overwrite-1",
    });

    await expect(
      adapter.writeImmutable({
        objectKey: "objects/no-overwrite",
        source: Readable.from([PDF_BYTES]),
        expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
        expectedChecksumSha256: checksum,
        idempotencyKey: "attempt-no-overwrite-2",
      }),
    ).rejects.toMatchObject({
      code: "OBJECT_STORAGE_NO_OVERWRITE_UNSUPPORTED",
    });
  });

  it("rejects a linked parent directory", async () => {
    const outside = path.join(root, "outside");
    await fs.mkdir(outside, { recursive: true });
    await fs.symlink(
      outside,
      path.join(root, "objects"),
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(
      adapter.writeImmutable({
        objectKey: "objects/linked",
        source: Readable.from([PDF_BYTES]),
        expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
        expectedChecksumSha256: createHash("sha256")
          .update(PDF_BYTES)
          .digest("hex"),
        idempotencyKey: "attempt-linked",
      }),
    ).rejects.toBeInstanceOf(ObjectStorageError);
  });

  it("rejects a parent replacement between precheck and open", async () => {
    const outside = path.join(root, "outside-open");
    await fs.mkdir(outside, { recursive: true });
    await fs.mkdir(path.join(root, "objects"), { recursive: true });
    const changingAdapter = new LocalObjectStorageAdapter(root, {
      afterWritePathPrepared: async () => {
        await fs.rename(
          path.join(root, "objects"),
          path.join(root, "objects-old"),
        );
        await fs.symlink(
          outside,
          path.join(root, "objects"),
          process.platform === "win32" ? "junction" : "dir",
        );
      },
    });

    await expect(
      changingAdapter.writeImmutable({
        objectKey: "objects/race-open",
        source: Readable.from([PDF_BYTES]),
        expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
        expectedChecksumSha256: createHash("sha256")
          .update(PDF_BYTES)
          .digest("hex"),
        idempotencyKey: "attempt-race-open",
      }),
    ).rejects.toBeInstanceOf(ObjectStorageError);
    await expect(
      fs.access(path.join(outside, "race-open")),
    ).rejects.toBeDefined();
  });

  it("rejects a parent replacement after open verification", async () => {
    const outside = path.join(root, "outside-after-open");
    await fs.mkdir(outside, { recursive: true });
    await fs.mkdir(path.join(root, "objects"), { recursive: true });
    const changingAdapter = new LocalObjectStorageAdapter(root, {
      afterPostOpenVerification: async () => {
        await fs.rename(
          path.join(root, "objects"),
          path.join(root, "objects-old"),
        );
        await fs.symlink(
          outside,
          path.join(root, "objects"),
          process.platform === "win32" ? "junction" : "dir",
        );
      },
    });

    await expect(
      changingAdapter.writeImmutable({
        objectKey: "objects/race-after-open",
        source: Readable.from([PDF_BYTES]),
        expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
        expectedChecksumSha256: createHash("sha256")
          .update(PDF_BYTES)
          .digest("hex"),
        idempotencyKey: "attempt-race-after-open",
      }),
    ).rejects.toBeInstanceOf(ObjectStorageError);
  });

  it("rejects a parent replacement during exact read", async () => {
    const checksum = createHash("sha256").update(PDF_BYTES).digest("hex");
    const written = await adapter.writeImmutable({
      objectKey: "objects/read-race",
      source: Readable.from([PDF_BYTES]),
      expectedSizeBytes: BigInt(PDF_BYTES.byteLength),
      expectedChecksumSha256: checksum,
      idempotencyKey: "attempt-read-race",
    });
    const outside = path.join(root, "outside-read");
    await fs.mkdir(outside, { recursive: true });
    const changingAdapter = new LocalObjectStorageAdapter(root, {
      afterRead: async () => {
        await fs.rename(
          path.join(root, "objects"),
          path.join(root, "objects-old"),
        );
        await fs.symlink(
          outside,
          path.join(root, "objects"),
          process.platform === "win32" ? "junction" : "dir",
        );
      },
    });

    await expect(
      changingAdapter.readExact({
        version: written.version,
        expectedSizeBytes: written.sizeBytes,
        expectedChecksumSha256: checksum,
        maxBytes: 1024n,
      }),
    ).rejects.toBeInstanceOf(ObjectStorageError);
  });
});
