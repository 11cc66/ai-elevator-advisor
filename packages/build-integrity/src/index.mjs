import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

export {
  executeGuardedBuild,
  inspectStartupEntrySecurity,
  ReleaseSecurityError,
  runBuildSecurityPreflight,
} from "./startup-security.mjs";

export const P13_MANIFEST_VERSION = 1;
export const P13_LIFECYCLE_SAFETY_VERSION = "1.0.0";
export const P13_SOURCE_TREE_EXCLUSION_POLICY_VERSION =
  "p13-l3-source-v1";

const MANIFEST_FIELDS = new Set([
  "manifestVersion",
  "application",
  "buildId",
  "releaseId",
  "gitSha",
  "gitDirty",
  "sourceTreeDigest",
  "sourceTreeExclusionPolicyVersion",
  "dependencyLockDigest",
  "runtimeDependencyDigest",
  "runtimeDependencyCount",
  "runtimePlatform",
  "artifactDigest",
  "artifactDigestAlgorithm",
  "buildTimestamp",
  "lifecycleSafetyVersion",
  "cleanupCapability",
  "artifactRoots",
]);

const SOURCE_EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".p13-build",
  ".p13-releases",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "output",
  "test-results",
]);

const SOURCE_EXCLUDED_FILE_NAMES = new Set([
  ".env",
  ".env.test",
  "p13-build-manifest.json",
]);

const SOURCE_EXCLUDED_EXTENSIONS = new Set([
  ".key",
  ".pem",
  ".tsbuildinfo",
]);

const MAX_SCANNED_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BUILD_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_BUILD_SKEW_MS = 5 * 60 * 1000;

export const P13_LEGACY_DELETE_MARKERS = Object.freeze([
  { id: "fs-rm", expression: /\bfs\.rm\s*\(/ },
  { id: "fs-unlink", expression: /\bfs\.unlink\s*\(/ },
  { id: "remove-staging", expression: /\.removeStaging\s*\(/ },
  { id: "remove-object", expression: /\.removeObject\s*\(/ },
  {
    id: "cleanup-orphan-objects",
    expression: /\.cleanupOrphanObjects\s*\(/,
  },
  { id: "cleanup-temp", expression: /\.cleanupTemp\s*\(/ },
  {
    id: "delete-object",
    expression: /(?:\bdeleteObject|\.deleteObject)\s*\(/,
  },
]);

export class BuildIntegrityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BuildIntegrityError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new BuildIntegrityError(code, message);
}

function isPlainObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function canonicalize(value) {
  if (value === null || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("CANONICAL_NUMBER_INVALID", "Non-finite numbers are not allowed.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize(value[key])}`,
      )
      .join(",")}}`;
  }
  fail(
    "CANONICAL_VALUE_INVALID",
    `Unsupported canonical JSON type: ${typeof value}.`,
  );
}

class StrictJsonParser {
  #text;
  #offset = 0;

  constructor(text) {
    this.#text = text;
  }

  parse() {
    const value = this.#parseValue();
    this.#skipWhitespace();
    if (this.#offset !== this.#text.length) {
      this.#error("JSON_TRAILING_CONTENT");
    }
    return value;
  }

  #parseValue() {
    this.#skipWhitespace();
    const character = this.#text[this.#offset];
    if (character === "{") {
      return this.#parseObject();
    }
    if (character === "[") {
      return this.#parseArray();
    }
    if (character === '"') {
      return this.#parseString();
    }
    if (character === "t") {
      return this.#parseLiteral("true", true);
    }
    if (character === "f") {
      return this.#parseLiteral("false", false);
    }
    if (character === "n") {
      return this.#parseLiteral("null", null);
    }
    if (character === "-" || (character >= "0" && character <= "9")) {
      return this.#parseNumber();
    }
    this.#error("JSON_VALUE_INVALID");
  }

  #parseObject() {
    this.#offset += 1;
    const result = Object.create(null);
    const keys = new Set();
    this.#skipWhitespace();
    if (this.#text[this.#offset] === "}") {
      this.#offset += 1;
      return result;
    }
    while (true) {
      this.#skipWhitespace();
      if (this.#text[this.#offset] !== '"') {
        this.#error("JSON_OBJECT_KEY_INVALID");
      }
      const key = this.#parseString();
      if (keys.has(key)) {
        this.#error("JSON_DUPLICATE_KEY");
      }
      keys.add(key);
      this.#skipWhitespace();
      if (this.#text[this.#offset] !== ":") {
        this.#error("JSON_COLON_REQUIRED");
      }
      this.#offset += 1;
      result[key] = this.#parseValue();
      this.#skipWhitespace();
      const delimiter = this.#text[this.#offset];
      if (delimiter === "}") {
        this.#offset += 1;
        return result;
      }
      if (delimiter !== ",") {
        this.#error("JSON_OBJECT_DELIMITER_INVALID");
      }
      this.#offset += 1;
    }
  }

  #parseArray() {
    this.#offset += 1;
    const result = [];
    this.#skipWhitespace();
    if (this.#text[this.#offset] === "]") {
      this.#offset += 1;
      return result;
    }
    while (true) {
      result.push(this.#parseValue());
      this.#skipWhitespace();
      const delimiter = this.#text[this.#offset];
      if (delimiter === "]") {
        this.#offset += 1;
        return result;
      }
      if (delimiter !== ",") {
        this.#error("JSON_ARRAY_DELIMITER_INVALID");
      }
      this.#offset += 1;
    }
  }

  #parseString() {
    const start = this.#offset;
    this.#offset += 1;
    let escaped = false;
    while (this.#offset < this.#text.length) {
      const character = this.#text[this.#offset];
      if (!escaped && character === '"') {
        this.#offset += 1;
        try {
          return JSON.parse(this.#text.slice(start, this.#offset));
        } catch {
          this.#error("JSON_STRING_INVALID");
        }
      }
      if (!escaped && character === "\\") {
        escaped = true;
      } else {
        escaped = false;
      }
      if (character.charCodeAt(0) < 0x20) {
        this.#error("JSON_CONTROL_CHARACTER");
      }
      this.#offset += 1;
    }
    this.#error("JSON_STRING_UNTERMINATED");
  }

  #parseNumber() {
    const remaining = this.#text.slice(this.#offset);
    const match = remaining.match(
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
    );
    if (!match) {
      this.#error("JSON_NUMBER_INVALID");
    }
    this.#offset += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) {
      this.#error("JSON_NUMBER_INVALID");
    }
    return value;
  }

  #parseLiteral(literal, value) {
    if (this.#text.slice(this.#offset, this.#offset + literal.length) !== literal) {
      this.#error("JSON_LITERAL_INVALID");
    }
    this.#offset += literal.length;
    return value;
  }

  #skipWhitespace() {
    while (
      this.#text[this.#offset] === " " ||
      this.#text[this.#offset] === "\n" ||
      this.#text[this.#offset] === "\r" ||
      this.#text[this.#offset] === "\t"
    ) {
      this.#offset += 1;
    }
  }

  #error(code) {
    fail(
      code,
      `Invalid JSON at byte offset ${this.#offset}.`,
    );
  }
}

export function parseStrictJson(value) {
  if (typeof value !== "string") {
    fail("JSON_TEXT_REQUIRED", "JSON input must be text.");
  }
  return new StrictJsonParser(value).parse();
}

function normalizeRelativePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.split("/").includes("..")
  ) {
    fail("PATH_INVALID", "Artifact path is invalid.");
  }
  return normalized;
}

async function assertRealDirectory(directory) {
  const stats = await fs.lstat(directory);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    fail(
      "DIRECTORY_IDENTITY_INVALID",
      "Artifact or source root must be a real directory.",
    );
  }
  await assertNoReparsePathComponents(directory);
}

async function assertNoReparsePathComponents(absolutePath) {
  const resolved = path.resolve(absolutePath);
  const parsed = path.parse(resolved);
  const relative = path.relative(parsed.root, resolved);
  if (!relative) {
    return;
  }
  let current = parsed.root;
  for (const segment of relative.split(path.sep)) {
    if (!segment) {
      continue;
    }
    current = path.join(current, segment);
    const stats = await fs.lstat(current);
    if (stats.isSymbolicLink()) {
      fail(
        "REPARSE_POINT_PATH_FORBIDDEN",
        `Security-sensitive path contains a symlink, junction, or reparse point: ${current}.`,
      );
    }
  }
}

async function readStableRegularFile(filePath, identityErrorCode) {
  let before;
  try {
    await assertNoReparsePathComponents(filePath);
    before = await fs.lstat(filePath, { bigint: true });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      fail(
        identityErrorCode,
        "Security-sensitive file does not exist.",
      );
    }
    throw error;
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    fail(
      identityErrorCode,
      "Security-sensitive file must be a regular file.",
    );
  }
  const content = await fs.readFile(filePath);
  const after = await fs.lstat(filePath, { bigint: true });
  if (
    after.isSymbolicLink() ||
    !after.isFile() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs
  ) {
    fail(
      `${identityErrorCode}_CHANGED`,
      "Security-sensitive file changed while it was being read.",
    );
  }
  return content;
}

function isPathInsideOneOf(target, roots) {
  const normalize = (value) => {
    const resolved = path.resolve(value);
    return process.platform === "win32"
      ? resolved.toLowerCase()
      : resolved;
  };
  const resolvedTarget = normalize(target);
  return roots.some((root) => {
    const resolvedRoot = normalize(root);
    return (
      resolvedTarget === resolvedRoot ||
      resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
    );
  });
}

async function walkRegularFiles(root, options = {}) {
  const files = [];
  const allowedSymlinkRoots = [];
  for (const item of options.allowedSymlinkRoots ?? []) {
    try {
      allowedSymlinkRoots.push(await fs.realpath(item));
    } catch {
      allowedSymlinkRoots.push(path.resolve(item));
    }
  }

  async function walk(directory, logicalDirectory, activeTargets) {
    const entries = await fs.readdir(directory, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const logicalPath = logicalDirectory
        ? `${logicalDirectory}/${entry.name}`
        : entry.name;
      const relativePath = normalizeRelativePath(logicalPath);
      if (options.shouldSkip?.(relativePath)) {
        continue;
      }
      const stats = await fs.lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        if (allowedSymlinkRoots.length === 0) {
          fail(
            "SYMLINK_FORBIDDEN",
            `Artifact and source trees must not contain symlinks: ${relativePath}.`,
          );
        }
        const target = await fs.realpath(absolutePath);
        if (!isPathInsideOneOf(target, allowedSymlinkRoots)) {
          fail(
            "SYMLINK_TARGET_FORBIDDEN",
            `Symlink target is outside allowed roots: ${relativePath}.`,
          );
        }
        if (activeTargets.has(target)) {
          fail(
            "SYMLINK_CYCLE",
            `Symlink cycle detected: ${relativePath}.`,
          );
        }
        const targetStats = await fs.stat(target);
        if (targetStats.isDirectory()) {
          await walk(
            target,
            relativePath,
            new Set([...activeTargets, target]),
          );
          continue;
        }
        if (!targetStats.isFile()) {
          fail(
            "SPECIAL_FILE_FORBIDDEN",
            "Only regular files are supported.",
          );
        }
        files.push({
          absolutePath: target,
          relativePath,
        });
        continue;
      }
      if (stats.isDirectory()) {
        await walk(
          absolutePath,
          relativePath,
          new Set([...activeTargets, absolutePath]),
        );
        continue;
      }
      if (!stats.isFile()) {
        fail(
          "SPECIAL_FILE_FORBIDDEN",
          "Only regular files are supported.",
        );
      }
      files.push({
        absolutePath,
        relativePath,
      });
    }
  }
  await walk(root, "", new Set([path.resolve(root)]));
  return files.sort((left, right) =>
    left.relativePath < right.relativePath
      ? -1
      : left.relativePath > right.relativePath
        ? 1
        : 0,
  );
}

function shouldExcludeSourcePath(relativePath) {
  const segments = relativePath.split("/");
  if (
    segments.some((segment) =>
      SOURCE_EXCLUDED_DIRECTORIES.has(segment),
    )
  ) {
    return true;
  }
  const fileName = segments.at(-1);
  if (
    fileName === undefined ||
    SOURCE_EXCLUDED_FILE_NAMES.has(fileName) ||
    fileName.startsWith(".env.")
  ) {
    return true;
  }
  return SOURCE_EXCLUDED_EXTENSIONS.has(path.extname(fileName));
}

export async function computeSourceTreeDigest({ root }) {
  const absoluteRoot = path.resolve(root);
  await assertRealDirectory(absoluteRoot);
  const files = await walkRegularFiles(absoluteRoot, {
    shouldSkip: shouldExcludeSourcePath,
  });
  const hash = createHash("sha256");
  hash.update(
    `policy:${P13_SOURCE_TREE_EXCLUSION_POLICY_VERSION}\0`,
  );
  for (const file of files) {
    const before = await fs.stat(file.absolutePath, { bigint: true });
    const content = await fs.readFile(file.absolutePath);
    const after = await fs.stat(file.absolutePath, { bigint: true });
    if (
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs
    ) {
      fail(
        "SOURCE_FILE_CHANGED_DURING_DIGEST",
        "Source file changed while hashing.",
      );
    }
    const pathBytes = Buffer.from(file.relativePath, "utf8");
    hash.update(`${pathBytes.length}:`);
    hash.update(pathBytes);
    hash.update(`:${content.length}:`);
    hash.update(content);
    hash.update("\0");
  }
  return {
    digest: hash.digest("hex"),
    fileCount: files.length,
    exclusionPolicyVersion:
      P13_SOURCE_TREE_EXCLUSION_POLICY_VERSION,
  };
}

export async function computeArtifactDigest({
  root,
  excludedRelativePaths = [],
  allowedSymlinkRoots = [],
}) {
  const absoluteRoot = path.resolve(root);
  await assertRealDirectory(absoluteRoot);
  const excluded = new Set(
    excludedRelativePaths.map(normalizeRelativePath),
  );
  const files = (await walkRegularFiles(absoluteRoot, {
    allowedSymlinkRoots,
  })).filter(
    (file) => !excluded.has(file.relativePath),
  );
  const casePaths = new Set();
  const hash = createHash("sha256");
  let totalBytes = 0;
  for (const file of files) {
    const caseKey = file.relativePath.toLowerCase();
    if (casePaths.has(caseKey)) {
      fail(
        "DUPLICATE_CASE_INSENSITIVE_PATH",
        "Artifact contains ambiguous case-insensitive paths.",
      );
    }
    casePaths.add(caseKey);
    const before = await fs.stat(file.absolutePath, { bigint: true });
    const content = await fs.readFile(file.absolutePath);
    const after = await fs.stat(file.absolutePath, { bigint: true });
    if (
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      BigInt(content.length) !== before.size
    ) {
      fail(
        "ARTIFACT_FILE_CHANGED_DURING_DIGEST",
        "Artifact file changed while hashing.",
      );
    }
    const pathBytes = Buffer.from(file.relativePath, "utf8");
    hash.update(`${pathBytes.length}:`);
    hash.update(pathBytes);
    hash.update(`:${content.length}:`);
    hash.update(content);
    hash.update("\0");
    totalBytes += content.length;
  }
  return {
    digest: hash.digest("hex"),
    fileCount: files.length,
    totalBytes,
  };
}

export async function computeFileDigest(filePath) {
  return createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

async function readPackageJson(packageRoot) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const value = parseStrictJson(
    await fs.readFile(packageJsonPath, "utf8"),
  );
  if (!isPlainObject(value) || typeof value.name !== "string") {
    fail(
      "PACKAGE_JSON_INVALID",
      "Installed package.json is invalid.",
    );
  }
  return value;
}

async function packageRootFromResolvedFile(
  resolvedFile,
  dependencyName,
) {
  let current = path.dirname(resolvedFile);
  while (true) {
    const candidate = path.join(current, "package.json");
    try {
      const packageJson = await readPackageJson(current);
      if (packageJson.name === dependencyName) {
        return await fs.realpath(current);
      }
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ENOENT"
        )
      ) {
        throw error;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  fail(
    "DEPENDENCY_PACKAGE_ROOT_NOT_FOUND",
    `Cannot locate package root for ${dependencyName}.`,
  );
}

async function resolveRuntimeDependency(
  dependencyName,
  fromPackageRoot,
) {
  const requireFromPackage = createRequire(
    path.join(fromPackageRoot, "package.json"),
  );
  try {
    return await packageRootFromResolvedFile(
      requireFromPackage.resolve(`${dependencyName}/package.json`),
      dependencyName,
    );
  } catch {
    try {
      return await packageRootFromResolvedFile(
        requireFromPackage.resolve(dependencyName),
        dependencyName,
      );
    } catch {
      let current = fromPackageRoot;
      while (true) {
        const candidate = path.join(
          current,
          "node_modules",
          ...dependencyName.split("/"),
          "package.json",
        );
        try {
          await fs.access(candidate);
          const packageRoot = path.dirname(candidate);
          return await fs.realpath(packageRoot);
        } catch (error) {
          if (
            !(
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "ENOENT"
            )
          ) {
            throw error;
          }
        }
        const parent = path.dirname(current);
        if (parent === current) {
          return null;
        }
        current = parent;
      }
    }
  }
}

async function digestInstalledPackage(packageRoot) {
  const files = await walkRegularFiles(packageRoot, {
    shouldSkip: (relativePath) =>
      relativePath.split("/").includes("node_modules"),
  });
  const hash = createHash("sha256");
  let totalBytes = 0;
  let hasNativeAddon = false;
  const results = new Array(files.length);
  let nextIndex = 0;
  const workerCount = Math.min(32, files.length);
  async function hashWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= files.length) {
        return;
      }
      const file = files[index];
      const before = await fs.stat(file.absolutePath, {
        bigint: true,
      });
      const content = await fs.readFile(file.absolutePath);
      const after = await fs.stat(file.absolutePath, {
        bigint: true,
      });
      if (
        before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs
      ) {
        fail(
          "DEPENDENCY_FILE_CHANGED_DURING_DIGEST",
          "Runtime dependency changed while hashing.",
        );
      }
      results[index] = content;
    }
  }
  await Promise.all(
    Array.from({ length: workerCount }, () => hashWorker()),
  );
  for (const [index, file] of files.entries()) {
    const content = results[index];
    if (file.relativePath.endsWith(".node")) {
      hasNativeAddon = true;
    }
    const pathBytes = Buffer.from(file.relativePath, "utf8");
    hash.update(`${pathBytes.length}:`);
    hash.update(pathBytes);
    hash.update(`:${content.length}:`);
    hash.update(content);
    hash.update("\0");
    totalBytes += content.length;
  }
  return {
    digest: hash.digest("hex"),
    fileCount: files.length,
    totalBytes,
    hasNativeAddon,
  };
}

export async function computeRuntimeDependencyClosure({
  applicationRoot,
}) {
  const requestedRoot = path.resolve(applicationRoot);
  await assertRealDirectory(requestedRoot);
  const root = await fs.realpath(requestedRoot);
  const applicationPackage = await readPackageJson(root);
  const packages = new Map();
  const missingOptionalDependencies = new Set();
  const visiting = new Set();

  async function visitDependencies(packageRoot) {
    const realPackageRoot = await fs.realpath(packageRoot);
    if (visiting.has(realPackageRoot)) {
      return;
    }
    visiting.add(realPackageRoot);
    const packageJson = await readPackageJson(realPackageRoot);
    const required = {
      ...(isPlainObject(packageJson.dependencies)
        ? packageJson.dependencies
        : {}),
    };
    const optional = {
      ...(isPlainObject(packageJson.optionalDependencies)
        ? packageJson.optionalDependencies
        : {}),
    };
    const peers = {
      ...(isPlainObject(packageJson.peerDependencies)
        ? packageJson.peerDependencies
        : {}),
    };

    for (const [dependencyName, version] of Object.entries(required)) {
      if (dependencyName.startsWith("node:")) {
        continue;
      }
      const resolved = await resolveRuntimeDependency(
        dependencyName,
        realPackageRoot,
      );
      if (!resolved) {
        fail(
          "RUNTIME_DEPENDENCY_MISSING",
          `Required runtime dependency is missing: ${dependencyName}.`,
        );
      }
      await includePackage(resolved, version);
    }
    for (const [dependencyName, version] of Object.entries({
      ...optional,
      ...peers,
    })) {
      if (dependencyName.startsWith("node:")) {
        continue;
      }
      const resolved = await resolveRuntimeDependency(
        dependencyName,
        realPackageRoot,
      );
      if (!resolved) {
        missingOptionalDependencies.add(
          `${packageJson.name}:${dependencyName}@${version}`,
        );
        continue;
      }
      await includePackage(resolved, version);
    }
    visiting.delete(realPackageRoot);
  }

  async function includePackage(packageRoot, requestedVersion) {
    const realPackageRoot = await fs.realpath(packageRoot);
    const packageJson = await readPackageJson(realPackageRoot);
    const identity = `${packageJson.name}@${packageJson.version}`;
    if (packages.has(identity)) {
      return;
    }
    const packageDigest = await digestInstalledPackage(realPackageRoot);
    packages.set(identity, {
      name: packageJson.name,
      version: packageJson.version,
      requestedVersion,
      digest: packageDigest.digest,
      fileCount: packageDigest.fileCount,
      totalBytes: packageDigest.totalBytes,
      hasNativeAddon: packageDigest.hasNativeAddon,
    });
    await visitDependencies(realPackageRoot);
  }

  await visitDependencies(root);
  const sortedPackages = [...packages.values()].sort((left, right) =>
    left.name === right.name
      ? left.version < right.version
        ? -1
        : left.version > right.version
          ? 1
          : 0
      : left.name < right.name
        ? -1
        : 1,
  );
  const sortedMissing = [...missingOptionalDependencies].sort();
  const runtimeIdentity = canonicalize({
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    packages: sortedPackages,
    missingOptionalDependencies: sortedMissing,
  });
  return {
    digest: createHash("sha256")
      .update(runtimeIdentity)
      .digest("hex"),
    packageCount: sortedPackages.length,
    fileCount: sortedPackages.reduce(
      (total, item) => total + item.fileCount,
      0,
    ),
    totalBytes: sortedPackages.reduce(
      (total, item) => total + item.totalBytes,
      0,
    ),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    nativePackages: sortedPackages
      .filter((item) => item.hasNativeAddon)
      .map((item) => `${item.name}@${item.version}`),
    missingOptionalDependencies: sortedMissing,
  };
}

export async function scanArtifactForLegacyDelete(
  root,
  { allowedSymlinkRoots = [] } = {},
) {
  const absoluteRoot = path.resolve(root);
  await assertRealDirectory(absoluteRoot);
  const findings = [];
  for (const file of await walkRegularFiles(absoluteRoot, {
    allowedSymlinkRoots,
  })) {
    const extension = path.extname(file.absolutePath).toLowerCase();
    if (
      ![".cjs", ".html", ".js", ".json", ".map", ".mjs", ".ts", ".txt"].includes(
        extension,
      )
    ) {
      continue;
    }
    const stats = await fs.lstat(file.absolutePath);
    if (stats.size > MAX_SCANNED_FILE_BYTES) {
      continue;
    }
    const bytes = await fs.readFile(file.absolutePath);
    if (bytes.subarray(0, 1024).includes(0)) {
      continue;
    }
    const content = bytes.toString("utf8");
    for (const marker of P13_LEGACY_DELETE_MARKERS) {
      const match = marker.expression.exec(content);
      if (!match || match.index === undefined) {
        continue;
      }
      findings.push({
        relativePath: file.relativePath,
        markerId: marker.id,
        line: content.slice(0, match.index).split("\n").length,
      });
    }
  }
  return findings;
}

export function createBuildManifest(input) {
  if (!/^[0-9a-f]{40}$/i.test(input.gitSha)) {
    fail("GIT_SHA_INVALID", "Git SHA must be 40 hexadecimal characters.");
  }
  for (const [name, value] of [
    ["sourceTreeDigest", input.sourceTreeDigest],
    ["dependencyLockDigest", input.dependencyLockDigest],
    ["runtimeDependencyDigest", input.runtimeDependencyDigest],
    ["artifactDigest", input.artifactDigest],
  ]) {
    if (!/^[0-9a-f]{64}$/i.test(value)) {
      fail(`${name.toUpperCase()}_INVALID`, `${name} must be SHA-256.`);
    }
  }
  if (
    !Number.isSafeInteger(input.runtimeDependencyCount) ||
    input.runtimeDependencyCount < 0 ||
    typeof input.runtimePlatform !== "string" ||
    input.runtimePlatform.length === 0
  ) {
    fail(
      "RUNTIME_DEPENDENCY_IDENTITY_INVALID",
      "Runtime dependency identity is invalid.",
    );
  }
  const buildTimestamp = new Date().toISOString();
  const lifecycleSafetyVersion =
    input.lifecycleSafetyVersion ?? P13_LIFECYCLE_SAFETY_VERSION;
  if (
    compareLifecycleSafetyVersions(
      lifecycleSafetyVersion,
      P13_LIFECYCLE_SAFETY_VERSION,
    ) < 0
  ) {
    fail(
      "LIFECYCLE_SAFETY_VERSION_TOO_OLD",
      "Lifecycle safety version is too old.",
    );
  }
  const buildId = createHash("sha256")
    .update(
      [
        input.application,
        input.gitSha,
        input.sourceTreeDigest,
        input.dependencyLockDigest,
        input.runtimeDependencyDigest,
        input.artifactDigest,
        buildTimestamp,
      ].join("\0"),
    )
    .digest("hex")
    .slice(0, 32);
  const releaseId =
    input.releaseId ??
    `p13-${input.gitSha.slice(0, 12)}-${input.sourceTreeDigest.slice(0, 16)}`;
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(releaseId)) {
    fail("RELEASE_ID_INVALID", "Release ID is invalid.");
  }
  return {
    manifestVersion: P13_MANIFEST_VERSION,
    application: input.application,
    buildId,
    releaseId,
    gitSha: input.gitSha.toLowerCase(),
    gitDirty: input.gitDirty,
    sourceTreeDigest: input.sourceTreeDigest.toLowerCase(),
    sourceTreeExclusionPolicyVersion:
      P13_SOURCE_TREE_EXCLUSION_POLICY_VERSION,
    dependencyLockDigest: input.dependencyLockDigest.toLowerCase(),
    runtimeDependencyDigest:
      input.runtimeDependencyDigest.toLowerCase(),
    runtimeDependencyCount: input.runtimeDependencyCount,
    runtimePlatform: input.runtimePlatform,
    artifactDigest: input.artifactDigest.toLowerCase(),
    artifactDigestAlgorithm: "sha256",
    buildTimestamp,
    lifecycleSafetyVersion,
    cleanupCapability: "DISABLED",
    artifactRoots: input.artifactRoots ?? ["."],
  };
}

export async function validateSigningPrivateKeyPath(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const artifactRoot = path.resolve(input.artifactRoot);
  const privateKeyPath = path.resolve(input.privateKeyPath);
  for (const [label, forbiddenRoot] of [
    ["source", workspaceRoot],
    ["artifact", artifactRoot],
  ]) {
    const relative = path.relative(forbiddenRoot, privateKeyPath);
    if (
      relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative))
    ) {
      fail(
        "PRIVATE_KEY_PATH_FORBIDDEN",
        `Signing private key must not be inside the ${label} tree.`,
      );
    }
  }
  await assertNoReparsePathComponents(privateKeyPath);
  const privateKeyStats = await fs.lstat(privateKeyPath);
  if (privateKeyStats.isSymbolicLink() || !privateKeyStats.isFile()) {
    fail(
      "PRIVATE_KEY_IDENTITY_INVALID",
      "Signing private key must be a regular file.",
    );
  }
  return privateKeyPath;
}

export async function generateSignedReleaseManifest(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const artifactRoot = path.resolve(input.artifactRoot);
  const runtimeRoot = path.resolve(input.runtimeRoot);
  const privateKeyPath = await validateSigningPrivateKeyPath({
    workspaceRoot,
    artifactRoot,
    privateKeyPath: input.privateKeyPath,
  });
  const allowedSymlinkRoots = [
    artifactRoot,
    runtimeRoot,
    path.join(runtimeRoot, "node_modules"),
    path.join(workspaceRoot, "node_modules"),
    path.join(workspaceRoot, "packages"),
    ...(input.allowedSymlinkRoots ?? []),
  ];
  const manifestFileName =
    input.manifestFileName ?? "p13-build-manifest.json";
  const sourceTree = await computeSourceTreeDigest({
    root: workspaceRoot,
  });
  const dependencyLockDigest = await computeFileDigest(
    path.join(workspaceRoot, "pnpm-lock.yaml"),
  );
  const runtimeDependency = await computeRuntimeDependencyClosure({
    applicationRoot: runtimeRoot,
  });
  const artifactDigest = await computeArtifactDigest({
    root: artifactRoot,
    excludedRelativePaths: [manifestFileName],
    allowedSymlinkRoots,
  });
  const legacyFindings = await scanArtifactForLegacyDelete(
    artifactRoot,
    { allowedSymlinkRoots },
  );
  if (legacyFindings.length > 0) {
    fail(
      "LEGACY_DELETE_CAPABILITY_DETECTED",
      "Legacy cleanup capability is present in the release.",
    );
  }
  const manifest = createBuildManifest({
    application: input.application,
    releaseId: input.releaseId,
    gitSha: input.gitSha,
    gitDirty: input.gitDirty,
    sourceTreeDigest: sourceTree.digest,
    dependencyLockDigest,
    runtimeDependencyDigest: runtimeDependency.digest,
    runtimeDependencyCount: runtimeDependency.packageCount,
    runtimePlatform: `${runtimeDependency.platform}-${runtimeDependency.arch}:${runtimeDependency.nodeVersion}`,
    artifactDigest: artifactDigest.digest,
  });
  const privateKeyPem = await fs.readFile(
    privateKeyPath,
    "utf8",
  );
  const envelope = signBuildManifest(
    manifest,
    privateKeyPem,
    input.keyId,
  );
  const manifestPath = path.join(
    /* turbopackIgnore: true */ artifactRoot,
    manifestFileName,
  );
  const temporaryPath = `${manifestPath}.${process.pid}.tmp`;
  await fs.writeFile(
    temporaryPath,
    `${canonicalize(envelope)}\n`,
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
  await fs.rename(temporaryPath, manifestPath);
  return {
    manifestPath,
    manifest,
    signatureKeyId: input.keyId,
  };
}

export function signBuildManifest(manifest, privateKeyPem, keyId) {
  validateManifestShape(manifest);
  if (!keyId || typeof keyId !== "string") {
    fail("KEY_ID_REQUIRED", "Signing key ID is required.");
  }
  const payload = Buffer.from(canonicalize(manifest), "utf8");
  const signature = sign(null, payload, createPrivateKey(privateKeyPem));
  return {
    manifest,
    signature: {
      algorithm: "ed25519",
      keyId,
      value: signature.toString("base64url"),
    },
  };
}

export function compareLifecycleSafetyVersions(left, right) {
  if (
    !/^\d+(?:\.\d+){0,2}$/.test(left) ||
    !/^\d+(?:\.\d+){0,2}$/.test(right)
  ) {
    fail(
      "LIFECYCLE_SAFETY_VERSION_INVALID",
      "Lifecycle safety version is invalid.",
    );
  }
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference =
      (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function validateManifestShape(manifest) {
  if (!isPlainObject(manifest)) {
    fail("MANIFEST_INVALID", "Manifest must be an object.");
  }
  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.has(key)) {
      fail("MANIFEST_UNKNOWN_FIELD", `Unknown manifest field: ${key}.`);
    }
  }
  for (const key of MANIFEST_FIELDS) {
    if (!(key in manifest)) {
      fail("MANIFEST_MISSING_FIELD", `Missing manifest field: ${key}.`);
    }
  }
  if (manifest.manifestVersion !== P13_MANIFEST_VERSION) {
    fail("MANIFEST_VERSION_UNSUPPORTED", "Manifest version is unsupported.");
  }
  if (manifest.application !== "web" && manifest.application !== "worker") {
    fail("APPLICATION_INVALID", "Manifest application is invalid.");
  }
  if (
    typeof manifest.buildId !== "string" ||
    !/^[0-9a-f]{32}$/i.test(manifest.buildId)
  ) {
    fail("BUILD_ID_INVALID", "Build ID is invalid.");
  }
  if (
    typeof manifest.releaseId !== "string" ||
    !/^[A-Za-z0-9._-]{1,120}$/.test(manifest.releaseId)
  ) {
    fail("RELEASE_ID_INVALID", "Release ID is invalid.");
  }
  if (
    typeof manifest.gitSha !== "string" ||
    !/^[0-9a-f]{40}$/i.test(manifest.gitSha)
  ) {
    fail("GIT_SHA_INVALID", "Git SHA is invalid.");
  }
  if (typeof manifest.gitDirty !== "boolean") {
    fail("GIT_DIRTY_INVALID", "Git dirty flag is invalid.");
  }
  for (const field of [
    "sourceTreeDigest",
    "dependencyLockDigest",
    "runtimeDependencyDigest",
    "artifactDigest",
  ]) {
    if (
      typeof manifest[field] !== "string" ||
      !/^[0-9a-f]{64}$/i.test(manifest[field])
    ) {
      fail(`${field.toUpperCase()}_INVALID`, `${field} is invalid.`);
    }
  }
  if (
    !Number.isSafeInteger(manifest.runtimeDependencyCount) ||
    manifest.runtimeDependencyCount < 0 ||
    typeof manifest.runtimePlatform !== "string" ||
    manifest.runtimePlatform.length === 0
  ) {
    fail(
      "RUNTIME_DEPENDENCY_IDENTITY_INVALID",
      "Runtime dependency identity is invalid.",
    );
  }
  if (
    manifest.sourceTreeExclusionPolicyVersion !==
    P13_SOURCE_TREE_EXCLUSION_POLICY_VERSION
  ) {
    fail(
      "SOURCE_TREE_EXCLUSION_POLICY_INVALID",
      "Source tree exclusion policy is unsupported.",
    );
  }
  if (manifest.artifactDigestAlgorithm !== "sha256") {
    fail(
      "ARTIFACT_DIGEST_ALGORITHM_INVALID",
      "Artifact digest algorithm must be sha256.",
    );
  }
  if (manifest.cleanupCapability !== "DISABLED") {
    fail(
      "CLEANUP_CAPABILITY_NOT_DISABLED",
      "Cleanup capability must be DISABLED.",
    );
  }
  if (!Array.isArray(manifest.artifactRoots) || manifest.artifactRoots.length === 0) {
    fail("ARTIFACT_ROOTS_INVALID", "Artifact roots are invalid.");
  }
  if (
    manifest.artifactRoots.some(
      (root) =>
        typeof root !== "string" ||
        !root ||
        root.startsWith("/") ||
        root.split("/").includes(".."),
    )
  ) {
    fail("ARTIFACT_ROOTS_INVALID", "Artifact roots are invalid.");
  }
  if (
    typeof manifest.buildTimestamp !== "string" ||
    Number.isNaN(Date.parse(manifest.buildTimestamp))
  ) {
    fail("BUILD_TIMESTAMP_INVALID", "Build timestamp is invalid.");
  }
  if (
    typeof manifest.lifecycleSafetyVersion !== "string" ||
    !/^\d+(?:\.\d+){0,2}$/.test(
      manifest.lifecycleSafetyVersion,
    )
  ) {
    fail(
      "LIFECYCLE_SAFETY_VERSION_INVALID",
      "Lifecycle safety version is invalid.",
    );
  }
}

export function verifySignedBuildManifest({
  envelope,
  trustedPublicKeys,
}) {
  if (!isPlainObject(envelope)) {
    fail("SIGNED_MANIFEST_INVALID", "Signed manifest must be an object.");
  }
  const envelopeKeys = Object.keys(envelope).sort();
  if (
    envelopeKeys.length !== 2 ||
    envelopeKeys[0] !== "manifest" ||
    envelopeKeys[1] !== "signature"
  ) {
    fail(
      "SIGNED_MANIFEST_FIELDS_INVALID",
      "Signed manifest fields are invalid.",
    );
  }
  const manifest = envelope.manifest;
  const signature = envelope.signature;
  validateManifestShape(manifest);
  if (
    !isPlainObject(signature) ||
    signature.algorithm !== "ed25519" ||
    typeof signature.keyId !== "string" ||
    typeof signature.value !== "string"
  ) {
    fail("SIGNATURE_INVALID", "Manifest signature is invalid.");
  }
  const keys =
    trustedPublicKeys instanceof Map
      ? trustedPublicKeys
      : new Map(Object.entries(trustedPublicKeys ?? {}));
  const publicKeyPem = keys.get(signature.keyId);
  if (!publicKeyPem) {
    fail("UNTRUSTED_SIGNING_KEY", "Manifest signing key is not trusted.");
  }
  const valid = verify(
    null,
    Buffer.from(canonicalize(manifest), "utf8"),
    createPublicKey(publicKeyPem),
    Buffer.from(signature.value, "base64url"),
  );
  if (!valid) {
    fail("SIGNATURE_INVALID", "Manifest signature is invalid.");
  }
  return manifest;
}

export async function loadTrustedPublicKeys(filePath) {
  const raw = parseStrictJson(
    (
      await readStableRegularFile(
        filePath,
        "TRUST_ROOT_IDENTITY_INVALID",
      )
    ).toString("utf8"),
  );
  if (
    !isPlainObject(raw) ||
    !isPlainObject(raw.keys) ||
    Object.keys(raw).length !== 1
  ) {
    fail("TRUST_ROOT_INVALID", "Trusted key file is invalid.");
  }
  const keys = new Map();
  for (const [keyId, publicKeyPem] of Object.entries(raw.keys)) {
    if (typeof publicKeyPem !== "string" || publicKeyPem.length === 0) {
      fail("TRUST_ROOT_INVALID", "Trusted public key is invalid.");
    }
    keys.set(keyId, publicKeyPem);
  }
  if (keys.size === 0) {
    fail("TRUST_ROOT_EMPTY", "Trusted key set is empty.");
  }
  return keys;
}

export async function verifyStartupRelease({
  releaseRoot,
  runtimeRoot,
  manifestPath,
  trustedPublicKeysPath,
  expected,
}) {
  const absoluteRoot = path.resolve(releaseRoot);
  const absoluteRuntimeRoot = path.resolve(runtimeRoot);
  const workspaceRoot = path.resolve(absoluteRuntimeRoot, "../..");
  const allowedSymlinkRoots = [
    absoluteRoot,
    absoluteRuntimeRoot,
    path.join(absoluteRuntimeRoot, "node_modules"),
    path.join(workspaceRoot, "node_modules"),
    path.join(workspaceRoot, "packages"),
  ];
  await assertRealDirectory(absoluteRoot);
  const trustedPublicKeys = await loadTrustedPublicKeys(
    trustedPublicKeysPath,
  );
  const envelope = parseStrictJson(
    (
      await readStableRegularFile(
        manifestPath,
        "MANIFEST_IDENTITY_INVALID",
      )
    ).toString("utf8"),
  );
  const manifest = verifySignedBuildManifest({
    envelope,
    trustedPublicKeys,
  });
  if (manifest.application !== expected.application) {
    fail("APPLICATION_MISMATCH", "Manifest application does not match.");
  }
  if (manifest.gitSha !== expected.gitSha.toLowerCase()) {
    fail("GIT_SHA_MISMATCH", "Manifest Git SHA does not match.");
  }
  if (manifest.releaseId !== expected.releaseId) {
    fail("RELEASE_ID_MISMATCH", "Manifest release ID does not match.");
  }
  const minimum =
    expected.minimumLifecycleSafetyVersion ??
    P13_LIFECYCLE_SAFETY_VERSION;
  if (
    compareLifecycleSafetyVersions(
      manifest.lifecycleSafetyVersion,
      minimum,
    ) < 0
  ) {
    fail(
      "LIFECYCLE_SAFETY_VERSION_TOO_OLD",
      "Lifecycle safety version is too old.",
    );
  }
  const buildTimestamp = Date.parse(manifest.buildTimestamp);
  const now = Date.now();
  if (buildTimestamp > now + MAX_FUTURE_BUILD_SKEW_MS) {
    fail(
      "BUILD_TIMESTAMP_IN_FUTURE",
      "Build timestamp is in the future.",
    );
  }
  if (now - buildTimestamp > MAX_BUILD_AGE_MS) {
    fail("BUILD_EXPIRED", "Build manifest is older than policy.");
  }
  if (manifest.artifactRoots.join(",") !== ".") {
    fail(
      "ARTIFACT_ROOT_SCOPE_UNSUPPORTED",
      "Startup gate supports one release root.",
    );
  }
  const relativeManifestPath = normalizeRelativePath(
    path.relative(absoluteRoot, path.resolve(manifestPath)),
  );
  const artifactDigest = await computeArtifactDigest({
    root: absoluteRoot,
    excludedRelativePaths: [relativeManifestPath],
    allowedSymlinkRoots,
  });
  if (artifactDigest.digest !== manifest.artifactDigest) {
    fail(
      "ARTIFACT_DIGEST_MISMATCH",
      "Artifact digest does not match manifest.",
    );
  }
  const runtimeDependency = await computeRuntimeDependencyClosure({
    applicationRoot: runtimeRoot,
  });
  if (
    runtimeDependency.digest !==
    manifest.runtimeDependencyDigest
  ) {
    fail(
      "RUNTIME_DEPENDENCY_DIGEST_MISMATCH",
      "Runtime dependency closure does not match manifest.",
    );
  }
  if (
    runtimeDependency.packageCount !==
    manifest.runtimeDependencyCount
  ) {
    fail(
      "RUNTIME_DEPENDENCY_COUNT_MISMATCH",
      "Runtime dependency count does not match manifest.",
    );
  }
  const legacyFindings = (
    await scanArtifactForLegacyDelete(absoluteRoot, {
      allowedSymlinkRoots,
    })
  ).filter((finding) => finding.relativePath !== relativeManifestPath);
  if (legacyFindings.length > 0) {
    fail(
      "LEGACY_DELETE_CAPABILITY_DETECTED",
      "Legacy cleanup capability is present in the release.",
    );
  }
  return {
    manifest,
    artifactDigest,
    runtimeDependency,
    legacyFindings,
  };
}
