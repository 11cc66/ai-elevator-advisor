import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".mjs",
  ".ts",
  ".tsx",
]);

const FINAL_PATH_SEGMENTS = new Set([
  "removeStaging",
  "removeObject",
  "cleanupOrphanObjects",
  "cleanupTemp",
  "deleteObject",
]);

const FILESYSTEM_DELETE_METHODS = new Set([
  "rm",
  "rmSync",
  "rmdir",
  "rmdirSync",
  "unlink",
  "unlinkSync",
]);

const FILESYSTEM_RECEIVERS = new Set([
  "fs",
  "fsp",
  "fsPromises",
  "promises",
]);

const PACKAGE_SOURCE_ROOTS = new Map<string, string>([
  ["@elevator/file-storage", "packages/file-storage/src/index.ts"],
]);

const DEFAULT_SOURCE_ROOTS = [
  "apps/web/src",
  "apps/web/scripts",
  "apps/web/tests",
  "apps/worker/src",
  "apps/worker/scripts",
  "apps/worker/tests",
  "packages/file-storage/src",
  "packages/file-storage/tests",
  "packages/build-integrity/src",
];

const DEFAULT_ENTRY_POINTS = [
  "apps/web/src/instrumentation.ts",
  "apps/web/src/app",
  "apps/worker/src/index.ts",
];

export interface DeleteAllowlistEntry {
  relativePath: string;
  marker: DeleteMarker;
  classification: "BUILD_TEMP" | "TEST_ROOT" | "TEST_ONLY";
}

export const DEFAULT_DELETE_ALLOWLIST: readonly DeleteAllowlistEntry[] = [
  {
    relativePath: "apps/web/scripts/build-secure.ts",
    marker: "fs-rm",
    classification: "BUILD_TEMP",
  },
  {
    relativePath: "apps/web/scripts/test-db/cli.ts",
    marker: "fs-rm",
    classification: "TEST_ROOT",
  },
];

export type DeleteMarker =
  | "fs-rm"
  | "fs-unlink"
  | "fs-rmdir"
  | "remove-staging"
  | "remove-object"
  | "cleanup-orphan-objects"
  | "cleanup-temp"
  | "delete-object";

export interface StorageDeleteFinding {
  relativePath: string;
  line: number;
  column: number;
  marker: DeleteMarker;
  expression: string;
  classification:
    | "PRODUCTION_BLOCKED"
    | "BUILD_TEMP"
    | "TEST_ROOT"
    | "TEST_ONLY";
}

export interface UnresolvedDynamicImport {
  relativePath: string;
  line: number;
  column: number;
}

export interface StorageDeleteAuditResult {
  workspaceRoot: string;
  scannedFileCount: number;
  reachableFileCount: number;
  importGraph: Record<string, string[]>;
  findings: StorageDeleteFinding[];
  unresolvedDynamicImports: UnresolvedDynamicImport[];
  productionBlockingFindings: StorageDeleteFinding[];
}

interface SourceRecord {
  absolutePath: string;
  relativePath: string;
  sourceFile: ts.SourceFile;
  imports: string[];
  dynamicImports: Array<{
    specifier: string | null;
    line: number;
    column: number;
  }>;
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function scriptKind(filePath: string): ts.ScriptKind {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".ts" || extension === ".mts" || extension === ".cts") {
    return ts.ScriptKind.TS;
  }
  if (extension === ".tsx") {
    return ts.ScriptKind.TSX;
  }
  return ts.ScriptKind.JS;
}

async function collectSourceFiles(
  workspaceRoot: string,
  sourceRoots: readonly string[],
): Promise<string[]> {
  const files: string[] = [];

  async function walk(
    absolutePath: string,
    isConfiguredRoot = false,
  ): Promise<void> {
    let stats;
    try {
      stats = await fs.lstat(absolutePath);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        if (isConfiguredRoot) {
          throw new Error(
            `SOURCE_ROOT_MISSING:${normalizeRelativePath(
              path.relative(workspaceRoot, absolutePath),
            )}`,
          );
        }
        return;
      }
      throw error;
    }
    if (stats.isSymbolicLink()) {
      return;
    }
    if (stats.isFile()) {
      if (SOURCE_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) {
        files.push(absolutePath);
      }
      return;
    }
    if (!stats.isDirectory()) {
      return;
    }
    const entries = await fs.readdir(absolutePath, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (
        entry.name === ".next" ||
        entry.name === "dist" ||
        entry.name === "node_modules"
      ) {
        continue;
      }
      if (entry.isSymbolicLink()) {
        continue;
      }
      await walk(path.join(absolutePath, entry.name));
    }
  }

  for (const sourceRoot of sourceRoots) {
    await walk(path.resolve(workspaceRoot, sourceRoot), true);
  }
  return [...new Set(files)].sort();
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyChain(expression: ts.Expression): string[] {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) {
    return [current.text];
  }
  if (ts.isPropertyAccessExpression(current)) {
    return [...propertyChain(current.expression), current.name.text];
  }
  return [];
}

function resolveImport(
  workspaceRoot: string,
  fromRelativePath: string,
  specifier: string,
): string | null {
  if (specifier.startsWith("@elevator/")) {
    const packagePath = PACKAGE_SOURCE_ROOTS.get(specifier);
    return packagePath ? normalizeRelativePath(packagePath) : null;
  }
  if (specifier.startsWith("@/")) {
    const aliasTarget = normalizeRelativePath(
      path.posix.join("apps/web/src", specifier.slice(2)),
    );
    const candidates = [
      aliasTarget,
      `${aliasTarget}.ts`,
      `${aliasTarget}.tsx`,
      `${aliasTarget}/index.ts`,
      `${aliasTarget}/index.tsx`,
    ];
    return (
      candidates.find((candidate) =>
        fileSetHasPath(workspaceRoot, candidate),
      ) ?? null
    );
  }
  if (!specifier.startsWith(".")) {
    return null;
  }
  const fromDirectory = path.posix.dirname(fromRelativePath);
  let resolved = path.posix.normalize(
    path.posix.join(fromDirectory, specifier),
  );
  resolved = resolved.replace(/\.(?:c|m)?jsx?$/, "");
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.mts`,
    `${resolved}.cts`,
    `${resolved}.mjs`,
    `${resolved}.js`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
  ];
  return (
    candidates.find((candidate) =>
      fileSetHasPath(workspaceRoot, candidate),
    ) ?? null
  );
}

const resolvedPathCache = new Map<string, boolean>();

function fileSetHasPath(
  workspaceRoot: string,
  relativePath: string,
): boolean {
  const cacheKey = `${workspaceRoot}\0${relativePath}`;
  const cached = resolvedPathCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const exists = requireFileSync(
    path.resolve(workspaceRoot, relativePath),
  );
  resolvedPathCache.set(cacheKey, exists);
  return exists;
}

function requireFileSync(filePath: string): boolean {
  try {
    return ts.sys.fileExists(filePath);
  } catch {
    return false;
  }
}

function classifyFinding(
  relativePath: string,
  marker: DeleteMarker,
  allowlist: readonly DeleteAllowlistEntry[],
): StorageDeleteFinding["classification"] {
  const allowlisted = allowlist.find(
    (entry) =>
      entry.relativePath === relativePath && entry.marker === marker,
  );
  if (allowlisted) {
    return allowlisted.classification;
  }
  if (
    relativePath.includes("/tests/") ||
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".spec.ts")
  ) {
    return "TEST_ONLY";
  }
  return "PRODUCTION_BLOCKED";
}

function markerForCall(expression: ts.CallExpression): DeleteMarker | null {
  const chain = propertyChain(expression.expression);
  const finalSegment = chain.at(-1);
  if (!finalSegment) {
    return null;
  }
  if (finalSegment === "removeStaging") {
    return "remove-staging";
  }
  if (finalSegment === "removeObject") {
    return "remove-object";
  }
  if (finalSegment === "cleanupOrphanObjects") {
    return "cleanup-orphan-objects";
  }
  if (finalSegment === "cleanupTemp") {
    return "cleanup-temp";
  }
  if (finalSegment === "deleteObject") {
    return "delete-object";
  }
  if (!FILESYSTEM_DELETE_METHODS.has(finalSegment)) {
    return null;
  }
  if (
    !chain.some((segment) => FILESYSTEM_RECEIVERS.has(segment))
  ) {
    return null;
  }
  if (finalSegment === "unlink" || finalSegment === "unlinkSync") {
    return "fs-unlink";
  }
  if (finalSegment === "rmdir" || finalSegment === "rmdirSync") {
    return "fs-rmdir";
  }
  return "fs-rm";
}

function parseSource(
  workspaceRoot: string,
  absolutePath: string,
  content: string,
): SourceRecord {
  const relativePath = normalizeRelativePath(
    path.relative(workspaceRoot, absolutePath),
  );
  const sourceFile = ts.createSourceFile(
    absolutePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(absolutePath),
  );
  const imports: string[] = [];
  const dynamicImports: SourceRecord["dynamicImports"] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const position = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      dynamicImports.push({
        specifier:
          node.arguments.length === 1 &&
          ts.isStringLiteral(node.arguments[0]!)
            ? node.arguments[0]!.text
            : null,
        line: position.line + 1,
        column: position.character + 1,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {
    absolutePath,
    relativePath,
    sourceFile,
    imports,
    dynamicImports,
  };
}

export async function auditStorageDeletePaths(input: {
  workspaceRoot: string;
  sourceRoots?: readonly string[];
  entryPoints?: readonly string[];
  allowlist?: readonly DeleteAllowlistEntry[];
}): Promise<StorageDeleteAuditResult> {
  resolvedPathCache.clear();
  const workspaceRoot = path.resolve(input.workspaceRoot);
  const sourceRoots = input.sourceRoots ?? DEFAULT_SOURCE_ROOTS;
  const entryPoints = input.entryPoints ?? DEFAULT_ENTRY_POINTS;
  const allowlist = input.allowlist ?? DEFAULT_DELETE_ALLOWLIST;
  const absoluteFiles = await collectSourceFiles(
    workspaceRoot,
    sourceRoots,
  );
  const records = new Map<string, SourceRecord>();
  for (const absolutePath of absoluteFiles) {
    const content = await fs.readFile(absolutePath, "utf8");
    const record = parseSource(workspaceRoot, absolutePath, content);
    records.set(record.relativePath, record);
  }

  const importGraph: Record<string, string[]> = {};
  const unresolvedDynamicImports: UnresolvedDynamicImport[] = [];
  for (const record of records.values()) {
    const edges = new Set<string>();
    for (const specifier of record.imports) {
      const resolved = resolveImport(
        workspaceRoot,
        record.relativePath,
        specifier,
      );
      if (resolved && records.has(resolved)) {
        edges.add(resolved);
      }
    }
    for (const dynamicImport of record.dynamicImports) {
      const resolved = dynamicImport.specifier
        ? resolveImport(
            workspaceRoot,
            record.relativePath,
            dynamicImport.specifier,
          )
        : null;
      if (!dynamicImport.specifier || !resolved) {
        unresolvedDynamicImports.push({
          relativePath: record.relativePath,
          line: dynamicImport.line,
          column: dynamicImport.column,
        });
      } else if (records.has(resolved)) {
        edges.add(resolved);
      }
    }
    importGraph[record.relativePath] = [...edges].sort();
  }

  const reachable = new Set<string>();
  const queue: string[] = [];
  for (const entry of entryPoints) {
    const resolvedEntry = normalizeRelativePath(entry);
    if (records.has(resolvedEntry)) {
      queue.push(resolvedEntry);
    } else if (
      !ts.sys.directoryExists(
        path.resolve(workspaceRoot, resolvedEntry),
      ) &&
      !fileSetHasPath(workspaceRoot, resolvedEntry)
    ) {
      continue;
    } else {
      for (const record of records.values()) {
        if (record.relativePath.startsWith(`${resolvedEntry}/`)) {
          queue.push(record.relativePath);
        }
      }
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) {
      continue;
    }
    reachable.add(current);
    for (const dependency of importGraph[current] ?? []) {
      if (!reachable.has(dependency)) {
        queue.push(dependency);
      }
    }
  }

  const findings: StorageDeleteFinding[] = [];
  for (const record of records.values()) {
    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node)) {
        const marker = markerForCall(node);
        if (marker) {
          const position =
            record.sourceFile.getLineAndCharacterOfPosition(
              node.getStart(record.sourceFile),
            );
          findings.push({
            relativePath: record.relativePath,
            line: position.line + 1,
            column: position.character + 1,
            marker,
            expression: node.expression.getText(record.sourceFile),
            classification: classifyFinding(
              record.relativePath,
              marker,
              allowlist,
            ),
          });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(record.sourceFile);
  }

  const sortedFindings = findings.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath) ||
    left.line - right.line ||
    left.column - right.column,
  );
  return {
    workspaceRoot,
    scannedFileCount: records.size,
    reachableFileCount: reachable.size,
    importGraph,
    findings: sortedFindings,
    unresolvedDynamicImports,
    productionBlockingFindings: sortedFindings.filter(
      (finding) => finding.classification === "PRODUCTION_BLOCKED",
    ),
  };
}
