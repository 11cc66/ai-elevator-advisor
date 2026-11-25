import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  executeGuardedBuild,
  runBuildSecurityPreflight,
} from "@elevator/build-integrity";
// @ts-expect-error The package public surface intentionally does not expose
// this test-only semantic inspection helper.
import { inspectPowerShellSemantics } from "../../../packages/build-integrity/src/script-security.mjs";
import { describe, expect, it } from "vitest";

type SemanticEvaluation = {
  abstractValueKind: string;
  securityState: "SAFE" | "DANGEROUS" | "UNKNOWN" | "ERROR";
  invocationTarget: string;
  line: number;
};

type SemanticResult = {
  complete: boolean;
  analysisState: "SAFE" | "DANGEROUS" | "UNKNOWN" | "ERROR";
  evaluations: SemanticEvaluation[];
  findings: Array<{
    classification: "SAFE" | "DANGEROUS" | "UNKNOWN" | "ERROR";
    code: string;
  }>;
};

type MatrixCase = {
  id: string;
  content: string;
  state: "SAFE" | "DANGEROUS" | "UNKNOWN" | "ERROR";
  kind: string;
};

function secureFiles(): Record<string, string> {
  return {
    "package.json": JSON.stringify({
      scripts: { build: "pnpm -r build" },
    }),
    "apps/web/package.json": JSON.stringify({
      scripts: {
        build: "tsx scripts/build-secure.ts",
        start: "node scripts/start-secure.mjs",
      },
    }),
    "apps/worker/package.json": JSON.stringify({
      scripts: {
        build: "tsx scripts/build-secure.ts",
        start: "node scripts/start-secure.mjs",
      },
    }),
    "apps/web/next.config.ts": [
      'import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";',
      "if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {",
      '  throw new Error("P13_NEXT_DIST_DIR is required");',
      "}",
    ].join("\n"),
    "apps/web/scripts/build-secure.ts": [
      "const relativeDistDir = `.p13-releases/${releaseId}`;",
      '"P13_WEB_RELEASE_ROOT_MISMATCH"',
      "await executeGuardedBuild({",
      "  runPreflight: () => runBuildSecurityPreflight(),",
      "  build: async () => spawnSync(process.execPath, [nextCli, 'build']),",
      "});",
      "await generateSignedReleaseManifest();",
    ].join("\n"),
    "apps/web/scripts/start-secure.mjs": [
      "await verifyStartupRelease({",
      '  trustedPublicKeysPath: required("P13_TRUSTED_PUBLIC_KEYS_PATH"),',
      "});",
      "const child = spawn(process.execPath, [nextCli, 'start']);",
    ].join("\n"),
    "apps/web/src/instrumentation.ts": [
      "export async function register() {",
      "  const { runWebStartupGate } = await import(",
      '    "@/server/security/startup-gate"',
      "  );",
      '  if (process.env.NEXT_RUNTIME !== "nodejs") return;',
      "  await runWebStartupGate();",
      "}",
    ].join("\n"),
    "apps/worker/scripts/build-secure.ts": [
      '"P13_WORKER_RELEASE_ROOT_ALREADY_EXISTS"',
      "await executeGuardedBuild({",
      "  runPreflight: () => runBuildSecurityPreflight(),",
      '  build: async () => spawnSync(process.execPath, [tscCli, "--outDir", releaseRoot]),',
      "});",
      "await generateSignedReleaseManifest();",
    ].join("\n"),
    "apps/worker/scripts/start-secure.mjs": [
      "await verifyStartupRelease({",
      '  trustedPublicKeysPath: required("P13_TRUSTED_PUBLIC_KEYS_PATH"),',
      "});",
      "const child = spawn(process.execPath, [entryPath], {",
      '  env: { ...process.env, NODE_ENV: "production" },',
      "});",
    ].join("\n"),
    "apps/worker/src/index.ts": [
      'import { runWorkerBootstrap } from "./bootstrap.js";',
      "await runWorkerBootstrap();",
    ].join("\n"),
    "apps/worker/src/bootstrap.ts": [
      'import { runWorkerStartupGate } from "./security/startup-gate.js";',
      "async function runWorkerBootstrap(dependencies = {}) {",
      "  const runStartupGate = dependencies.runStartupGate ?? runWorkerStartupGate;",
      "  const loadBusinessEntry = dependencies.loadBusinessEntry ??",
      '    (async () => import("./worker-entry.js"));',
      "  await runStartupGate();",
      "  const workerEntry = await loadBusinessEntry();",
      "  await workerEntry.startWorker();",
      "}",
    ].join("\n"),
  };
}

async function writeFiles(
  root: string,
  files: Record<string, string>,
) {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), {
      recursive: true,
    });
    await fs.writeFile(absolutePath, content, "utf8");
  }
}

function aggregateEvaluation(result: SemanticResult) {
  if (result.evaluations.length === 0) {
    return {
      abstractValueKind: result.analysisState,
      securityState: result.analysisState,
      invocationTarget: result.analysisState,
    };
  }
  const rank = {
    SAFE: 0,
    UNKNOWN: 1,
    DANGEROUS: 2,
    ERROR: 3,
  };
  const maxRank = Math.max(
    ...result.evaluations.map(
      (evaluation) => rank[evaluation.securityState],
    ),
  );
  const highest = result.evaluations.filter(
    (evaluation) => rank[evaluation.securityState] === maxRank,
  );
  const nonEmptyHighest = highest.filter(
    (evaluation) =>
      evaluation.abstractValueKind !==
      "EMPTY_SUCCESS_STREAM",
  );
  const candidates =
    nonEmptyHighest.length > 0 ? nonEmptyHighest : highest;
  const lastLine = Math.max(
    ...candidates.map((evaluation) => evaluation.line),
  );
  const lineValues = result.evaluations.filter(
    (evaluation) => evaluation.line === lastLine,
  );
  const kinds = [
    ...new Set(lineValues.map((item) => item.abstractValueKind)),
  ];
  return {
    abstractValueKind:
      kinds.length === 1
        ? (kinds[0] ?? result.analysisState)
        : `VALUE_UNION(${kinds.join(", ")})`,
    securityState:
      lineValues[0]?.securityState ?? result.analysisState,
    invocationTarget: [
      ...new Set(
        lineValues.map((item) => item.invocationTarget),
      ),
    ].join(" | "),
  };
}

async function runCase(
  matrixCase: MatrixCase,
): Promise<{
  semantic: SemanticResult;
  builderCalls: number;
  errorCode: string | null;
}> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "p13-powershell-resolver-"),
  );
  const relativeScript = `scripts/${matrixCase.id}.ps1`;
  const headFiles = secureFiles();
  const worktreeFiles = {
    ...headFiles,
    [relativeScript]: matrixCase.content,
  };
  try {
    await writeFiles(root, worktreeFiles);
    const semantic = inspectPowerShellSemantics(
      relativeScript,
      matrixCase.content,
    ) as SemanticResult;
    let builderCalls = 0;
    let errorCode: string | null = null;
    try {
      await executeGuardedBuild({
        runPreflight: () =>
          runBuildSecurityPreflight({
            application: "web",
            workspaceRoot: root,
            appDirectory: path.join(root, "apps/web"),
            targetRoot: path.join(
              root,
              "apps/web/.p13-releases",
              `release-${matrixCase.id.toLowerCase()}`,
            ),
            readRevision: async (relativePath) =>
              headFiles[relativePath] ?? null,
            listHeadPaths: async () => Object.keys(headFiles),
          }),
        build: async () => {
          builderCalls += 1;
          return "built";
        },
      });
    } catch (error) {
      errorCode =
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "UNKNOWN_ERROR";
    }
    return {
      semantic,
      builderCalls,
      errorCode,
    };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function expectCase(matrixCase: MatrixCase) {
  const result = await runCase(matrixCase);
  const evaluation = aggregateEvaluation(result.semantic);
  expect(result.semantic.analysisState).toBe(matrixCase.state);
  expect(evaluation.securityState).toBe(matrixCase.state);
  expect(evaluation.abstractValueKind).toContain(matrixCase.kind);
  expect(evaluation.invocationTarget.length).toBeGreaterThan(0);
  if (matrixCase.state === "SAFE") {
    expect(result.semantic.findings).toEqual([]);
    expect(result.errorCode).toBeNull();
    expect(result.builderCalls).toBe(1);
  } else {
    expect(
      result.semantic.findings.some(
        (finding) =>
          finding.classification === matrixCase.state,
      ),
    ).toBe(true);
    expect(result.errorCode).toBe(
      "BUILD_SOURCE_SECURITY_FAILED",
    );
    expect(result.builderCalls).toBe(0);
  }
}

const functionOutputCases: MatrixCase[] = [
  {
    id: "FO-01",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "function Get-Target { [scriptblock]::Create('next start') }",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "FO-02",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "function Get-Target { Write-Output ([scriptblock]::Create('next start')) }",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "FO-03",
    state: "SAFE",
    kind: "EMPTY_SUCCESS_STREAM",
    content: [
      "function Get-Target { $value = [scriptblock]::Create('next start') }",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "FO-04",
    state: "DANGEROUS",
    kind: "VALUE_UNION",
    content: [
      "param([bool]$condition)",
      "function Get-Target {",
      "  if ($condition) { return [scriptblock]::Create('next start') }",
      "  [scriptblock]::Create('Write-Host safe')",
      "}",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "FO-05",
    state: "SAFE",
    kind: "EMPTY_SUCCESS_STREAM",
    content: [
      "function Get-Target { Write-Host 'next start' }",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "FO-06",
    state: "SAFE",
    kind: "EMPTY_SUCCESS_STREAM",
    content: [
      "function Get-Target { Write-Error 'next start' }",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "FO-07",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "function Get-Target {",
      "  return [scriptblock]::Create('next start')",
      "  [scriptblock]::Create('Write-Host safe')",
      "}",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "FO-08",
    state: "SAFE",
    kind: "EMPTY_SUCCESS_STREAM",
    content: [
      "function Get-Target {",
      "  [scriptblock]::Create('next start') | Out-Null",
      "}",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
];

const assignmentCases: MatrixCase[] = [
  {
    id: "ASN-01",
    state: "SAFE",
    kind: "SCRIPTBLOCK(SAFE)",
    content: [
      "$target = [scriptblock]::Create('next start')",
      "$TARGET = [scriptblock]::Create('Write-Host safe')",
      "$target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-02",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$target = [scriptblock]::Create('Write-Host safe')",
      "$TARGET = [scriptblock]::Create('next start')",
      "$target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-03",
    state: "DANGEROUS",
    kind: "VALUE_UNION",
    content: [
      "param([bool]$condition)",
      "if ($condition) {",
      "  $target = [scriptblock]::Create('next start')",
      "} else {",
      "  $target = [scriptblock]::Create('Write-Host safe')",
      "}",
      "$target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-04",
    state: "SAFE",
    kind: "SCRIPTBLOCK(SAFE)",
    content: [
      "param([bool]$condition)",
      "if ($condition) {",
      "  $target = [scriptblock]::Create('next start')",
      "} else {",
      "  $target = [scriptblock]::Create('Write-Host safe')",
      "}",
      "$target = [scriptblock]::Create('Write-Host final')",
      "$target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-05",
    state: "SAFE",
    kind: "SCRIPTBLOCK(SAFE)",
    content: [
      "$obj = @{ Target = [scriptblock]::Create('next start') }",
      "$obj.target = [scriptblock]::Create('Write-Host safe')",
      "$obj.Target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-06",
    state: "ERROR",
    kind: "ERROR",
    content: [
      "$obj = @{",
      "  Target = [scriptblock]::Create('next start')",
      "  target = [scriptblock]::Create('Write-Host safe')",
      "}",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-07",
    state: "UNKNOWN",
    kind: "UNKNOWN",
    content: [
      "$obj = Get-ObjectWithUnknownComparer",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-08",
    state: "DANGEROUS",
    kind: "VALUE_UNION",
    content: [
      "param([bool]$condition)",
      "$obj = if ($condition) {",
      "  @{ Target = [scriptblock]::Create('next start') }",
      "} else {",
      "  @{ target = [scriptblock]::Create('Write-Host safe') }",
      "}",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-09",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$obj = [pscustomobject]@{",
      "  Target = [scriptblock]::Create('next start')",
      "}",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "ASN-10",
    state: "UNKNOWN",
    kind: "UNKNOWN",
    content: [
      "$obj = Get-PsObjectWithCaseCollidingMembers",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
];

const scopeCases: MatrixCase[] = [
  {
    id: "SC-01",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "function Invoke-Target { $target.Invoke() }",
      "function Start-Wrapper {",
      "  $target = [scriptblock]::Create('next start')",
      "  Invoke-Target",
      "}",
      "Start-Wrapper",
    ].join("\n"),
  },
  {
    id: "SC-02",
    state: "SAFE",
    kind: "SCRIPTBLOCK(SAFE)",
    content: [
      "function Invoke-Target {",
      "  $target = [scriptblock]::Create('Write-Host safe')",
      "  $target.Invoke()",
      "}",
      "function Start-Wrapper {",
      "  $target = [scriptblock]::Create('next start')",
      "  Invoke-Target",
      "}",
      "Start-Wrapper",
    ].join("\n"),
  },
  {
    id: "SC-03",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$global:target = [scriptblock]::Create('next start')",
      "$global:target.Invoke()",
    ].join("\n"),
  },
  {
    id: "SC-04",
    state: "UNKNOWN",
    kind: "UNKNOWN",
    content: [
      "function Invoke-Target { $target.Invoke() }",
      "Invoke-Target",
    ].join("\n"),
  },
  {
    id: "SC-05",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$script:target = [scriptblock]::Create('next start')",
      "$script:target.Invoke()",
    ].join("\n"),
  },
];

const createCases: MatrixCase[] = [
  {
    id: "SBC-01",
    state: "SAFE",
    kind: "SCRIPTBLOCK(SAFE)",
    content:
      "[scriptblock]::Create('Write-Host safe').Invoke()\n",
  },
  {
    id: "SBC-02",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: "[scriptblock]::Create('next start').Invoke()\n",
  },
  {
    id: "SBC-03",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content:
      "[scriptblock]::Create('next ' + 'start').Invoke()\n",
  },
  {
    id: "SBC-04",
    state: "DANGEROUS",
    kind: "VALUE_UNION",
    content: [
      "param([bool]$condition)",
      "$body = if ($condition) { 'next start' } else { 'Write-Host safe' }",
      "[scriptblock]::Create($body).Invoke()",
    ].join("\n"),
  },
  {
    id: "SBC-05",
    state: "UNKNOWN",
    kind: "SCRIPTBLOCK(UNKNOWN)",
    content: [
      "$body = Get-RemoteScript",
      "[scriptblock]::Create($body).Invoke()",
    ].join("\n"),
  },
  {
    id: "SBC-06",
    state: "ERROR",
    kind: "SCRIPTBLOCK(ERROR)",
    content:
      "[scriptblock]::Create('function broken {').Invoke()\n",
  },
];

const closureCases: MatrixCase[] = [
  {
    id: "CL-01",
    state: "DANGEROUS",
    kind: "CLOSURE(DANGEROUS)",
    content: [
      "$target = [scriptblock]::Create('next start')",
      "$closure = { $target.Invoke() }.GetNewClosure()",
      "$target = [scriptblock]::Create('Write-Host safe')",
      "& $closure",
    ].join("\n"),
  },
  {
    id: "CL-02",
    state: "SAFE",
    kind: "CLOSURE(SAFE)",
    content: [
      "$target = [scriptblock]::Create('Write-Host safe')",
      "$closure = { $target.Invoke() }.GetNewClosure()",
      "$target = [scriptblock]::Create('next start')",
      "& $closure",
    ].join("\n"),
  },
  {
    id: "CL-03",
    state: "DANGEROUS",
    kind: "CLOSURE(DANGEROUS)",
    content: [
      "$obj = @{ target = [scriptblock]::Create('Write-Host safe') }",
      "$closure = { $obj.target.Invoke() }.GetNewClosure()",
      "$obj.target = [scriptblock]::Create('next start')",
      "& $closure",
    ].join("\n"),
  },
  {
    id: "CL-04",
    state: "DANGEROUS",
    kind: "CLOSURE(DANGEROUS)",
    content: [
      "$obj = @{ target = [scriptblock]::Create('next start') }",
      "$closure = { $obj.target.Invoke() }.GetNewClosure()",
      "$obj = @{ target = [scriptblock]::Create('Write-Host safe') }",
      "& $closure",
    ].join("\n"),
  },
  {
    id: "CL-05",
    state: "DANGEROUS",
    kind: "CLOSURE(DANGEROUS)",
    content: [
      "$items = @([scriptblock]::Create('Write-Host safe'))",
      "$closure = { $items[0].Invoke() }.GetNewClosure()",
      "$items[0] = [scriptblock]::Create('next start')",
      "& $closure",
    ].join("\n"),
  },
  {
    id: "CL-06",
    state: "UNKNOWN",
    kind: "CLOSURE(UNKNOWN)",
    content: [
      "$target = Get-RemoteScript",
      "$closure = { & $target }.GetNewClosure()",
      "& $closure",
    ].join("\n"),
  },
];

const snapshotCases: MatrixCase[] = [
  {
    id: "SN-01",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$danger = [scriptblock]::Create('next start')",
      "$obj = @{ target = $danger }",
      "$danger = [scriptblock]::Create('Write-Host safe')",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "SN-02",
    state: "SAFE",
    kind: "SCRIPTBLOCK(SAFE)",
    content: [
      "$obj = @{ target = [scriptblock]::Create('next start') }",
      "$alias = $obj",
      "$alias.target = [scriptblock]::Create('Write-Host safe')",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "SN-03",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$obj = @{",
      "  target = [scriptblock]::Create('next start')",
      "  other = 'unchanged'",
      "}",
      "$obj.other = 'updated'",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "SN-04",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$items = @(",
      "  [scriptblock]::Create('next start'),",
      "  [scriptblock]::Create('Write-Host safe')",
      ")",
      "$items[1] = [scriptblock]::Create('Write-Host updated')",
      "$items[0].Invoke()",
    ].join("\n"),
  },
  {
    id: "SN-05",
    state: "DANGEROUS",
    kind: "VALUE_UNION",
    content: [
      "param([bool]$condition)",
      "$items = @([scriptblock]::Create('Write-Host safe'))",
      "if ($condition) {",
      "  $items[0] = [scriptblock]::Create('next start')",
      "}",
      "$items[0].Invoke()",
    ].join("\n"),
  },
];

const resourceCases: MatrixCase[] = [
  {
    id: "RES-01",
    state: "ERROR",
    kind: "ERROR",
    content: [
      "$value = [scriptblock]::Create('next start')",
      `$value${".a".repeat(33)}.Invoke()`,
    ].join("\n"),
  },
  {
    id: "RES-02",
    state: "ERROR",
    kind: "ERROR",
    content: ["function Recurse { Recurse }", "Recurse"].join(
      "\n",
    ),
  },
  {
    id: "RES-03",
    state: "ERROR",
    kind: "ERROR",
    content: Array.from(
      { length: 50_100 },
      () => "$value = 1",
    ).join("\n"),
  },
];

const preflightCases: MatrixCase[] = [
  {
    id: "PRE-01",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: "[scriptblock]::Create('next start').Invoke()\n",
  },
  {
    id: "PRE-02",
    state: "UNKNOWN",
    kind: "UNKNOWN",
    content: "$value = Get-RemoteScript\n& $value\n",
  },
  {
    id: "PRE-03",
    state: "ERROR",
    kind: "ERROR",
    content: "[scriptblock]::Create('function broken {').Invoke()\n",
  },
  {
    id: "PRE-04",
    state: "SAFE",
    kind: "SCRIPTBLOCK(SAFE)",
    content:
      "[scriptblock]::Create('Write-Host safe').Invoke()\n",
  },
];

const a716RegressionCases: MatrixCase[] = [
  {
    id: "A716-01",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$obj = @{ target = [scriptblock]::Create('next start') }",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "A716-02",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "$global:script = [scriptblock]::Create('next start')",
      "$global:script.Invoke()",
    ].join("\n"),
  },
  {
    id: "A716-03",
    state: "DANGEROUS",
    kind: "SCRIPTBLOCK(DANGEROUS)",
    content: [
      "function Get-Target {",
      "  return [scriptblock]::Create('next start')",
      "}",
      "(Get-Target).Invoke()",
    ].join("\n"),
  },
  {
    id: "A716-04",
    state: "UNKNOWN",
    kind: "UNKNOWN",
    content: [
      "$obj = @{ target = Get-RemoteScript }",
      "$obj.target.Invoke()",
    ].join("\n"),
  },
  {
    id: "A716-05",
    state: "UNKNOWN",
    kind: "UNKNOWN",
    content: [
      "$script = Get-RemoteScript",
      "$script.GetNewClosure().Invoke()",
    ].join("\n"),
  },
  {
    id: "A716-06",
    state: "UNKNOWN",
    kind: "UNKNOWN",
    content: [
      "$script = Get-RemoteScript",
      "Invoke-Command -ScriptBlock $script",
    ].join("\n"),
  },
];

describe("PowerShell finite semantic resolver", () => {
  it.each(functionOutputCases)(
    "$id function output and pipeline semantics",
    expectCase,
  );

  it.each(assignmentCases)(
    "$id canonical assignment, object, and merge semantics",
    expectCase,
  );

  it.each(scopeCases)(
    "$id caller-sensitive scope semantics",
    expectCase,
  );

  it.each(createCases)(
    "$id ScriptBlock.Create content semantics",
    expectCase,
  );

  it.each(closureCases)(
    "$id closure capture semantics",
    expectCase,
  );

  it.each(snapshotCases)(
    "$id object and array snapshot semantics",
    expectCase,
  );

  it.each(resourceCases)(
    "$id analysis budget semantics",
    expectCase,
  );

  it.each(preflightCases)(
    "$id Build Preflight boundary",
    expectCase,
  );

  it.each(a716RegressionCases)(
    "$id A7.16 adversarial regression",
    expectCase,
  );

  it("PRE-05 blocks the builder when the HEAD inventory is incomplete", async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "p13-powershell-head-incomplete-"),
    );
    const headFiles = secureFiles();
    try {
      await writeFiles(root, headFiles);
      let builderCalls = 0;
      await expect(
        executeGuardedBuild({
          runPreflight: () =>
            runBuildSecurityPreflight({
              application: "web",
              workspaceRoot: root,
              appDirectory: path.join(root, "apps/web"),
              targetRoot: path.join(
                root,
                "apps/web/.p13-releases/release-pre-05",
              ),
              readRevision: async (relativePath) =>
                headFiles[relativePath] ?? null,
              listHeadPaths: async () => {
                throw new Error("HEAD_INVENTORY_UNAVAILABLE");
              },
            }),
          build: async () => {
            builderCalls += 1;
            return "built";
          },
        }),
      ).rejects.toMatchObject({
        code: "BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE",
      });
      expect(builderCalls).toBe(0);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
