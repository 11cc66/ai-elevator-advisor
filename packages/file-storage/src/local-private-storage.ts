import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { constants, createReadStream } from "node:fs";
import type { BigIntStats } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

import type {
  IntegrityCheck,
  ReadVerifiedObjectInput,
  StorageRuntimeCapability,
  VerifiedObjectRead,
  WrittenUpload,
} from "./capabilities.js";
import { PrivateStorageError } from "./errors.js";

export interface LocalPrivateStorageHooks {
  afterPrecheck?: () => void | Promise<void>;
  afterReadChunk?: (
    bytesRead: number,
    totalBytesRead: number,
  ) => void | Promise<void>;
  afterStagingClose?: () => void | Promise<void>;
  beforeFinalizeLink?: () => void | Promise<void>;
  afterFinalizeLink?: () => void | Promise<void>;
}

function isPathInside(root: string, candidate: string): boolean {
  const rootPrefix = `${root}${path.sep}`;
  return candidate === root || candidate.startsWith(rootPrefix);
}

interface FileIdentity {
  dev: bigint;
  ino: bigint;
}

function readReliableIdentity(stats: BigIntStats): FileIdentity | null {
  if (stats.dev === 0n || stats.ino === 0n) {
    return null;
  }
  return { dev: stats.dev, ino: stats.ino };
}

function identitiesMatch(
  left: FileIdentity,
  right: FileIdentity,
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function normalizeStorageReadError(error: unknown): PrivateStorageError {
  if (error instanceof PrivateStorageError) {
    return error;
  }

  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;

  if (code === "ENOENT" || code === "ENOTDIR") {
    return new PrivateStorageError(
      "STORAGE_OBJECT_MISSING",
      "Private storage object does not exist.",
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    return new PrivateStorageError(
      "STORAGE_OBJECT_ACCESS_DENIED",
      "Private storage object cannot be accessed.",
    );
  }
  if (code === "EMFILE" || code === "ENFILE" || code === "ENOMEM") {
    return new PrivateStorageError(
      "STORAGE_RESOURCE_EXHAUSTED",
      "Private storage resources are temporarily exhausted.",
    );
  }
  if (code === "ELOOP") {
    return new PrivateStorageError(
      "STORAGE_OBJECT_SYMLINK",
      "Private storage object must not be a symbolic link.",
    );
  }
  if (code === "EISDIR") {
    return new PrivateStorageError(
      "STORAGE_OBJECT_NOT_REGULAR",
      "Private storage object must be a regular file.",
    );
  }

  return new PrivateStorageError(
    "STORAGE_IO_ERROR",
    "Private storage object could not be read.",
  );
}

export class LocalPrivateStorage implements StorageRuntimeCapability {
  readonly #root: string;
  readonly #hooks: LocalPrivateStorageHooks;

  constructor(root: string, hooks: LocalPrivateStorageHooks = {}) {
    this.#root = path.resolve(root);
    this.#hooks = hooks;
  }

  async writeToStaging(
    stagingKey: string,
    source: Readable,
    maxBytes: bigint,
  ): Promise<WrittenUpload> {
    const filePath = this.#resolveKey(stagingKey);
    await this.#ensureSafeParentDirectory(stagingKey, true);

    const handle = await fs.open(filePath, "wx", 0o600);
    const hash = createHash("sha256");
    const headerChunks: Buffer[] = [];
    let headerSize = 0;
    let sizeBytes = 0n;
    let closed = false;

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

      await handle.sync();
      const closedStats = await handle.stat({ bigint: true });
      const identity = readReliableIdentity(closedStats);
      if (
        !closedStats.isFile() ||
        closedStats.size !== sizeBytes ||
        !identity
      ) {
        throw new PrivateStorageError(
          "STORAGE_IO_ERROR",
          "Private storage staging identity changed before close.",
        );
      }
      const checksumSha256 = hash.digest("hex");
      await handle.close();
      closed = true;
      await this.#hooks.afterStagingClose?.();
      const verifiedIdentity = await this.#verifyClosedStaging({
        stagingKey,
        expectedIdentity: identity,
        expectedSizeBytes: sizeBytes,
        expectedChecksumSha256: checksumSha256,
      });

      return {
        stagingKey,
        sizeBytes,
        checksumSha256,
        headerBytes: Buffer.concat(headerChunks),
        writerClosedAt: new Date(),
        closedIdentity: verifiedIdentity
          ? {
              dev: verifiedIdentity.dev.toString(),
              ino: verifiedIdentity.ino.toString(),
            }
          : null,
      };
    } catch (error) {
      if (!closed) {
        await handle.close().catch(() => undefined);
      }
      throw error instanceof PrivateStorageError
        ? error
        : new PrivateStorageError(
            "STORAGE_IO_ERROR",
            "Private storage staging could not be closed safely.",
          );
    }
  }

  async finalize(
    stagingKey: string,
    objectKey: string,
    expected?: {
      sizeBytes: bigint;
      checksumSha256: string;
    },
  ): Promise<void> {
    const stagingPath = this.#resolveKey(stagingKey);
    const objectPath = this.#resolveKey(objectKey);
    await this.#ensureSafeParentDirectory(objectKey, true);
    const stagingStats = await fs.lstat(stagingPath, { bigint: true });
    const stagingIdentity = readReliableIdentity(stagingStats);
    if (
      !stagingStats.isFile() ||
      stagingStats.isSymbolicLink() ||
      !stagingIdentity
    ) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_NOT_REGULAR",
        "Private staging object is not a trusted regular file.",
      );
    }

    await this.#hooks.beforeFinalizeLink?.();
    try {
      await fs.link(stagingPath, objectPath);
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : undefined;
      if (code !== "EEXIST") {
        throw new PrivateStorageError(
          code === "EXDEV"
            ? "STORAGE_PUBLICATION_UNSUPPORTED"
            : "STORAGE_IO_ERROR",
          "Private object could not be published atomically without overwrite.",
        );
      }
      const targetStats = await fs.lstat(objectPath, { bigint: true });
      const targetIdentity = readReliableIdentity(targetStats);
      if (
        !targetIdentity ||
        !identitiesMatch(stagingIdentity, targetIdentity)
      ) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_EXISTS",
          "Refusing to overwrite an existing private object.",
        );
      }
    }

    const targetStats = await fs.lstat(objectPath, { bigint: true });
    const targetIdentity = readReliableIdentity(targetStats);
    if (
      targetStats.isSymbolicLink() ||
      !targetStats.isFile() ||
      !targetIdentity ||
      !identitiesMatch(stagingIdentity, targetIdentity)
    ) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_IDENTITY_CHANGED",
        "Published private object identity does not match staging.",
      );
    }
    await this.#hooks.afterFinalizeLink?.();
    if (expected) {
      await this.readVerifiedObject({
        objectKey,
        expectedSizeBytes: expected.sizeBytes,
        expectedChecksumSha256: expected.checksumSha256,
        maxBytes: expected.sizeBytes,
      });
    }
    const sourceBeforeUnlink = await fs.lstat(stagingPath, { bigint: true });
    const sourceBeforeUnlinkIdentity =
      readReliableIdentity(sourceBeforeUnlink);
    if (
      sourceBeforeUnlink.isSymbolicLink() ||
      !sourceBeforeUnlink.isFile() ||
      !sourceBeforeUnlinkIdentity ||
      !identitiesMatch(stagingIdentity, sourceBeforeUnlinkIdentity)
    ) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_IDENTITY_CHANGED",
        "Private staging path changed before cleanup of the hard link.",
      );
    }
    // Automatic physical cleanup remains disabled; the verified staging hard
    // link is retained for recovery and operator inspection.
  }

  async verifyStagingForRecovery(input: {
    stagingKey: string;
    expectedSizeBytes: bigint;
    expectedChecksumSha256: string;
    maxBytes: bigint;
  }): Promise<WrittenUpload> {
    const verified = await this.readVerifiedObject({
      objectKey: input.stagingKey,
      expectedSizeBytes: input.expectedSizeBytes,
      expectedChecksumSha256: input.expectedChecksumSha256,
      maxBytes: input.maxBytes,
    });
    const filePath = this.#resolveKey(input.stagingKey);
    await this.#ensureSafeParentDirectory(input.stagingKey, false);
    const stats = await fs.lstat(filePath, { bigint: true });
    const identity = readReliableIdentity(stats);
    if (
      stats.isSymbolicLink() ||
      !stats.isFile() ||
      stats.size !== input.expectedSizeBytes ||
      !identity
    ) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_IDENTITY_CHANGED",
        "Private staging recovery identity is not trusted.",
      );
    }
    const verifiedIdentity = await this.#verifyClosedStaging({
      stagingKey: input.stagingKey,
      expectedIdentity: identity,
      expectedSizeBytes: input.expectedSizeBytes,
      expectedChecksumSha256: input.expectedChecksumSha256,
    });
    return {
      stagingKey: input.stagingKey,
      sizeBytes: verified.sizeBytes,
      checksumSha256: verified.checksumSha256,
      headerBytes: verified.bytes.subarray(0, 4100),
      writerClosedAt: new Date(),
      closedIdentity: {
        dev: verifiedIdentity.dev.toString(),
        ino: verifiedIdentity.ino.toString(),
      },
    };
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

  async readVerifiedObject(
    input: ReadVerifiedObjectInput,
  ): Promise<VerifiedObjectRead> {
    if (
      input.expectedSizeBytes <= 0n ||
      input.expectedSizeBytes > input.maxBytes ||
      input.maxBytes > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_SIZE_INVALID",
        "Private storage object size is invalid.",
      );
    }
    if (!/^[0-9A-Fa-f]{64}$/.test(input.expectedChecksumSha256)) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_CHECKSUM_INVALID",
        "Expected private storage checksum is invalid.",
      );
    }

    const expectedSize = Number(input.expectedSizeBytes);
    const filePath = this.#resolveKey(input.objectKey);
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    let result: VerifiedObjectRead | undefined;
    let failure: PrivateStorageError | undefined;

    try {
      const rootStats = await fs.lstat(this.#root, { bigint: true });
      if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
        throw new PrivateStorageError(
          "STORAGE_ROOT_IDENTITY_INVALID",
          "Private storage root must be a real directory.",
        );
      }
      const rootIdentity = readReliableIdentity(rootStats);
      if (!rootIdentity) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_IDENTITY_UNAVAILABLE",
          "Private storage file identity is unavailable.",
        );
      }

      const canonicalRoot = await fs.realpath(this.#root);
      const canonicalObjectPath = await fs.realpath(filePath);
      if (!isPathInside(canonicalRoot, canonicalObjectPath)) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_OUTSIDE_ROOT",
          "Private storage object resolves outside the storage root.",
        );
      }

      const relativePath = path.relative(this.#root, filePath);
      if (
        !relativePath ||
        relativePath.startsWith("..") ||
        path.isAbsolute(relativePath)
      ) {
        throw new PrivateStorageError(
          "STORAGE_KEY_OUTSIDE_ROOT",
          "Private storage object path escapes the storage root.",
        );
      }
      let currentPath = this.#root;
      const segments = relativePath.split(path.sep);
      const componentIdentities: Array<{
        path: string;
        identity: FileIdentity;
        isFile: boolean;
      }> = [];
      for (const [index, segment] of segments.entries()) {
        currentPath = path.join(currentPath, segment);
        const segmentStats = await fs.lstat(currentPath, {
          bigint: true,
        });
        if (segmentStats.isSymbolicLink()) {
          throw new PrivateStorageError(
            "STORAGE_OBJECT_SYMLINK",
            "Private storage object path must not contain symbolic links.",
          );
        }
        const isFile = index === segments.length - 1;
        if (isFile ? !segmentStats.isFile() : !segmentStats.isDirectory()) {
          throw new PrivateStorageError(
            isFile
              ? "STORAGE_OBJECT_NOT_REGULAR"
              : "STORAGE_PATH_COMPONENT_INVALID",
            isFile
              ? "Private storage object must be a regular file."
              : "Private storage path components must be directories.",
          );
        }
        const identity = readReliableIdentity(segmentStats);
        if (!identity) {
          throw new PrivateStorageError(
            "STORAGE_OBJECT_IDENTITY_UNAVAILABLE",
            "Private storage file identity is unavailable.",
          );
        }
        componentIdentities.push({
          path: currentPath,
          identity,
          isFile,
        });
      }
      const finalPrecheck =
        componentIdentities[componentIdentities.length - 1];
      if (!finalPrecheck?.isFile) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_NOT_REGULAR",
          "Private storage object must be a regular file.",
        );
      }

      await this.#hooks.afterPrecheck?.();

      const noFollow =
        (constants as typeof constants & { O_NOFOLLOW?: number })
          .O_NOFOLLOW ?? 0;
      handle = await fs.open(filePath, constants.O_RDONLY | noFollow);
      const openedStats = await handle.stat({ bigint: true });
      const openedIdentity = readReliableIdentity(openedStats);

      if (!openedStats.isFile()) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_NOT_REGULAR",
          "Private storage object must be a regular file.",
        );
      }
      if (!openedIdentity) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_IDENTITY_UNAVAILABLE",
          "Private storage file identity is unavailable.",
        );
      }
      if (!identitiesMatch(openedIdentity, finalPrecheck.identity)) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_IDENTITY_CHANGED",
          "Private storage object changed before it was opened.",
        );
      }
      if (openedStats.size !== input.expectedSizeBytes) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_SIZE_MISMATCH",
          "Private storage object size does not match metadata.",
        );
      }

      const currentRootStats = await fs.lstat(this.#root, {
        bigint: true,
      });
      const currentRootIdentity =
        readReliableIdentity(currentRootStats);
      if (
        currentRootStats.isSymbolicLink() ||
        !currentRootStats.isDirectory() ||
        !currentRootIdentity ||
        !identitiesMatch(currentRootIdentity, rootIdentity)
      ) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_IDENTITY_CHANGED",
          "Private storage root changed during download.",
        );
      }
      for (const component of componentIdentities) {
        const currentStats = await fs.lstat(component.path, {
          bigint: true,
        });
        const currentIdentity = readReliableIdentity(currentStats);
        if (
          currentStats.isSymbolicLink() ||
          (component.isFile
            ? !currentStats.isFile()
            : !currentStats.isDirectory()) ||
          !currentIdentity ||
          !identitiesMatch(currentIdentity, component.identity)
        ) {
          throw new PrivateStorageError(
            "STORAGE_OBJECT_IDENTITY_CHANGED",
            "Private storage path changed during download.",
          );
        }
      }

      const bytes = Buffer.allocUnsafe(expectedSize);
      let offset = 0;
      while (offset < expectedSize) {
        const requestedBytes = Math.min(
          64 * 1024,
          expectedSize - offset,
        );
        const { bytesRead } = await handle.read(
          bytes,
          offset,
          requestedBytes,
          offset,
        );
        if (bytesRead === 0) {
          throw new PrivateStorageError(
            "STORAGE_OBJECT_SIZE_MISMATCH",
            "Private storage object ended before its declared size.",
          );
        }
        offset += bytesRead;
        await this.#hooks.afterReadChunk?.(
          bytesRead,
          offset,
        );
      }

      const extraByte = Buffer.allocUnsafe(1);
      const { bytesRead: extraBytesRead } = await handle.read(
        extraByte,
        0,
        1,
        expectedSize,
      );
      if (extraBytesRead !== 0) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_SIZE_MISMATCH",
          "Private storage object exceeds its declared size.",
        );
      }

      const checksumSha256 = createHash("sha256")
        .update(bytes)
        .digest("hex");
      if (
        checksumSha256.toLowerCase() !==
        input.expectedChecksumSha256.toLowerCase()
      ) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_CHECKSUM_MISMATCH",
          "Private storage object checksum does not match metadata.",
          {
            actualChecksumSha256: checksumSha256,
            expectedChecksumSha256:
              input.expectedChecksumSha256.toLowerCase(),
          },
        );
      }

      result = {
        bytes,
        sizeBytes: BigInt(bytes.byteLength),
        checksumSha256,
      };
    } catch (error) {
      failure = normalizeStorageReadError(error);
    }

    if (handle) {
      try {
        await handle.close();
      } catch (error) {
        failure ??= normalizeStorageReadError(error);
      }
    }

    if (failure) {
      throw failure;
    }
    if (!result) {
      throw new PrivateStorageError(
        "STORAGE_IO_ERROR",
        "Private storage object could not be read.",
      );
    }
    return result;
  }

  openReadStream(objectKey: string): Readable {
    return createReadStream(this.#resolveKey(objectKey));
  }

  async #verifyClosedStaging(input: {
    stagingKey: string;
    expectedIdentity: FileIdentity | null;
    expectedSizeBytes: bigint;
    expectedChecksumSha256: string;
  }): Promise<FileIdentity> {
    if (!input.expectedIdentity) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_IDENTITY_UNAVAILABLE",
        "Private staging identity was unavailable before close.",
      );
    }

    const filePath = this.#resolveKey(input.stagingKey);
    await this.#ensureSafeParentDirectory(input.stagingKey, false);
    const stats = await fs.lstat(filePath, { bigint: true });
    const identity = readReliableIdentity(stats);
    if (
      stats.isSymbolicLink() ||
      !stats.isFile() ||
      stats.size !== input.expectedSizeBytes ||
      !identity ||
      !identitiesMatch(identity, input.expectedIdentity)
    ) {
      throw new PrivateStorageError(
        "STORAGE_OBJECT_IDENTITY_CHANGED",
        "Private staging object changed after close.",
      );
    }

    const noFollow =
      (constants as typeof constants & { O_NOFOLLOW?: number })
        .O_NOFOLLOW ?? 0;
    const handle = await fs.open(
      filePath,
      constants.O_RDONLY | noFollow,
    );
    let verifiedIdentity: FileIdentity | undefined;
    let verificationError: unknown;
    let closeError: unknown;
    try {
      const openedStats = await handle.stat({ bigint: true });
      const openedIdentity = readReliableIdentity(openedStats);
      if (
        !openedStats.isFile() ||
        openedStats.size !== input.expectedSizeBytes ||
        !openedIdentity ||
        !identitiesMatch(openedIdentity, input.expectedIdentity)
      ) {
        throw new PrivateStorageError(
          "STORAGE_OBJECT_IDENTITY_CHANGED",
          "Private staging object changed before post-close verification.",
        );
      }
      const bytes = await handle.readFile();
      const checksumSha256 = createHash("sha256")
        .update(bytes)
        .digest("hex");
      if (
        BigInt(bytes.byteLength) !== input.expectedSizeBytes ||
        checksumSha256.toLowerCase() !==
          input.expectedChecksumSha256.toLowerCase()
      ) {
        throw new PrivateStorageError(
          checksumSha256.toLowerCase() ===
          input.expectedChecksumSha256.toLowerCase()
            ? "STORAGE_OBJECT_SIZE_MISMATCH"
            : "STORAGE_OBJECT_CHECKSUM_MISMATCH",
          "Private staging post-close verification failed.",
        );
      }
      verifiedIdentity = identity;
    } catch (error) {
      verificationError = error;
    } finally {
      try {
        await handle.close();
      } catch (error) {
        closeError = error;
      }
    }
    if (closeError) {
      throw new PrivateStorageError(
        "STORAGE_IO_ERROR",
        "Private staging verification handle could not be closed.",
      );
    }
    if (verificationError) {
      throw verificationError;
    }
    if (!verifiedIdentity) {
      throw new PrivateStorageError(
        "STORAGE_IO_ERROR",
        "Private staging post-close verification did not complete.",
      );
    }
    return verifiedIdentity;
  }

  async #ensureSafeParentDirectory(
    key: string,
    create: boolean,
  ): Promise<void> {
    const filePath = this.#resolveKey(key);
    if (create) {
      await fs.mkdir(this.#root, { recursive: true });
    }
    const rootStats = await fs.lstat(this.#root, { bigint: true });
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
      throw new PrivateStorageError(
        "STORAGE_ROOT_IDENTITY_INVALID",
        "Private storage root must be a real directory.",
      );
    }
    const canonicalRoot = await fs.realpath(this.#root);
    const relativePath = path.relative(this.#root, filePath);
    const segments = relativePath.split(path.sep);
    let currentPath = this.#root;
    for (const segment of segments.slice(0, -1)) {
      currentPath = path.join(currentPath, segment);
      if (create) {
        try {
          await fs.mkdir(currentPath, { mode: 0o700 });
        } catch (error) {
          const code =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "string"
              ? error.code
              : undefined;
          if (code !== "EEXIST") {
            throw error;
          }
        }
      }
      const stats = await fs.lstat(currentPath, { bigint: true });
      const canonicalPath = await fs.realpath(currentPath);
      if (
        stats.isSymbolicLink() ||
        !stats.isDirectory() ||
        !isPathInside(canonicalRoot, canonicalPath)
      ) {
        throw new PrivateStorageError(
          "STORAGE_PATH_COMPONENT_INVALID",
          "Private storage parent components must be trusted directories.",
        );
      }
    }
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
