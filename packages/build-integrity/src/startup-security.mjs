import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import {
  isRelevantExecutableScript,
  scanAuxiliaryScript,
  validateScriptSyntax,
} from "./script-security.mjs";

const REQUIRED_FILES = [
  "package.json",
  "apps/web/package.json",
  "apps/worker/package.json",
  "apps/web/next.config.ts",
  "apps/web/scripts/build-secure.ts",
  "apps/web/scripts/start-secure.mjs",
  "apps/web/src/instrumentation.ts",
  "apps/worker/scripts/build-secure.ts",
  "apps/worker/scripts/start-secure.mjs",
  "apps/worker/src/bootstrap.ts",
  "apps/worker/src/index.ts",
];

const FORBIDDEN_RUNTIME_IMPORT =
  /^import\s+[^;]*from\s+["'](?:@prisma\/client|pg-boss|@elevator\/file-storage|\.\/worker-entry\.js)["'];?/m;
const FORBIDDEN_SIDE_EFFECT_IMPORT =
  /^import\s+["'](?:@prisma\/client|pg-boss|@elevator\/file-storage|\.\/worker-entry\.js)["'];?/m;
const DIRECT_NEXT_START = /\bnext\s+start\b/i;
const DIRECT_WORKER_DIST =
  /\bnode(?:\.exe)?\s+[^;&\r\n]*\bdist[\\/]index\.js\b/i;
const EXCLUDED_WALK_SEGMENTS = new Set([
  ".git",
  ".next",
  ".p13-build",
  ".p13-releases",
  "build",
  "coverage",
  "dist",
  "docs",
  "node_modules",
  "out",
  "tests",
]);

function addFinding(findings, code, file, message) {
  findings.push({ code, file, message });
}

function packageJson(content, file, findings) {
  if (content === null) {
    addFinding(
      findings,
      "REQUIRED_FILE_MISSING",
      file,
      "Required source file is missing.",
    );
    return null;
  }
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("not an object");
    }
    return parsed;
  } catch {
    addFinding(
      findings,
      "PACKAGE_JSON_INVALID",
      file,
      "Package JSON is invalid.",
    );
    return null;
  }
}

function requireExactScript(
  scripts,
  name,
  expected,
  file,
  findings,
) {
  if (scripts[name] !== expected) {
    addFinding(
      findings,
      "PRODUCTION_SCRIPT_UNSAFE",
      file,
      `Production script ${name} must be: ${expected}`,
    );
  }
}

function auditPackages(contents, findings) {
  const rootPackage = packageJson(
    contents.get("package.json") ?? null,
    "package.json",
    findings,
  );
  const webPackage = packageJson(
    contents.get("apps/web/package.json") ?? null,
    "apps/web/package.json",
    findings,
  );
  const workerPackage = packageJson(
    contents.get("apps/worker/package.json") ?? null,
    "apps/worker/package.json",
    findings,
  );

  const webScripts =
    webPackage && typeof webPackage.scripts === "object"
      ? webPackage.scripts
      : {};
  const workerScripts =
    workerPackage && typeof workerPackage.scripts === "object"
      ? workerPackage.scripts
      : {};

  requireExactScript(
    webScripts,
    "build",
    "tsx scripts/build-secure.ts",
    "apps/web/package.json",
    findings,
  );
  requireExactScript(
    webScripts,
    "start",
    "node scripts/start-secure.mjs",
    "apps/web/package.json",
    findings,
  );
  requireExactScript(
    workerScripts,
    "build",
    "tsx scripts/build-secure.ts",
    "apps/worker/package.json",
    findings,
  );
  requireExactScript(
    workerScripts,
    "start",
    "node scripts/start-secure.mjs",
    "apps/worker/package.json",
    findings,
  );

  for (const [file, parsed] of [
    ["package.json", rootPackage],
    ["apps/web/package.json", webPackage],
    ["apps/worker/package.json", workerPackage],
  ]) {
    if (!parsed || typeof parsed.scripts !== "object") {
      continue;
    }
    for (const [name, command] of Object.entries(parsed.scripts)) {
      if (typeof command !== "string") {
        continue;
      }
      if (DIRECT_NEXT_START.test(command)) {
        addFinding(
          findings,
          "DIRECT_NEXT_START_FORBIDDEN",
          `${file}#scripts.${name}`,
          "Package script directly invokes next start.",
        );
      }
      if (DIRECT_WORKER_DIST.test(command)) {
        addFinding(
          findings,
          "DIRECT_WORKER_DIST_FORBIDDEN",
          `${file}#scripts.${name}`,
          "Package script directly invokes dist/index.js.",
        );
      }
      if (command.includes("test-worker-entry")) {
        addFinding(
          findings,
          "TEST_ENTRY_IN_PACKAGE_SCRIPT",
          `${file}#scripts.${name}`,
          "Test Worker entry must not be referenced by package scripts.",
        );
      }
    }
  }
}

function requireText(
  contents,
  file,
  required,
  code,
  findings,
) {
  const content = contents.get(file);
  if (content === null || content === undefined) {
    addFinding(
      findings,
      "REQUIRED_FILE_MISSING",
      file,
      "Required source file is missing.",
    );
    return null;
  }
  for (const value of required) {
    if (!content.includes(value)) {
      addFinding(
        findings,
        code,
        file,
        `Required security marker is missing: ${value}`,
      );
    }
  }
  return content;
}

function auditSources(contents, findings) {
  const nextConfig = requireText(
    contents,
    "apps/web/next.config.ts",
    [
      "PHASE_PRODUCTION_BUILD",
      "PHASE_PRODUCTION_SERVER",
      "P13_NEXT_DIST_DIR is required",
    ],
    "WEB_PRODUCTION_DIST_GUARD_MISSING",
    findings,
  );
  void nextConfig;

  const webBuild = requireText(
    contents,
    "apps/web/scripts/build-secure.ts",
    [
      ".p13-releases/${releaseId}",
      "P13_WEB_RELEASE_ROOT_MISMATCH",
      "generateSignedReleaseManifest",
      "runBuildSecurityPreflight",
    ],
    "WEB_BUILD_ISOLATION_MISSING",
    findings,
  );
  const webPreflightCall = webBuild?.match(
    /runPreflight:\s*\(\)\s*=>[\s\S]{0,240}?runBuildSecurityPreflight/,
  );
  const webBuildCall = webBuild?.match(
    /build:\s*async\s*\(\)\s*=>/,
  );
  if (
    webBuild &&
    (!webPreflightCall ||
      !webBuildCall ||
      webPreflightCall.index === undefined ||
      webBuildCall.index === undefined ||
      webPreflightCall.index > webBuildCall.index)
  ) {
    addFinding(
      findings,
      "WEB_BUILD_PREFLIGHT_ORDER_INVALID",
      "apps/web/scripts/build-secure.ts",
      "Web build security preflight must run before Next build.",
    );
  }

  const webStart = requireText(
    contents,
    "apps/web/scripts/start-secure.mjs",
    [
      "verifyStartupRelease",
      "spawn(process.execPath",
      "P13_TRUSTED_PUBLIC_KEYS_PATH",
    ],
    "WEB_SECURE_START_MISSING",
    findings,
  );
  if (webStart) {
    if (
      webStart.indexOf("await verifyStartupRelease") < 0 ||
      webStart.indexOf("await verifyStartupRelease") >
        webStart.indexOf("const child = spawn")
    ) {
      addFinding(
        findings,
        "WEB_GATE_ORDER_INVALID",
        "apps/web/scripts/start-secure.mjs",
        "Web startup Gate must run before spawning Next.",
      );
    }
    if (/@prisma\/client|pg-boss|@elevator\/file-storage/.test(webStart)) {
      addFinding(
        findings,
        "WEB_BUSINESS_IMPORT_BEFORE_GATE",
        "apps/web/scripts/start-secure.mjs",
        "Web launcher imports business/runtime dependencies.",
      );
    }
  }

  const instrumentation = requireText(
    contents,
    "apps/web/src/instrumentation.ts",
    [
      'await import(\n    "@/server/security/startup-gate"',
      'process.env.NEXT_RUNTIME !== "nodejs"',
    ],
    "WEB_INSTRUMENTATION_GATE_MISSING",
    findings,
  );
  if (
    instrumentation &&
    /@prisma\/client|pg-boss|@elevator\/file-storage/.test(
      instrumentation,
    )
  ) {
    addFinding(
      findings,
      "WEB_BUSINESS_IMPORT_BEFORE_GATE",
      "apps/web/src/instrumentation.ts",
      "Web instrumentation imports business/runtime dependencies.",
    );
  }

  const workerBuild = requireText(
    contents,
    "apps/worker/scripts/build-secure.ts",
    [
      "P13_WORKER_RELEASE_ROOT_ALREADY_EXISTS",
      '"--outDir"',
      "generateSignedReleaseManifest",
      "runBuildSecurityPreflight",
    ],
    "WORKER_BUILD_ISOLATION_MISSING",
    findings,
  );
  const workerPreflightCall = workerBuild?.match(
    /runPreflight:\s*\(\)\s*=>[\s\S]{0,240}?runBuildSecurityPreflight/,
  );
  const workerBuildCall = workerBuild?.match(
    /build:\s*async\s*\(\)\s*=>/,
  );
  if (
    workerBuild &&
    (!workerPreflightCall ||
      !workerBuildCall ||
      workerPreflightCall.index === undefined ||
      workerBuildCall.index === undefined ||
      workerPreflightCall.index > workerBuildCall.index)
  ) {
    addFinding(
      findings,
      "WORKER_BUILD_PREFLIGHT_ORDER_INVALID",
      "apps/worker/scripts/build-secure.ts",
      "Worker build security preflight must run before TypeScript build.",
    );
  }

  const workerStart = requireText(
    contents,
    "apps/worker/scripts/start-secure.mjs",
    [
      "verifyStartupRelease",
      "spawn(process.execPath",
      'NODE_ENV: "production"',
    ],
    "WORKER_SECURE_START_MISSING",
    findings,
  );
  if (workerStart) {
    if (
      workerStart.indexOf("await verifyStartupRelease") < 0 ||
      workerStart.indexOf("await verifyStartupRelease") >
        workerStart.indexOf("const child = spawn")
    ) {
      addFinding(
        findings,
        "WORKER_GATE_ORDER_INVALID",
        "apps/worker/scripts/start-secure.mjs",
        "Worker startup Gate must run before spawning the release.",
      );
    }
    if (/@prisma\/client|pg-boss|@elevator\/file-storage/.test(workerStart)) {
      addFinding(
        findings,
        "WORKER_BUSINESS_IMPORT_BEFORE_GATE",
        "apps/worker/scripts/start-secure.mjs",
        "Worker launcher imports business/runtime dependencies.",
      );
    }
  }

  const workerIndex = requireText(
    contents,
    "apps/worker/src/index.ts",
    ["runWorkerBootstrap()"],
    "WORKER_GATE_FIRST_BOOTSTRAP_MISSING",
    findings,
  );
  if (
    workerIndex &&
    (FORBIDDEN_RUNTIME_IMPORT.test(workerIndex) ||
      FORBIDDEN_SIDE_EFFECT_IMPORT.test(workerIndex))
  ) {
    addFinding(
      findings,
      "WORKER_BUSINESS_IMPORT_BEFORE_GATE",
      "apps/worker/src/index.ts",
      "Worker index statically imports business/runtime modules.",
    );
  }

  const bootstrap = requireText(
    contents,
    "apps/worker/src/bootstrap.ts",
    [
      "await runStartupGate()",
      "await loadBusinessEntry()",
      'import("./worker-entry.js")',
    ],
    "WORKER_GATE_FIRST_BOOTSTRAP_MISSING",
    findings,
  );
  if (bootstrap) {
    if (
      bootstrap.indexOf("await runStartupGate()") >
      bootstrap.indexOf("await loadBusinessEntry()")
    ) {
      addFinding(
        findings,
        "WORKER_GATE_ORDER_INVALID",
        "apps/worker/src/bootstrap.ts",
        "Worker business entry loading must occur after Gate.",
      );
    }
    if (
      FORBIDDEN_RUNTIME_IMPORT.test(bootstrap) ||
      FORBIDDEN_SIDE_EFFECT_IMPORT.test(bootstrap)
    ) {
      addFinding(
        findings,
        "WORKER_BUSINESS_IMPORT_BEFORE_GATE",
        "apps/worker/src/bootstrap.ts",
        "Worker Bootstrap statically imports business/runtime modules.",
      );
    }
  }
}

function auditPackageScriptTargets(contents, scriptInventory) {
  const findings = [];
  const inventory = new Set(scriptInventory);
  for (const [file, baseDirectory] of [
    ["package.json", ""],
    ["apps/web/package.json", "apps/web"],
    ["apps/worker/package.json", "apps/worker"],
  ]) {
    const content = contents.get(file);
    if (!content) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed.scripts !== "object") {
      continue;
    }
    for (const [name, command] of Object.entries(parsed.scripts)) {
      if (typeof command !== "string") {
        continue;
      }
      const localTargets = command.matchAll(
        /\b(?:node|tsx|bash|sh|powershell|pwsh|cmd)(?:\.exe)?\s+(?:(?:-|--)[^\s"';&|]+\s+)*([^\s"';&|]+\.(?:bat|cjs|cmd|js|mjs|ps1|sh|ts))/gi,
      );
      for (const match of localTargets) {
        const target = match[1].replaceAll("\\", "/");
        const relativePath = path.posix
          .normalize(
            target.startsWith("/")
              ? target.slice(1)
              : path.posix.join(baseDirectory, target),
          )
          .replaceAll("\\", "/");
        if (/(?:^|\/)dist\/index\.js$/i.test(relativePath)) {
          continue;
        }
        if (!inventory.has(relativePath)) {
          addScriptFinding(findings, {
            code: "PACKAGE_SCRIPT_TARGET_UNSCANNED",
            file: `${file}#scripts.${name}`,
            message: `Package script invokes a local wrapper outside the scanned script inventory: ${target}`,
            classification: "UNKNOWN",
            scriptType: "unknown",
          });
        }
      }
    }
  }
  return findings;
}

async function defaultHeadReader(workspaceRoot, relativePath) {
  const result = spawnSync(
    "git",
    [
      "-C",
      workspaceRoot,
      "-c",
      `safe.directory=${workspaceRoot}`,
      "show",
      `HEAD:${relativePath}`,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
    },
  );
  return result.status === 0 ? result.stdout : null;
}

async function readWorktreeRequiredFiles(workspaceRoot) {
  const contents = new Map();
  for (const file of REQUIRED_FILES) {
    try {
      contents.set(
        file,
        await fs.readFile(path.join(workspaceRoot, file), "utf8"),
      );
    } catch {
      contents.set(file, null);
    }
  }
  return contents;
}

async function readHeadRequiredFiles(readRevision, allHeadPaths) {
  const contents = new Map();
  const findings = [];
  const pathSet = new Set(allHeadPaths);
  for (const file of REQUIRED_FILES) {
    if (!pathSet.has(file)) {
      contents.set(file, null);
      addScriptFinding(findings, {
        code: "HEAD_REQUIRED_FILE_MISSING",
        file,
        message:
          "Required HEAD file is absent from the complete HEAD inventory.",
        classification: "ERROR",
        scriptType: "unknown",
      });
      continue;
    }
    try {
      const content = await readRevision(file);
      if (content === null || content === undefined) {
        throw new Error("HEAD content reader returned null.");
      }
      contents.set(file, content);
    } catch {
      contents.set(file, null);
      addScriptFinding(findings, {
        code: "HEAD_REQUIRED_FILE_READ_FAILED",
        file,
        message: "Required HEAD file could not be read completely.",
        classification: "ERROR",
        scriptType: "unknown",
      });
    }
  }
  return {
    contents,
    findings,
    complete: findings.length === 0,
  };
}

function auditVersion(contents) {
  const findings = [];
  auditPackages(contents, findings);
  auditSources(contents, findings);
  return {
    status: findings.length === 0 ? "PASS" : "FAIL",
    findings,
  };
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32"
    ? resolved.toLowerCase()
    : resolved;
}

function sameOrInside(parent, candidate) {
  const normalizedParent = normalizedPath(parent);
  const normalizedCandidate = normalizedPath(candidate);
  return (
    normalizedCandidate === normalizedParent ||
    normalizedCandidate.startsWith(
      `${normalizedParent}${path.sep}`,
    )
  );
}

async function pathExists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return false;
    }
    throw error;
  }
}

function addScriptFinding(findings, value) {
  findings.push(value);
}

async function defaultHeadPathEnumerator(workspaceRoot) {
  const result = spawnSync(
    "git",
    [
      "-C",
      workspaceRoot,
      "-c",
      `safe.directory=${workspaceRoot}`,
      "ls-tree",
      "-r",
      "-z",
      "HEAD",
    ],
    {
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `HEAD script enumeration failed with status ${result.status ?? "UNKNOWN"}.`,
    );
  }
  const paths = [];
  for (const record of result.stdout.toString("utf8").split("\0")) {
    if (!record) {
      continue;
    }
    const tab = record.indexOf("\t");
    if (tab < 0) {
      throw new Error("HEAD script enumeration returned invalid data.");
    }
    const metadata = record.slice(0, tab).split(" ");
    const relativePath = record.slice(tab + 1).replaceAll("\\", "/");
    const [mode, type] = metadata;
    const segments = relativePath.split("/");
    const inScriptRoot =
      (relativePath.startsWith("apps/") ||
        relativePath.startsWith("scripts/")) &&
      !segments.some((segment) =>
        EXCLUDED_WALK_SEGMENTS.has(segment),
      );
    if (mode === "120000" && inScriptRoot) {
      throw new Error(
        `HEAD script roots contain a symlink or junction: ${relativePath}.`,
      );
    }
    if (isRelevantExecutableScript(relativePath)) {
      if (mode !== "100644" && mode !== "100755") {
        throw new Error(
          `HEAD executable script has unsupported mode: ${relativePath}.`,
        );
      }
      if (type !== "blob") {
        throw new Error(
          `HEAD executable script is not a regular blob: ${relativePath}.`,
        );
      }
    }
    paths.push(relativePath);
  }
  return paths.sort();
}

async function enumerateWorktreeScripts(workspaceRoot) {
  const paths = [];
  const findings = [];

  async function walk(absolutePath) {
    const name = path.basename(absolutePath);
    if (EXCLUDED_WALK_SEGMENTS.has(name)) {
      return;
    }
    const stats = await fs.lstat(absolutePath);
    const relativePath = path
      .relative(workspaceRoot, absolutePath)
      .replaceAll("\\", "/");
    if (stats.isSymbolicLink()) {
      addScriptFinding(findings, {
        code: "WORKTREE_SCRIPT_SYMLINK_FORBIDDEN",
        file: relativePath,
        message:
          "Script roots must not contain symlinks, junctions, or reparse points.",
        classification: "DANGEROUS",
        scriptType: "unknown",
      });
      return;
    }
    if (stats.isFile()) {
      if (isRelevantExecutableScript(relativePath)) {
        paths.push(relativePath);
      }
      return;
    }
    if (!stats.isDirectory()) {
      return;
    }
    for (const entry of await fs.readdir(absolutePath)) {
      await walk(path.join(absolutePath, entry));
    }
  }

  for (const relativeRoot of ["apps", "scripts"]) {
    const absoluteRoot = path.join(workspaceRoot, relativeRoot);
    if (await pathExists(absoluteRoot)) {
      await walk(absoluteRoot);
    }
  }
  return {
    paths: paths.sort(),
    findings,
    complete: findings.length === 0,
  };
}

async function scanScriptSet(input) {
  const findings = [];
  const contents = new Map();
  let complete = input.complete;
  for (const relativePath of input.paths) {
    if (REQUIRED_FILES.includes(relativePath)) {
      continue;
    }
    let content;
    try {
      content = await input.readFile(relativePath);
    } catch {
      content = null;
    }
    if (content === null || content === undefined) {
      complete = false;
      addScriptFinding(findings, {
        code: input.readFailureCode,
        file: relativePath,
        message: `${input.revision} script content could not be read.`,
        classification: "ERROR",
        scriptType: "unknown",
      });
      continue;
    }
    contents.set(relativePath, content);
    for (const scriptFinding of scanAuxiliaryScript(
      relativePath,
      content,
    )) {
      addScriptFinding(findings, scriptFinding);
    }
  }
  return {
    findings,
    contents,
    complete,
    scanned: contents.size,
  };
}

async function assertSafeBuildWritePath(candidate) {
  const absolutePath = path.resolve(candidate);
  const parsed = path.parse(absolutePath);
  const relative = path.relative(parsed.root, absolutePath);
  let current = parsed.root;
  for (const segment of relative.split(path.sep)) {
    if (!segment) {
      continue;
    }
    current = path.join(current, segment);
    let stats;
    try {
      stats = await fs.lstat(current);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "ENOTDIR")
      ) {
        return;
      }
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new ReleaseSecurityError(
        "BUILD_WRITE_PATH_REPARSE_FORBIDDEN",
        `Build write path contains a symlink, junction, or reparse point: ${current}.`,
      );
    }
    if (current !== absolutePath && !stats.isDirectory()) {
      throw new ReleaseSecurityError(
        "BUILD_WRITE_PATH_ANCESTOR_INVALID",
        `Build write path has a non-directory ancestor: ${current}.`,
      );
    }
  }
}

export class ReleaseSecurityError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReleaseSecurityError";
    this.code = code;
    this.details = details;
  }
}

export async function inspectStartupEntrySecurity(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const readRevision =
    input.readRevision ??
    ((relativePath) =>
      defaultHeadReader(workspaceRoot, relativePath));
  const listHeadPaths =
    input.listHeadPaths ??
    (() => defaultHeadPathEnumerator(workspaceRoot));
  const worktreeContents =
    await readWorktreeRequiredFiles(workspaceRoot);
  const worktree = auditVersion(worktreeContents);
  let allHeadPaths = [];
  let headPathsComplete = true;
  const headPathFindings = [];
  try {
    const listedPaths = await listHeadPaths();
    if (!Array.isArray(listedPaths)) {
      throw new Error(
        "HEAD path enumerator must return an array of paths.",
      );
    }
    const invalidPath = listedPaths.find(
      (value) =>
        typeof value !== "string" ||
        value.length === 0 ||
        value.startsWith("/") ||
        value.split("/").includes(".."),
    );
    if (invalidPath !== undefined) {
      throw new Error(
        `HEAD path enumerator returned an invalid path: ${invalidPath}.`,
      );
    }
    allHeadPaths = [
      ...new Set(
        listedPaths.map((value) => value.replaceAll("\\", "/")),
      ),
    ].sort();
  } catch (error) {
    headPathsComplete = false;
    headPathFindings.push({
      code: "HEAD_PATH_ENUMERATION_FAILED",
      file: ".",
      message:
        error instanceof Error
          ? error.message
          : "HEAD path enumeration failed.",
      classification: "ERROR",
      scriptType: "unknown",
    });
  }
  const headRequired = headPathsComplete
    ? await readHeadRequiredFiles(readRevision, allHeadPaths)
    : {
        contents: new Map(
          REQUIRED_FILES.map((file) => [file, null]),
        ),
        findings: [],
        complete: false,
      };
  const headContents = headRequired.contents;
  const head = auditVersion(headContents);
  head.findings.push(...headRequired.findings);

  let worktreeInventory;
  try {
    worktreeInventory = await enumerateWorktreeScripts(
      workspaceRoot,
    );
  } catch (error) {
    worktreeInventory = {
      paths: [],
      complete: false,
      findings: [
        {
          code: "WORKTREE_SCRIPT_ENUMERATION_FAILED",
          file: ".",
          message:
            error instanceof Error
              ? error.message
              : "Worktree script enumeration failed.",
          classification: "ERROR",
          scriptType: "unknown",
        },
      ],
    };
  }
  const worktreeScripts = await scanScriptSet({
    revision: "Worktree",
    paths: worktreeInventory.paths,
    complete: worktreeInventory.complete,
    readFile: (relativePath) =>
      fs.readFile(path.join(workspaceRoot, relativePath), "utf8"),
    readFailureCode: "WORKTREE_SCRIPT_READ_FAILED",
  });
  worktree.findings.push(
    ...worktreeInventory.findings,
    ...worktreeScripts.findings,
    ...auditPackageScriptTargets(
      worktreeContents,
      worktreeInventory.paths,
    ),
  );
  worktree.status =
    worktree.findings.length === 0 ? "PASS" : "FAIL";
  worktree.complete = worktreeScripts.complete;
  worktree.scriptsScanned = worktreeScripts.scanned;

  let headInventory;
  if (headPathsComplete) {
    headInventory = {
      paths: allHeadPaths
        .filter(isRelevantExecutableScript)
        .sort(),
      complete: true,
      findings: [],
    };
  } else {
    headInventory = {
      paths: [],
      complete: false,
      findings: headPathFindings,
    };
  }
  const headScripts = await scanScriptSet({
    revision: "HEAD",
    paths: headInventory.paths,
    complete: headInventory.complete,
    readFile: readRevision,
    readFailureCode: "HEAD_SCRIPT_READ_FAILED",
  });
  head.findings.push(
    ...headInventory.findings,
    ...headScripts.findings,
    ...auditPackageScriptTargets(
      headContents,
      headInventory.paths,
    ),
  );
  head.status = head.findings.length === 0 ? "PASS" : "FAIL";
  let headComplete =
    headRequired.complete && headScripts.complete;
  if (
    head.findings.some(
      (finding) =>
        finding.code === "PACKAGE_JSON_INVALID" ||
        finding.code === "SCRIPT_PARSE_ERROR",
    )
  ) {
    headComplete = false;
    head.findings.push({
      code: "HEAD_REQUIRED_FILE_PARSE_FAILED",
      file: ".",
      message:
        "A required HEAD file could not be parsed completely.",
      classification: "ERROR",
      scriptType: "unknown",
    });
  }
  for (const file of REQUIRED_FILES) {
    const content = headContents.get(file);
    if (typeof content !== "string") {
      continue;
    }
    const syntaxFindings = validateScriptSyntax(file, content);
    if (syntaxFindings.length > 0) {
      headComplete = false;
      head.findings.push(...syntaxFindings, {
        code: "HEAD_REQUIRED_FILE_PARSE_FAILED",
        file,
        message:
          "A required HEAD file could not be parsed completely.",
        classification: "ERROR",
        scriptType: "javascript",
      });
    }
  }
  head.status = head.findings.length === 0 ? "PASS" : "FAIL";
  head.complete = headComplete;
  head.scriptsScanned = headScripts.scanned;

  const requiredDifferences = REQUIRED_FILES.filter(
    (file) =>
      worktreeContents.get(file) !== headContents.get(file),
  );
  const worktreeScriptSet = new Set(worktreeInventory.paths);
  const headScriptSet = new Set(headInventory.paths);
  const addedScripts = worktreeInventory.paths.filter(
    (file) => !headScriptSet.has(file),
  );
  const removedScripts = headInventory.paths.filter(
    (file) => !worktreeScriptSet.has(file),
  );
  const changedScripts = worktreeInventory.paths.filter(
    (file) =>
      headScriptSet.has(file) &&
      worktreeScripts.contents.get(file) !==
        headScripts.contents.get(file),
  );
  const differences = [
    ...new Set([
      ...requiredDifferences,
      ...addedScripts,
      ...removedScripts,
      ...changedScripts,
    ]),
  ].sort();
  const unknowns = [
    ...worktree.findings.map((value) => ({
      revision: "WORKTREE",
      ...value,
    })),
    ...head.findings.map((value) => ({
      revision: "HEAD",
      ...value,
    })),
  ].filter((value) => value.classification === "UNKNOWN");
  const legacyArtifacts = [];
  for (const relativePath of [
    "apps/web/.next",
    "apps/worker/dist",
  ]) {
    legacyArtifacts.push({
      relativePath,
      present: await pathExists(
        path.join(workspaceRoot, relativePath),
      ),
    });
  }
  return {
    workspaceRoot,
    worktree,
    head,
    differences,
    headVsWorktree:
      differences.length === 0 ? "IDENTICAL" : "DIFFERENT",
    scriptInventory: {
      worktree: worktreeInventory.paths,
      head: headInventory.paths,
      added: addedScripts,
      removed: removedScripts,
      changed: changedScripts,
    },
    unknowns,
    additionalWorktreeScriptsScanned:
      worktreeScripts.scanned,
    additionalHeadScriptsScanned: headScripts.scanned,
    worktreeScriptsEnumerated: worktreeInventory.paths.length,
    headScriptsEnumerated: headInventory.paths.length,
    legacyArtifacts,
  };
}

export async function runBuildSecurityPreflight(input) {
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const appDirectory = path.resolve(input.appDirectory);
  const targetRoot = path.resolve(input.targetRoot);
  const report = await inspectStartupEntrySecurity({
    workspaceRoot,
    readRevision: input.readRevision,
    listHeadPaths: input.listHeadPaths,
  });
  if (!report.head.complete) {
    throw new ReleaseSecurityError(
      "BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE",
      "HEAD startup security audit could not be completed.",
      { findings: report.head.findings },
    );
  }
  if (report.worktree.status !== "PASS") {
    throw new ReleaseSecurityError(
      "BUILD_SOURCE_SECURITY_FAILED",
      "Build source startup security checks failed.",
      { findings: report.worktree.findings },
    );
  }

  const writePaths = [
    targetRoot,
    ...(input.newWritePaths ?? []).map((value) =>
      path.resolve(value),
    ),
  ].filter(
    (value, index, values) =>
      values.findIndex(
        (candidate) =>
          normalizedPath(candidate) === normalizedPath(value),
      ) === index,
  );
  for (const writePath of writePaths) {
    await assertSafeBuildWritePath(writePath);
  }

  const webNext = path.join(workspaceRoot, "apps", "web", ".next");
  const workerDist = path.join(
    workspaceRoot,
    "apps",
    "worker",
    "dist",
  );
  for (const legacyRoot of [webNext, workerDist]) {
    if (sameOrInside(legacyRoot, targetRoot)) {
      throw new ReleaseSecurityError(
        "BUILD_TARGET_IS_LEGACY_ARTIFACT",
        "Build target overlaps a historical artifact directory.",
      );
    }
  }
  if (input.application === "web") {
    const relativeTarget = path
      .relative(appDirectory, targetRoot)
      .replaceAll("\\", "/");
    if (!/^\.p13-releases\/[A-Za-z0-9._-]+$/.test(relativeTarget)) {
      throw new ReleaseSecurityError(
        "WEB_BUILD_TARGET_NOT_ISOLATED",
        "Web build target must be an isolated P13 release root.",
      );
    }
  } else if (input.application === "worker") {
    if (sameOrInside(workerDist, targetRoot)) {
      throw new ReleaseSecurityError(
        "WORKER_BUILD_TARGET_IS_LEGACY_DIST",
        "Worker build target must not be apps/worker/dist.",
      );
    }
  } else {
    throw new ReleaseSecurityError(
      "BUILD_APPLICATION_INVALID",
      "Build application must be web or worker.",
    );
  }
  if (await pathExists(targetRoot)) {
    throw new ReleaseSecurityError(
      "BUILD_TARGET_ALREADY_EXISTS",
      "Build target already exists; refusing to reuse or overwrite it.",
    );
  }
  for (const writePath of writePaths) {
    if (
      normalizedPath(writePath) !== normalizedPath(targetRoot) &&
      (await pathExists(writePath))
    ) {
      throw new ReleaseSecurityError(
        "BUILD_AUXILIARY_TARGET_ALREADY_EXISTS",
        `Build write target already exists: ${writePath}`,
      );
    }
  }
  return report;
}

export async function executeGuardedBuild(input) {
  const preflight = await input.runPreflight();
  if (input.verifyBuildIdentity) {
    await input.verifyBuildIdentity(preflight);
  }
  const result = await input.build(preflight);
  if (input.afterSuccessfulBuild) {
    await input.afterSuccessfulBuild(result, preflight);
  }
  return result;
}
