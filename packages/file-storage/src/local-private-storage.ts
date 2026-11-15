import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

import { PrivateStorageError } from "./errors.js";

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export interface WrittenUpload {
  stagingKey: string;
  sizeBytes: bigint;
  checksumSha256: string;
  headerBytes: Uint8Array;
}

export interface IntegrityCheck {
  valid: boolean;
  actualChecksumSha256: string;
}

export interface PrivateStorageAdapter {
  writeToStaging(
    stagingKey: string,
    source: Readable,
    maxBytes: bigint,
  ): Promise<WrittenUpload>;
  finalize(stagingKey: string, objectKey: string): Promise<void>;
  removeStaging(stagingKey: string): Promise<void>;
  removeObject(objectKey: string): Promise<void>;
  verifyObjectChecksum(
    objectKey: string,
    expectedChecksumSha256: string,
  ): Promise<IntegrityCheck>;
  cleanupOrphanObjects(
    referencedObjectKeys: readonly string[],
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (objectKey: string) => void | Promise<void>,
  ): Promise<number>;
  cleanupTemp(
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (storageKey: string) => void | Promise<void>,
  ): Promise<number>;
  openReadStream(objectKey: string): Readable;
}

export class LocalPrivateStorage implements PrivateStorageAdapter {
  readonly #root: string;

  constructor(root: string) {
    this.#root = path.resolve(root);
  }

  async writeToStaging(
    stagingKey: string,
    source: Readable,
    maxBytes: bigint,
  ): Promise<WrittenUpload> {
    const filePath = this.#resolveKey(stagingKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const handle = await fs.open(filePath, "wx", 0o600);
    const hash = createHash("sha256");
    const headerChunks: Buffer[] = [];
    let headerSize = 0;
    let sizeBytes = 0n;

    try {
      for await (const rawChunk of source) {
        const chunk = Buffer.isBuffer(rawChunk)
          ? rawChunk
          : Buffer.from(rawChunk);
        sizeBytes += BigInt(chunk.byteLength);

        if (sizeBytes > maxBytes) {
          throw new PrivateStorageError(
            "FILE_TOO_LARGE",
            "Uploaded file exceeds the configured size limit.",
          );
        }

        if (headerSize < 4100) {
          const remaining = 4100 - headerSize;
          const headerChunk = chunk.subarray(0, remaining);
          headerChunks.push(headerChunk);
          headerSize += headerChunk.byteLength;
        }

        hash.update(chunk);
        await handle.write(chunk);
      }

      if (sizeBytes === 0n) {
        throw new PrivateStorageError(
          "FILE_EMPTY",
          "Uploaded file is empty.",
        );
      }
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.rm(filePath, { force: true }).catch(() => undefined);
      throw error;
    }

    await handle.close();

    return {
      stagingKey,
      sizeBytes,
      checksumSha256: hash.digest("hex"),
      headerBytes: Buffer.concat(headerChunks),
    };
  }

  async finalize(
    stagingKey: string,
    objectKey: string,
  ): Promise<void> {
    const stagingPath = this.#resolveKey(stagingKey);
    const objectPath = this.#resolveKey(objectKey);
    await fs.mkdir(path.dirname(objectPath), { recursive: true });

    try {
      await fs.access(objectPath);
      throw new PrivateStorageError(
        "STORAGE_OBJECT_EXISTS",
        "Refusing to overwrite an existing private object.",
      );
    } catch (error) {
      if (
        error instanceof PrivateStorageError &&
        error.code === "STORAGE_OBJECT_EXISTS"
      ) {
        throw error;
      }
    }

    await fs.rename(stagingPath, objectPath);
  }

  async removeStaging(stagingKey: string): Promise<void> {
    await fs.rm(this.#resolveKey(stagingKey), { force: true });
  }

  async removeObject(objectKey: string): Promise<void> {
    await fs.rm(this.#resolveKey(objectKey), { force: true });
  }

  async verifyObjectChecksum(
    objectKey: string,
    expectedChecksumSha256: string,
  ): Promise<IntegrityCheck> {
    const hash = createHash("sha256");

    for await (const chunk of this.openReadStream(objectKey)) {
      hash.update(chunk);
    }

    const actualChecksumSha256 = hash.digest("hex");
    return {
      valid: actualChecksumSha256 === expectedChecksumSha256,
      actualChecksumSha256,
    };
  }

  async cleanupOrphanObjects(
    referencedObjectKeys: readonly string[],
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (objectKey: string) => void | Promise<void>,
  ): Promise<number> {
    const objectsDirectory = this.#resolveKey("objects");
    let entries;
    try {
      entries = await fs.readdir(objectsDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        return 0;
      }
      onError?.(error);
      return 0;
    }
    const referenced = new Set(referencedObjectKeys);
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const objectKey = `objects/${entry.name}`;
      if (referenced.has(objectKey)) {
        continue;
      }

      const objectPath = path.join(objectsDirectory, entry.name);
      let stats;
      try {
        stats = await fs.stat(objectPath);
      } catch (error) {
        onError?.(error);
        continue;
      }
      if (!stats || stats.mtimeMs >= cutoff) {
        continue;
      }

      await beforeDelete?.(objectKey);
      try {
        await fs.rm(objectPath, { force: true });
      } catch (error) {
        onError?.(error);
        continue;
      }
      removed += 1;
    }

    return removed;
  }

  async cleanupTemp(
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (storageKey: string) => void | Promise<void>,
  ): Promise<number> {
    const tempDirectory = this.#resolveKey("temp");
    let entries;
    try {
      entries = await fs.readdir(tempDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        return 0;
      }
      onError?.(error);
      return 0;
    }
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;

    for (const entry of entries) {
      const entryPath = path.join(tempDirectory, entry.name);
      let stats;
      try {
        stats = await fs.stat(entryPath);
      } catch (error) {
        onError?.(error);
        continue;
      }
      if (!stats || stats.mtimeMs >= cutoff) {
        continue;
      }
      await beforeDelete?.(`temp/${entry.name}`);
      try {
        await fs.rm(entryPath, { recursive: true, force: true });
      } catch (error) {
        onError?.(error);
        continue;
      }
      removed += 1;
    }

    return removed;
  }

  openReadStream(objectKey: string): Readable {
    return createReadStream(this.#resolveKey(objectKey));
  }

  #resolveKey(key: string): string {
    if (
      !key ||
      key.includes("\0") ||
      key.includes("..") ||
      path.isAbsolute(key)
    ) {
      throw new PrivateStorageError(
        "STORAGE_KEY_INVALID",
        "Private storage key is invalid.",
      );
    }

    const resolved = path.resolve(this.#root, key);
    const rootPrefix = `${this.#root}${path.sep}`;

    if (!resolved.startsWith(rootPrefix)) {
      throw new PrivateStorageError(
        "STORAGE_KEY_OUTSIDE_ROOT",
        "Private storage key escapes the configured root.",
      );
    }

    return resolved;
  }
}
