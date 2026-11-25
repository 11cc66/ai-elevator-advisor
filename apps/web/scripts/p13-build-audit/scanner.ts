import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ARTIFACT_DIRECTORY_NAMES = new Set([
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "out",
  "output",
  "test-results",
]);

const ARCHIVE_EXTENSIONS = new Set([
  ".7z",
  ".gz",
  ".rar",
  ".tar",
  ".tgz",
  ".zip",
]);

const CACHE_FILE_EXTENSIONS = new Set([".tsbuildinfo"]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
]);

const MAX_SCANNED_FILE_BYTES = 20 * 1024 * 1024;

export const LEGACY_DELETE_PATTERNS = [
  {
    id: "fs-rm",
    expression: /\bfs\.rm\s*\(/,
  },
  {
    id: "fs-unlink",
    expression: /\bfs\.unlink\s*\(/,
  },
  {
    id: "remove-staging",
    expression: /\.removeStaging\s*\(/,
  },
  {
    id: "remove-object",
    expression: /\.removeObject\s*\(/,
  },
  {
    id: "cleanup-orphan-objects",
    expression: /\.cleanupOrphanObjects\s*\(/,
  },
  {
    id: "cleanup-temp",
    expression: /\.cleanupTemp\s*\(/,
  },
  {
    id: "delete-object",
    expression: /(?:\bdeleteObject|\.deleteObject)\s*\(/,
  },
] as const;

export interface ArtifactRoot {
  id: string;
  relativePath: string;
  artifactType:
    | "WEB_SERVER_BUNDLE"
    | "WORKER_BUNDLE"
    | "PACKAGE_BUNDLE"
    | "CACHE"
    | "TEST_ARTIFACT"
    | "ARCHIVE"
    | "UNCLASSIFIED";
  buildId: string | null;
  directoryMtime: string | null;
  startupReachable: boolean;
  fileCount: number;
  totalBytes: number;
}

export interface DangerousArtifactFinding {
  artifactId: string;
  relativePath: string;
  markerId: string;
  line: number;
}

export interface BuildAuditResult {
  workspaceRoot: string;
  artifactRoots: ArtifactRoot[];
  dangerousFindings: DangerousArtifactFinding[];
}

export interface BuildManifest {
  application: "web" | "worker";
  buildId: string;
  gitSha: string;
  sourceTreeDigest: string;
  artifactDigest: string;
  buildTimestamp: string;
  lifecycleSafetyVersion: string;
  cleanupCapability: "DISABLED" | "ENABLED";
  manifestVersion: 1;
}

export interface BuildManifestExpectation {
  application: "web" | "worker";
  gitSha: string;
  artifactDigest: string;
  minimumLifecycleSafetyVersion: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  reasons: string[];
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference =
      (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function validateBuildManifest(
  input: unknown,
  expected: BuildManifestExpectation,
): ManifestValidationResult {
  const reasons: string[] = [];
  const manifest =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : null;

  if (!manifest) {
    return { valid: false, reasons: ["MANIFEST_INVALID"] };
  }

  const requiredStrings = [
    "buildId",
    "gitSha",
    "sourceTreeDigest",
    "artifactDigest",
    "buildTimestamp",
    "lifecycleSafetyVersion",
    "cleanupCapability",
  ] as const;

  for (const field of requiredStrings) {
    if (
      typeof manifest[field] !== "string" ||
      manifest[field].trim().length === 0
    ) {
      reasons.push(`MISSING_${field}`);
    }
  }

  if (manifest.manifestVersion !== 1) {
    reasons.push("MANIFEST_VERSION_UNSUPPORTED");
  }
  if (manifest.application !== expected.application) {
    reasons.push("APPLICATION_MISMATCH");
  }
  if (
    typeof manifest.gitSha !== "string" ||
    !/^[0-9a-f]{40}$/i.test(manifest.gitSha) ||
    manifest.gitSha.toLowerCase() !== expected.gitSha.toLowerCase()
  ) {
    reasons.push("GIT_SHA_MISMATCH");
  }
  for (const field of ["sourceTreeDigest", "artifactDigest"] as const) {
    if (
      typeof manifest[field] === "string" &&
      !/^[0-9a-f]{64}$/i.test(manifest[field])
    ) {
      reasons.push(`${field.toUpperCase()}_INVALID`);
    }
  }
  if (
    typeof manifest.artifactDigest !== "string" ||
    manifest.artifactDigest.toLowerCase() !==
      expected.artifactDigest.toLowerCase()
  ) {
    reasons.push("ARTIFACT_DIGEST_MISMATCH");
  }
  if (
    typeof manifest.buildTimestamp !== "string" ||
    Number.isNaN(Date.parse(manifest.buildTimestamp))
  ) {
    reasons.push("BUILD_TIMESTAMP_INVALID");
  }
  if (
    typeof manifest.lifecycleSafetyVersion !== "string" ||
    !/^\d+(?:\.\d+){0,2}$/.test(
      manifest.lifecycleSafetyVersion,
    ) ||
    compareVersions(
      manifest.lifecycleSafetyVersion,
      expected.minimumLifecycleSafetyVersion,
    ) < 0
  ) {
    reasons.push("LIFECYCLE_SAFETY_VERSION_TOO_OLD");
  }
  if (manifest.cleanupCapability !== "DISABLED") {
    reasons.push("CLEANUP_CAPABILITY_NOT_DISABLED");
  }

  return {
    valid: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

async function pathType(
  absolutePath: string,
): Promise<"file" | "directory" | "other"> {
  const stats = await fs.lstat(absolutePath);
  if (stats.isSymbolicLink()) {
    return "other";
  }
  if (stats.isDirectory()) {
    return "directory";
  }
  if (stats.isFile()) {
    return "file";
  }
  return "other";
}

async function collectTreeMetrics(
  absolutePath: string,
): Promise<{ fileCount: number; totalBytes: number }> {
  const stats = await fs.lstat(absolutePath);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    return {
      fileCount: stats.isFile() ? 1 : 0,
      totalBytes: stats.isFile() ? stats.size : 0,
    };
  }

  let fileCount = 0;
  let totalBytes = 0;
  const entries = await fs.readdir(absolutePath, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const entryPath = path.join(absolutePath, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      const nested = await collectTreeMetrics(entryPath);
      fileCount += nested.fileCount;
      totalBytes += nested.totalBytes;
      continue;
    }
    if (entry.isFile()) {
      const entryStats = await fs.lstat(entryPath);
      fileCount += 1;
      totalBytes += entryStats.size;
    }
  }
  return { fileCount, totalBytes };
}

async function discoverArtifacts(
  workspaceRoot: string,
): Promise<
  Array<{
    path: string;
    kind: "directory" | "archive" | "cache";
  }>
> {
  const discovered: Array<{
    path: string;
    kind: "directory" | "archive" | "cache";
  }> = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (
        entry.name === ".git" ||
        entry.name === "node_modules" ||
        entry.isSymbolicLink()
      ) {
        continue;
      }

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (ARTIFACT_DIRECTORY_NAMES.has(entry.name)) {
          discovered.push({ path: entryPath, kind: "directory" });
          continue;
        }
        await walk(entryPath);
        continue;
      }

      if (
        entry.isFile() &&
        ARCHIVE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ) {
        discovered.push({ path: entryPath, kind: "archive" });
        continue;
      }
      if (
        entry.isFile() &&
        CACHE_FILE_EXTENSIONS.has(
          path.extname(entry.name).toLowerCase(),
        )
      ) {
        discovered.push({ path: entryPath, kind: "cache" });
      }
    }
  }

  await walk(workspaceRoot);
  return discovered;
}

function artifactTypeFor(
  relativePath: string,
  kind: "directory" | "archive" | "cache",
): ArtifactRoot["artifactType"] {
  const normalized = relativePath.replaceAll("\\", "/");
  if (kind === "archive") {
    return "ARCHIVE";
  }
  if (kind === "cache") {
    return "CACHE";
  }
  if (normalized.endsWith("/.next")) {
    return "WEB_SERVER_BUNDLE";
  }
  if (
    normalized === "apps/worker/dist" ||
    normalized.endsWith("/apps/worker/dist")
  ) {
    return "WORKER_BUNDLE";
  }
  if (/(?:^|\/)(?:\.turbo|\.vercel)$/.test(normalized)) {
    return "CACHE";
  }
  if (/(?:^|\/)(?:coverage|test-results)$/.test(normalized)) {
    return "TEST_ARTIFACT";
  }
  if (
    /(?:^|\/)packages\//.test(normalized) &&
    normalized.endsWith("/dist")
  ) {
    return "PACKAGE_BUNDLE";
  }
  return "UNCLASSIFIED";
}

function isStartupReachable(
  artifactType: ArtifactRoot["artifactType"],
): boolean {
  return [
    "WEB_SERVER_BUNDLE",
    "WORKER_BUNDLE",
    "PACKAGE_BUNDLE",
  ].includes(artifactType);
}

async function readOptionalBuildId(
  absolutePath: string,
  artifactType: ArtifactRoot["artifactType"],
): Promise<string | null> {
  if (artifactType !== "WEB_SERVER_BUNDLE") {
    return null;
  }
  try {
    const value = await fs.readFile(
      path.join(absolutePath, "BUILD_ID"),
      "utf8",
    );
    return value.trim() || null;
  } catch {
    return null;
  }
}

async function scanTextFile(input: {
  workspaceRoot: string;
  artifactId: string;
  absolutePath: string;
}): Promise<DangerousArtifactFinding[]> {
  const extension = path.extname(input.absolutePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) {
    return [];
  }
  const stats = await fs.lstat(input.absolutePath);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size > MAX_SCANNED_FILE_BYTES
  ) {
    return [];
  }

  const bytes = await fs.readFile(input.absolutePath);
  if (bytes.subarray(0, 1024).includes(0)) {
    return [];
  }
  const content = bytes.toString("utf8");
  const findings: DangerousArtifactFinding[] = [];
  for (const pattern of LEGACY_DELETE_PATTERNS) {
    const match = pattern.expression.exec(content);
    if (!match || match.index === undefined) {
      continue;
    }
    findings.push({
      artifactId: input.artifactId,
      relativePath: path
        .relative(input.workspaceRoot, input.absolutePath)
        .replaceAll("\\", "/"),
      markerId: pattern.id,
      line:
        content.slice(0, match.index).split("\n").length,
    });
  }
  return findings;
}

async function scanArtifactTree(input: {
  workspaceRoot: string;
  artifact: ArtifactRoot;
}): Promise<DangerousArtifactFinding[]> {
  const absoluteRoot = path.join(
    input.workspaceRoot,
    input.artifact.relativePath,
  );
  const findings: DangerousArtifactFinding[] = [];

  async function walk(absolutePath: string): Promise<void> {
    const type = await pathType(absolutePath);
    if (type === "other") {
      return;
    }
    if (type === "file") {
      findings.push(
        ...(await scanTextFile({
          workspaceRoot: input.workspaceRoot,
          artifactId: input.artifact.id,
          absolutePath,
        })),
      );
      return;
    }
    const entries = await fs.readdir(absolutePath, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      await walk(path.join(absolutePath, entry.name));
    }
  }

  await walk(absoluteRoot);
  return findings;
}

export async function auditBuildArtifacts(
  workspaceRoot: string,
): Promise<BuildAuditResult> {
  const absoluteWorkspace = path.resolve(workspaceRoot);
  const discovered = await discoverArtifacts(absoluteWorkspace);
  const artifactRoots: ArtifactRoot[] = [];
  const dangerousFindings: DangerousArtifactFinding[] = [];

  for (const [index, item] of discovered.entries()) {
    const relativePath = path
      .relative(absoluteWorkspace, item.path)
      .replaceAll("\\", "/");
    const artifactType = artifactTypeFor(relativePath, item.kind);
    const metrics =
      item.kind !== "directory"
        ? {
            fileCount: 1,
            totalBytes: (await fs.lstat(item.path)).size,
          }
        : await collectTreeMetrics(item.path);
    const stats = await fs.lstat(item.path);
    const buildId =
      item.kind === "directory"
        ? await readOptionalBuildId(item.path, artifactType)
        : null;
    const artifact: ArtifactRoot = {
      id: `ART-${String(index + 1).padStart(3, "0")}`,
      relativePath,
      artifactType,
      buildId,
      directoryMtime: stats.mtime.toISOString(),
      startupReachable: isStartupReachable(artifactType),
      fileCount: metrics.fileCount,
      totalBytes: metrics.totalBytes,
    };
    artifactRoots.push(artifact);
    dangerousFindings.push(
      ...(await scanArtifactTree({
        workspaceRoot: absoluteWorkspace,
        artifact,
      })),
    );
  }

  return {
    workspaceRoot: absoluteWorkspace,
    artifactRoots: artifactRoots.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath),
    ),
    dangerousFindings,
  };
}

export function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
