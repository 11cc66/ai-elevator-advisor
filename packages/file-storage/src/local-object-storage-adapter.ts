import { createHash } from "node:crypto";
import { constants } from "node:fs";
import type { BigIntStats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";

import {
  type ObjectStorageAdapter,
  type ObjectStorageExactDiscoveryRequest,
  type ObjectStorageExactDiscoveryResult,
  type ObjectStorageExactReadRequest,
  type ObjectStorageExactReadResult,
  type ObjectStorageVersionIdentity,
  type ObjectStorageWriteRequest,
  type ObjectStorageWriteResult,
} from "./object-storage-adapter.js";
import { ObjectStorageError } from "./object-storage-errors.js";

const PROVIDER_KIND = "LOCAL_DEVELOPMENT";
const ACCOUNT_SCOPE_REF = "LOCAL_DEVELOPMENT";
const REGION = "LOCAL";
const BUCKET = "LOCAL_DEVELOPMENT";

interface FileIdentity {
  dev: bigint;
  ino: bigint;
}

interface ParentDirectorySnapshot {
  rootIdentity: FileIdentity;
  components: Array<{
    path: string;
    identity: FileIdentity;
  }>;
}

interface PreparedWritePath {
  filePath: string;
  snapshot: ParentDirectorySnapshot;
}

export interface LocalObjectStorageAdapterHooks {
  afterWritePathPrepared?: () => void | Promise<void>;
  afterOpen?: () => void | Promise<void>;
  afterPostOpenVerification?: () => void | Promise<void>;
  afterRead?: () => void | Promise<void>;
}

function isPathInside(root: string, candidate: string): boolean {
  const rootPrefix = `${root}${path.sep}`;
  return candidate === root || candidate.startsWith(rootPrefix);
}

function readReliableIdentity(stats: BigIntStats): FileIdentity | null {
  if (stats.dev === 0n || stats.ino === 0n) {
    return null;
  }
  return { dev: stats.dev, ino: stats.ino };
}

function identitiesMatch(left: FileIdentity, right: FileIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function versionIdFor(sizeBytes: bigint, checksumSha256: string): string {
  return `${checksumSha256}:${sizeBytes.toString()}`;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new ObjectStorageError(
      "OBJECT_STORAGE_WRITE_UNCERTAIN",
      "Local bounded object operation was aborted.",
      { details: { reason: "ABORTED" } },
    );
  }
}

function codeOf(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

export class LocalObjectStorageAdapter implements ObjectStorageAdapter {
  readonly provider = {
    providerKind: PROVIDER_KIND,
    accountScopeRef: ACCOUNT_SCOPE_REF,
    region: REGION,
    bucketOrContainer: BUCKET,
  };

  readonly capabilities = {
    immutableWrite: "SUPPORTED" as const,
    exactVersionRead: "SUPPORTED" as const,
    exactVersionIdentity: "SUPPORTED" as const,
    checksumReadback: "SUPPORTED" as const,
    exactWriteDiscovery: "SUPPORTED" as const,
  };

  readonly #root: string;
  readonly #hooks: LocalObjectStorageAdapterHooks;

  constructor(
    root: string,
    hooks: LocalObjectStorageAdapterHooks = {},
  ) {
    this.#root = path.resolve(root);
    this.#hooks = hooks;
  }

  async writeImmutable(
    request: ObjectStorageWriteRequest,
  ): Promise<ObjectStorageWriteResult> {
    if (
      request.expectedSizeBytes <= 0n ||
      !request.idempotencyKey ||
      request.idempotencyKey.includes("\0")
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_SIZE_MISMATCH",
        "Local bounded object write request is invalid.",
      );
    }

    const prepared = await this.#prepareObjectWritePath(request.objectKey);
    const filePath = prepared.filePath;
    const hash = createHash("sha256");
    let sizeBytes = 0n;
    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    let closed = false;

    try {
      throwIfAborted(request.signal);
      await this.#hooks.afterWritePathPrepared?.();
      await this.#verifyParentDirectorySnapshot(prepared.snapshot);
      handle = await fs.open(
        filePath,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          ((constants as typeof constants & { O_NOFOLLOW?: number })
            .O_NOFOLLOW ?? 0),
        0o600,
      );
      const openedStats = await handle.stat({ bigint: true });
      if (
        !openedStats.isFile() ||
        readReliableIdentity(openedStats) === null
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local bounded object identity is unavailable.",
        );
      }
      await this.#hooks.afterOpen?.();
      await this.#verifyParentDirectorySnapshot(prepared.snapshot);
      await this.#hooks.afterPostOpenVerification?.();

      for await (const rawChunk of request.source) {
        throwIfAborted(request.signal);
        const chunk = Buffer.isBuffer(rawChunk)
          ? rawChunk
          : Buffer.from(rawChunk);
        sizeBytes += BigInt(chunk.byteLength);
        if (sizeBytes > request.expectedSizeBytes) {
          throw new ObjectStorageError(
            "OBJECT_STORAGE_SIZE_MISMATCH",
            "Local object exceeds the declared size.",
          );
        }
        hash.update(chunk);
        await writeAll(handle, chunk);
      }

      if (sizeBytes !== request.expectedSizeBytes) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_SIZE_MISMATCH",
          "Local object does not match the declared size.",
        );
      }

      const checksumSha256 = hash.digest("hex");
      if (
        request.expectedChecksumSha256 &&
        checksumSha256.toLowerCase() !==
          request.expectedChecksumSha256.toLowerCase()
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_CHECKSUM_MISMATCH",
          "Local object checksum does not match the expected digest.",
          {
            details: {
              actualChecksumSha256: checksumSha256,
              expectedChecksumSha256:
                request.expectedChecksumSha256.toLowerCase(),
            },
          },
        );
      }

      await handle.sync();
      const finalStats = await handle.stat({ bigint: true });
      if (
        !finalStats.isFile() ||
        finalStats.size !== sizeBytes ||
        readReliableIdentity(finalStats) === null
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local object could not be closed with stable identity.",
        );
      }
      await this.#verifyParentDirectorySnapshot(prepared.snapshot);
      const pathStats = await fs.lstat(filePath, { bigint: true });
      const pathIdentity = readReliableIdentity(pathStats);
      const finalIdentity = readReliableIdentity(finalStats);
      if (
        pathStats.isSymbolicLink() ||
        !pathStats.isFile() ||
        !pathIdentity ||
        !finalIdentity ||
        !identitiesMatch(pathIdentity, finalIdentity)
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local bounded object path changed during write.",
        );
      }

      await handle.close();
      closed = true;
      const version: ObjectStorageVersionIdentity = {
        ...this.provider,
        objectKey: request.objectKey,
        providerVersionId: versionIdFor(sizeBytes, checksumSha256),
        providerGeneration: null,
      };
      return {
        version,
        sizeBytes,
        checksumSha256,
        etag: null,
        requestId: request.idempotencyKey,
      };
    } catch (error) {
      if (error instanceof ObjectStorageError) {
        throw error;
      }
      throw new ObjectStorageError(
        codeOf(error) === "EEXIST"
          ? "OBJECT_STORAGE_NO_OVERWRITE_UNSUPPORTED"
          : "OBJECT_STORAGE_WRITE_UNCERTAIN",
        "Local bounded object write could not be confirmed.",
        {
          retryable: false,
          details: { nativeCode: codeOf(error) ?? null },
          cause: error,
        },
      );
    } finally {
      if (handle && !closed) {
        await handle.close().catch(() => undefined);
      }
    }
  }

  async readExact(
    request: ObjectStorageExactReadRequest,
  ): Promise<ObjectStorageExactReadResult> {
    this.#assertProviderIdentity(request.version);
    const result = await this.#readVerifiedObject({
      objectKey: request.version.objectKey,
      expectedSizeBytes: request.expectedSizeBytes,
      expectedChecksumSha256: request.expectedChecksumSha256,
      maxBytes: request.maxBytes,
      signal: request.signal,
      notFoundIsEmpty: false,
    });
    if (!result.bytes) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_NOT_FOUND",
        "Local bounded object does not exist.",
      );
    }
    const expectedVersion = versionIdFor(
      result.sizeBytes,
      result.checksumSha256,
    );
    if (request.version.providerVersionId !== expectedVersion) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object version does not match.",
      );
    }
    return {
      bytes: result.bytes,
      sizeBytes: result.sizeBytes,
      checksumSha256: result.checksumSha256,
      requestId: null,
    };
  }

  async discoverExact(
    request: ObjectStorageExactDiscoveryRequest,
  ): Promise<ObjectStorageExactDiscoveryResult> {
    if (
      !request.idempotencyKey ||
      request.expectedSizeBytes <= 0n ||
      request.expectedSizeBytes > request.maxBytes ||
      !/^[0-9a-f]{64}$/i.test(request.expectedChecksumSha256)
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local exact discovery request is invalid.",
      );
    }

    const result = await this.#readVerifiedObject({
      objectKey: request.objectKey,
      expectedSizeBytes: request.expectedSizeBytes,
      expectedChecksumSha256: request.expectedChecksumSha256,
      maxBytes: request.maxBytes,
      signal: request.signal,
      notFoundIsEmpty: true,
    });
    if (!result.bytes) {
      return { status: "NOT_FOUND", requestId: request.idempotencyKey };
    }

    return {
      status: "FOUND",
      version: {
        ...this.provider,
        objectKey: request.objectKey,
        providerVersionId: versionIdFor(
          result.sizeBytes,
          result.checksumSha256,
        ),
        providerGeneration: null,
      },
      sizeBytes: result.sizeBytes,
      checksumSha256: result.checksumSha256,
      etag: null,
      requestId: request.idempotencyKey,
    };
  }

  #assertProviderIdentity(version: ObjectStorageVersionIdentity): void {
    if (
      version.providerKind !== PROVIDER_KIND ||
      version.accountScopeRef !== ACCOUNT_SCOPE_REF ||
      version.region !== REGION ||
      version.bucketOrContainer !== BUCKET ||
      !version.providerVersionId ||
      version.providerVersionId.trim().length === 0
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object provider identity does not match.",
      );
    }
  }

  async #readVerifiedObject(input: {
    objectKey: string;
    expectedSizeBytes: bigint;
    expectedChecksumSha256: string;
    maxBytes: bigint;
    signal?: AbortSignal;
    notFoundIsEmpty: boolean;
  }): Promise<{
    bytes: Buffer | null;
    sizeBytes: bigint;
    checksumSha256: string;
  }> {
    if (
      input.expectedSizeBytes <= 0n ||
      input.expectedSizeBytes > input.maxBytes ||
      input.maxBytes > BigInt(Number.MAX_SAFE_INTEGER) ||
      !/^[0-9a-f]{64}$/i.test(input.expectedChecksumSha256)
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_SIZE_MISMATCH",
        "Local bounded object read request is invalid.",
      );
    }

    const filePath = this.#resolveObjectKey(input.objectKey);
    let parentSnapshot: ParentDirectorySnapshot;
    try {
      parentSnapshot = await this.#inspectExistingParentDirectories(
        input.objectKey,
      );
    } catch (error) {
      if (
        input.notFoundIsEmpty &&
        error instanceof ObjectStorageError &&
        error.code === "OBJECT_STORAGE_NOT_FOUND"
      ) {
        return {
          bytes: null,
          sizeBytes: 0n,
          checksumSha256: "",
        };
      }
      throw error;
    }
    let fileStats: BigIntStats;
    try {
      fileStats = await fs.lstat(filePath, { bigint: true });
    } catch (error) {
      if (
        input.notFoundIsEmpty &&
        (codeOf(error) === "ENOENT" || codeOf(error) === "ENOTDIR")
      ) {
        return {
          bytes: null,
          sizeBytes: 0n,
          checksumSha256: "",
        };
      }
      throw new ObjectStorageError(
        "OBJECT_STORAGE_NOT_FOUND",
        "Local bounded object does not exist.",
        { cause: error },
      );
    }
    if (fileStats.isSymbolicLink()) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object must not be a symbolic link.",
      );
    }
    if (!fileStats.isFile() || fileStats.size !== input.expectedSizeBytes) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_SIZE_MISMATCH",
        "Local bounded object is not a regular file of the expected size.",
      );
    }
    const pathIdentity = readReliableIdentity(fileStats);
    if (!pathIdentity) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object identity is unavailable.",
      );
    }

    let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
    let closed = false;
    try {
      throwIfAborted(input.signal);
      const noFollow =
        (constants as typeof constants & { O_NOFOLLOW?: number })
          .O_NOFOLLOW ?? 0;
      handle = await fs.open(
        filePath,
        constants.O_RDONLY | noFollow,
      );
      const openedStats = await handle.stat({ bigint: true });
      const openedIdentity = readReliableIdentity(openedStats);
      if (
        !openedStats.isFile() ||
        openedStats.size !== input.expectedSizeBytes ||
        !openedIdentity ||
        !identitiesMatch(openedIdentity, pathIdentity)
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local bounded object changed before it was opened.",
        );
      }

      await this.#hooks.afterOpen?.();
      await this.#verifyParentDirectorySnapshot(parentSnapshot);
      await this.#hooks.afterPostOpenVerification?.();

      const bytes = await handle.readFile();
      throwIfAborted(input.signal);
      await this.#hooks.afterRead?.();
      await this.#verifyParentDirectorySnapshot(parentSnapshot);
      if (
        BigInt(bytes.byteLength) !== input.expectedSizeBytes ||
        BigInt(bytes.byteLength) > input.maxBytes
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_SIZE_MISMATCH",
          "Local bounded object bytes do not match the expected size.",
        );
      }
      const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
      if (
        checksumSha256.toLowerCase() !==
        input.expectedChecksumSha256.toLowerCase()
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_CHECKSUM_MISMATCH",
          "Local bounded object checksum does not match.",
          {
            details: {
              actualChecksumSha256: checksumSha256,
              expectedChecksumSha256:
                input.expectedChecksumSha256.toLowerCase(),
            },
          },
        );
      }

      await handle.close();
      closed = true;
      return {
        bytes,
        sizeBytes: BigInt(bytes.byteLength),
        checksumSha256,
      };
    } catch (error) {
      if (error instanceof ObjectStorageError) {
        throw error;
      }
      throw new ObjectStorageError(
        "OBJECT_STORAGE_UNAVAILABLE",
        "Local bounded object could not be read.",
        { cause: error },
      );
    } finally {
      if (handle && !closed) {
        await handle.close().catch(() => undefined);
      }
    }
  }

  async #prepareObjectWritePath(
    objectKey: string,
  ): Promise<PreparedWritePath> {
    const filePath = this.#resolveObjectKey(objectKey);
    await fs.mkdir(this.#root, { recursive: true });
    const rootIdentity = await this.#inspectRoot();
    const canonicalRoot = await fs.realpath(this.#root);
    const relativePath = path.relative(this.#root, filePath);
    const segments = relativePath.split(path.sep);
    if (segments.length < 2) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object key must include a parent namespace.",
      );
    }

    let currentPath = this.#root;
    for (const segment of segments.slice(0, -1)) {
      currentPath = path.join(currentPath, segment);
      try {
        await fs.mkdir(currentPath, { mode: 0o700 });
      } catch (error) {
        if (codeOf(error) !== "EEXIST") {
          throw error;
        }
      }
      const stats = await fs.lstat(currentPath, { bigint: true });
      const canonicalPath = await fs.realpath(currentPath);
      if (
        stats.isSymbolicLink() ||
        !stats.isDirectory() ||
        !isPathInside(canonicalRoot, canonicalPath)
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local bounded object parent path is not a trusted directory.",
        );
      }
    }

    const currentRootIdentity = await this.#inspectRoot();
    if (!identitiesMatch(rootIdentity, currentRootIdentity)) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object root changed during path preparation.",
      );
    }
    const snapshot = await this.#inspectExistingParentDirectories(objectKey);
    return { filePath, snapshot };
  }

  async #inspectExistingParentDirectories(
    objectKey: string,
  ): Promise<ParentDirectorySnapshot> {
    const filePath = this.#resolveObjectKey(objectKey);
    const rootIdentity = await this.#inspectRoot();
    const canonicalRoot = await fs.realpath(this.#root);
    const relativePath = path.relative(this.#root, filePath);
    const segments = relativePath.split(path.sep);
    let currentPath = this.#root;
    const components: ParentDirectorySnapshot["components"] = [];
    for (const segment of segments.slice(0, -1)) {
      currentPath = path.join(currentPath, segment);
      let stats: BigIntStats;
      try {
        stats = await fs.lstat(currentPath, { bigint: true });
      } catch (error) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_NOT_FOUND",
          "Local bounded object parent path does not exist.",
          { cause: error },
        );
      }
      const canonicalPath = await fs.realpath(currentPath);
      const identity = readReliableIdentity(stats);
      if (
        stats.isSymbolicLink() ||
        !stats.isDirectory() ||
        !identity ||
        !isPathInside(canonicalRoot, canonicalPath)
      ) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local bounded object parent path is not trusted.",
        );
      }
      components.push({ path: currentPath, identity });
    }
    return { rootIdentity, components };
  }

  async #verifyParentDirectorySnapshot(
    snapshot: ParentDirectorySnapshot,
  ): Promise<void> {
    try {
      const currentRootIdentity = await this.#inspectRoot();
      if (!identitiesMatch(currentRootIdentity, snapshot.rootIdentity)) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local bounded object root changed during the operation.",
        );
      }
      const canonicalRoot = await fs.realpath(this.#root);
      for (const component of snapshot.components) {
        const stats = await fs.lstat(component.path, { bigint: true });
        const identity = readReliableIdentity(stats);
        const canonicalPath = await fs.realpath(component.path);
        if (
          stats.isSymbolicLink() ||
          !stats.isDirectory() ||
          !identity ||
          !identitiesMatch(identity, component.identity) ||
          !isPathInside(canonicalRoot, canonicalPath)
        ) {
          throw new ObjectStorageError(
            "OBJECT_STORAGE_VERSION_MISMATCH",
            "Local bounded object parent identity changed.",
          );
        }
      }
    } catch (error) {
      if (error instanceof ObjectStorageError) {
        throw error;
      }
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object parent identity became unavailable.",
        { cause: error },
      );
    }
  }

  async #inspectRoot(): Promise<FileIdentity> {
    const parsedRoot = path.parse(this.#root);
    const relativeRoot = path.relative(parsedRoot.root, this.#root);
    let currentRootPath = parsedRoot.root;
    for (const segment of [
      ...(relativeRoot ? relativeRoot.split(path.sep) : []),
    ]) {
      currentRootPath = path.join(currentRootPath, segment);
      const component = await fs.lstat(currentRootPath, { bigint: true });
      if (component.isSymbolicLink()) {
        throw new ObjectStorageError(
          "OBJECT_STORAGE_VERSION_MISMATCH",
          "Local bounded object root contains a linked path component.",
        );
      }
    }

    let stats: BigIntStats;
    try {
      stats = await fs.lstat(this.#root, { bigint: true });
    } catch (error) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_NOT_FOUND",
        "Local bounded object root does not exist.",
        { cause: error },
      );
    }
    const identity = readReliableIdentity(stats);
    if (stats.isSymbolicLink() || !stats.isDirectory() || !identity) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object root is not a trusted directory.",
      );
    }
    return identity;
  }

  #resolveObjectKey(objectKey: string): string {
    if (
      !objectKey.startsWith("objects/") ||
      objectKey.includes("\0") ||
      objectKey.includes("..") ||
      path.isAbsolute(objectKey)
    ) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object key is invalid.",
      );
    }
    const resolved = path.resolve(this.#root, objectKey);
    const rootPrefix = `${this.#root}${path.sep}`;
    if (!resolved.startsWith(rootPrefix)) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_VERSION_MISMATCH",
        "Local bounded object key escapes its root.",
      );
    }
    return resolved;
  }
}

async function writeAll(
  handle: Awaited<ReturnType<typeof fs.open>>,
  bytes: Buffer,
): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const { bytesWritten } = await handle.write(
      bytes,
      offset,
      bytes.byteLength - offset,
    );
    if (bytesWritten <= 0) {
      throw new ObjectStorageError(
        "OBJECT_STORAGE_WRITE_UNCERTAIN",
        "Local bounded object write made no progress.",
      );
    }
    offset += bytesWritten;
  }
}
