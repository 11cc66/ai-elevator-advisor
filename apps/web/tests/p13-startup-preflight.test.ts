import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  executeGuardedBuild,
  inspectStartupEntrySecurity,
  ReleaseSecurityError,
  runBuildSecurityPreflight,
  validateSigningPrivateKeyPath,
} from "@elevator/build-integrity";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

let root = "";

beforeEach(async () => {
  root = await fs.mkdtemp(
    path.join(os.tmpdir(), "p13-startup-preflight-"),
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function secureFiles(): Record<string, string | null> {
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
      'if (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) {',
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

async function writeFiles(files: Record<string, string | null>) {
  for (const [relativePath, content] of Object.entries(files)) {
    if (content === null) {
      continue;
    }
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, "utf8");
  }
}

function headReader(files: Record<string, string | null>) {
  return async (relativePath: string): Promise<string | null> =>
    files[relativePath] ?? null;
}

function headPathList(files: Record<string, string | null>) {
  return async (): Promise<string[]> =>
    Object.keys(files);
}

async function inspectScenario(
  worktreeFiles: Record<string, string | null>,
  headFiles: Record<string, string | null> = worktreeFiles,
) {
  await writeFiles(worktreeFiles);
  return inspectStartupEntrySecurity({
    workspaceRoot: root,
    readRevision: headReader(headFiles),
    listHeadPaths: headPathList(headFiles),
  });
}

describe("startup entry source security", () => {
  it("passes a Gate-first secure worktree and matching HEAD", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: headReader(files),
      listHeadPaths: headPathList(files),
    });

    expect(report).toMatchObject({
      worktree: { status: "PASS", findings: [] },
      head: { status: "PASS", findings: [] },
      headVsWorktree: "IDENTICAL",
      differences: [],
    });
    expect(report.legacyArtifacts).toEqual([
      { relativePath: "apps/web/.next", present: false },
      { relativePath: "apps/worker/dist", present: false },
    ]);
  });

  it("rejects direct production package entries and aliases", async () => {
    const files = secureFiles();
    files["apps/web/package.json"] = JSON.stringify({
      scripts: {
        build: "tsx scripts/build-secure.ts",
        start: "next start",
      },
    });
    files["apps/worker/package.json"] = JSON.stringify({
      scripts: {
        build: "tsx scripts/build-secure.ts",
        start: "node scripts/wrapper.mjs",
      },
    });
    await writeFiles(files);

    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: headReader(files),
      listHeadPaths: headPathList(files),
    });
    expect(report.worktree.status).toBe("FAIL");
    expect(
      report.worktree.findings.map((finding) => finding.code),
    ).toEqual(
      expect.arrayContaining([
        "PRODUCTION_SCRIPT_UNSAFE",
        "DIRECT_NEXT_START_FORBIDDEN",
      ]),
    );
  });

  it("rejects Worker business imports and Gate ordering violations", async () => {
    const files = secureFiles();
    files["apps/worker/src/index.ts"] =
      'import { PrismaClient } from "@prisma/client";\nawait runWorkerBootstrap();\n';
    files["apps/worker/src/bootstrap.ts"] = [
      "async function runWorkerBootstrap(dependencies = {}) {",
      "  const workerEntry = await loadBusinessEntry();",
      "  await runStartupGate();",
      '  return import("./worker-entry.js");',
      "}",
    ].join("\n");
    await writeFiles(files);

    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: headReader(secureFiles()),
      listHeadPaths: headPathList(secureFiles()),
    });
    expect(report.worktree.status).toBe("FAIL");
    expect(
      report.worktree.findings.map((finding) => finding.code),
    ).toEqual(
      expect.arrayContaining([
        "WORKER_BUSINESS_IMPORT_BEFORE_GATE",
        "WORKER_GATE_ORDER_INVALID",
      ]),
    );
  });

  it("rejects direct startup in an otherwise unknown wrapper script", async () => {
    const files = secureFiles();
    files["apps/web/scripts/legacy-start.mjs"] =
      'await import("node:child_process").then(({ exec }) => exec("next start"));\n';
    await writeFiles(files);

    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: headReader(secureFiles()),
      listHeadPaths: headPathList(secureFiles()),
    });
    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCRIPT_DIRECT_NEXT_START",
          file: "apps/web/scripts/legacy-start.mjs",
        }),
      ]),
    );
  });

  it("identifies unsafe HEAD even when the worktree is secure", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const unsafeHead = {
      ...files,
      "apps/web/package.json": JSON.stringify({
        scripts: {
          build: "next build",
          start: "next start",
        },
      }),
      "apps/worker/package.json": JSON.stringify({
        scripts: {
          build: "tsc -p tsconfig.build.json",
          start: "node dist/index.js",
        },
      }),
    };

    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: headReader(unsafeHead),
      listHeadPaths: headPathList(unsafeHead),
    });
    expect(report).toMatchObject({
      worktree: { status: "PASS", complete: true },
      head: { status: "FAIL", complete: true },
      headVsWorktree: "DIFFERENT",
    });
    expect(report.differences).toEqual(
      expect.arrayContaining([
        "apps/web/package.json",
        "apps/worker/package.json",
      ]),
    );
  });
});

describe("build preflight", () => {
  it("runs no builder and returns the audit for a valid new target", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const target = path.join(
      root,
      "apps/web/.p13-releases/release-test",
    );
    const report = await runBuildSecurityPreflight({
      application: "web",
      workspaceRoot: root,
      appDirectory: path.join(root, "apps/web"),
      targetRoot: target,
      readRevision: headReader(files),
      listHeadPaths: headPathList(files),
    });

    expect(report.worktree.status).toBe("PASS");
    await expect(fs.access(target)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

describe("script-type and HEAD symmetry coverage", () => {
  it("detects direct and variable-based Shell commands", async () => {
    const files = secureFiles();
    files["scripts/release.sh"] = [
      'TARGET="node ./dist/index.js"',
      "$TARGET",
      'bash -c "next start"',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.scriptInventory.added).toContain(
      "scripts/release.sh",
    );
    expect(
      report.worktree.findings.map((finding) => finding.code),
    ).toEqual(
      expect.arrayContaining([
        "SCRIPT_DIRECT_WORKER_DIST",
        "SCRIPT_DIRECT_NEXT_START",
      ]),
    );
  });

  it("detects PowerShell Start-Process, call-operator, and variable forms", async () => {
    const files = secureFiles();
    files["scripts/release.ps1"] = [
      '$command = "next"',
      "Start-Process -FilePath $command -ArgumentList 'start'",
      '& "node" ".\\apps\\worker\\dist\\index.js"',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const codes = report.worktree.findings.map(
      (finding) => finding.code,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(codes).toContain("SCRIPT_DIRECT_NEXT_START");
    expect(codes).toContain("SCRIPT_DIRECT_WORKER_DIST");
    expect(report.unknowns).toHaveLength(0);
  });

  it("detects CMD/BAT CALL and variable concatenation", async () => {
    const files = secureFiles();
    files["scripts/release.cmd"] = [
      'set "NEXT_COMMAND=next start"',
      "call %NEXT_COMMAND%",
      "set ENTRY=node .\\apps\\worker\\dist\\index.js",
      "call %ENTRY%",
    ].join("\r\n");

    const report = await inspectScenario(files, secureFiles());
    const codes = report.worktree.findings.map(
      (finding) => finding.code,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(codes).toContain("SCRIPT_DIRECT_NEXT_START");
    expect(codes).toContain("SCRIPT_DIRECT_WORKER_DIST");
  });

  it("detects JavaScript spawn, alias, require, and dynamic import forms", async () => {
    const files = secureFiles();
    files["scripts/release.mjs"] = [
      'const command = "next";',
      'const args = ["start"];',
      'const loader = require;',
      'import { fork, spawn as launch } from "node:child_process";',
      "launch(command, args);",
      'loader("./worker-entry.js");',
      'fork("./worker-entry.js");',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const codes = report.worktree.findings.map(
      (finding) => finding.code,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(codes).toContain("SCRIPT_DIRECT_NEXT_START");
    expect(codes).toContain("SCRIPT_WORKER_ENTRY_IMPORT_FORBIDDEN");
    expect(codes).toContain(
      "SCRIPT_WORKER_ENTRY_FORK_FORBIDDEN",
    );
  });

  it("detects inline require, namespace import, and re-export runtime paths", async () => {
    const files = secureFiles();
    files["scripts/imports.mjs"] = [
      'export * from "./worker-entry.js";',
      'require("node:child_process").exec("next start");',
      'import * as cp from "node:child_process";',
      'cp.spawn("node", ["./dist/index.js"]);',
      "const dynamicModule = process.env.MODULE_NAME;",
      "await import(dynamicModule);",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const codes = report.worktree.findings.map(
      (finding) => finding.code,
    );

    expect(codes).toContain(
      "SCRIPT_WORKER_ENTRY_IMPORT_FORBIDDEN",
    );
    expect(codes).toContain("SCRIPT_DIRECT_NEXT_START");
    expect(codes).toContain("SCRIPT_DIRECT_WORKER_DIST");
    expect(report.unknowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCRIPT_UNKNOWN_DYNAMIC_IMPORT",
          file: "scripts/imports.mjs",
        }),
      ]),
    );
  });

  it("ignores comments and display-only strings", async () => {
    const files = secureFiles();
    files["scripts/safe.sh"] = [
      "# next start",
      'echo "node dist/index.js"',
    ].join("\n");
    files["scripts/safe.ps1"] = [
      "# Start-Process next start",
      "Write-Host 'next start'",
    ].join("\n");
    files["scripts/safe.cmd"] =
      "REM next start\r\necho node dist\\index.js";
    files["scripts/safe.mjs"] = [
      '// await spawn("next", ["start"]);',
      'const display = "next start";',
      "const matcher = /next start/;",
      'matcher.exec("next start");',
      'const workerLabel = "node dist/index.js";',
      "console.log(display, workerLabel);",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree).toMatchObject({
      status: "PASS",
      complete: true,
      findings: [],
    });
  });

  it("scans HEAD-only Shell, PowerShell, and CMD wrappers", async () => {
    const worktreeFiles = secureFiles();
    const headFiles = {
      ...secureFiles(),
      "scripts/head-only.sh": "next start\n",
      "scripts/head-only": "#!/bin/sh\nnext start\n",
      "apps/worker/scripts/head-only.ps1":
        'Start-Process -FilePath "node" -ArgumentList ".\\dist\\index.js"\n',
      "scripts/head-only.cmd": "node apps\\worker\\dist\\index.js\n",
    };

    const report = await inspectScenario(worktreeFiles, headFiles);

    expect(report.worktree.status).toBe("PASS");
    expect(report.head.status).toBe("FAIL");
    expect(report.scriptInventory.removed).toEqual([
      "apps/worker/scripts/head-only.ps1",
      "scripts/head-only",
      "scripts/head-only.cmd",
      "scripts/head-only.sh",
    ]);
    expect(report.differences).toEqual(
      expect.arrayContaining(report.scriptInventory.removed),
    );
  });

  it("detects worktree-only wrappers and changed same-name wrappers", async () => {
    const worktreeFiles = secureFiles();
    worktreeFiles["scripts/workspace-only.ps1"] =
      '& "next" "start"\n';
    worktreeFiles["scripts/changed.sh"] = "next start\n";
    const headFiles = {
      ...secureFiles(),
      "scripts/changed.sh": "# safe in HEAD\n",
    };

    const report = await inspectScenario(worktreeFiles, headFiles);

    expect(report.scriptInventory.added).toEqual([
      "scripts/workspace-only.ps1",
    ]);
    expect(report.scriptInventory.changed).toEqual([
      "scripts/changed.sh",
    ]);
    expect(report.worktree.status).toBe("FAIL");
  });

  it("records deleted and renamed wrappers symmetrically", async () => {
    const worktreeFiles = secureFiles();
    worktreeFiles["scripts/new-name.sh"] = "next start\n";
    const headFiles = {
      ...secureFiles(),
      "scripts/old-name.sh": "next start\n",
    };

    const report = await inspectScenario(worktreeFiles, headFiles);

    expect(report.scriptInventory.added).toContain(
      "scripts/new-name.sh",
    );
    expect(report.scriptInventory.removed).toContain(
      "scripts/old-name.sh",
    );
    expect(report.differences).toEqual(
      expect.arrayContaining([
        "scripts/new-name.sh",
        "scripts/old-name.sh",
      ]),
    );
  });

  it("fails closed when a listed HEAD script cannot be read", async () => {
    const worktreeFiles = secureFiles();
    const headFiles = {
      ...secureFiles(),
      "scripts/unreadable.sh": null,
    };

    const report = await inspectScenario(worktreeFiles, headFiles);

    expect(report.head).toMatchObject({
      status: "FAIL",
      complete: false,
    });
    expect(
      report.head.findings.map((finding) => finding.code),
    ).toContain("HEAD_SCRIPT_READ_FAILED");
  });

  it("fails closed when HEAD enumeration itself fails", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: headReader(files),
      listHeadPaths: async () => {
        throw new Error("git unavailable");
      },
    });

    expect(report.head).toMatchObject({
      status: "FAIL",
      complete: false,
    });
    expect(
      report.head.findings.map((finding) => finding.code),
    ).toContain("HEAD_PATH_ENUMERATION_FAILED");
  });

  it("fails closed when a required HEAD file is absent", async () => {
    const files = secureFiles();
    const headFiles = secureFiles();
    delete headFiles["apps/web/scripts/build-secure.ts"];

    const report = await inspectScenario(files, headFiles);

    expect(report.head).toMatchObject({
      status: "FAIL",
      complete: false,
    });
    expect(
      report.head.findings.map((finding) => finding.code),
    ).toContain("HEAD_REQUIRED_FILE_MISSING");
  });

  it("fails closed when a required HEAD file reader returns null", async () => {
    const files = secureFiles();
    const headFiles = {
      ...secureFiles(),
      "apps/web/scripts/build-secure.ts": null,
    };

    const report = await inspectScenario(files, headFiles);

    expect(report.head).toMatchObject({
      status: "FAIL",
      complete: false,
    });
    expect(
      report.head.findings.map((finding) => finding.code),
    ).toContain("HEAD_REQUIRED_FILE_READ_FAILED");
  });

  it("fails closed when a required HEAD file reader throws", async () => {
    const files = secureFiles();
    const headFiles = secureFiles();
    await writeFiles(files);
    const reader = headReader(headFiles);
    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: async (relativePath) => {
        if (relativePath === "apps/web/scripts/build-secure.ts") {
          throw new Error("GIT_READ_FAILED");
        }
        return reader(relativePath);
      },
      listHeadPaths: headPathList(headFiles),
    });

    expect(report.head).toMatchObject({
      status: "FAIL",
      complete: false,
    });
    expect(
      report.head.findings.map((finding) => finding.code),
    ).toContain("HEAD_REQUIRED_FILE_READ_FAILED");
  });

  it("fails closed when a required HEAD file cannot be parsed", async () => {
    const files = secureFiles();
    const headFiles = {
      ...secureFiles(),
      "package.json": "{invalid-json",
    };

    const report = await inspectScenario(files, headFiles);

    expect(report.head).toMatchObject({
      status: "FAIL",
      complete: false,
    });
    expect(
      report.head.findings.map((finding) => finding.code),
    ).toContain("HEAD_REQUIRED_FILE_PARSE_FAILED");
  });

  it("fails closed when a worktree script root is a junction", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const target = path.join(root, "external-scripts");
    const linked = path.join(root, "scripts", "linked");
    await fs.mkdir(target, { recursive: true });
    await fs.mkdir(path.dirname(linked), { recursive: true });
    await fs.symlink(target, linked, "junction");

    const report = await inspectStartupEntrySecurity({
      workspaceRoot: root,
      readRevision: headReader(files),
      listHeadPaths: headPathList(files),
    });

    expect(report.worktree).toMatchObject({
      status: "FAIL",
      complete: false,
    });
    expect(
      report.worktree.findings.map((finding) => finding.code),
    ).toContain("WORKTREE_SCRIPT_SYMLINK_FORBIDDEN");
  });

  it("treats unresolved dynamic commands as UNKNOWN and fail-closed", async () => {
    const files = secureFiles();
    files["scripts/dynamic.sh"] = [
      "if [ -n \"$UNSET_COMMAND\" ]; then",
      "  $UNSET_COMMAND",
      "fi",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.unknowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          revision: "WORKTREE",
          code: "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
          file: "scripts/dynamic.sh",
          classification: "UNKNOWN",
        }),
      ]),
    );
  });

  it("detects A7.2 nested Shell bypass samples", async () => {
    const files = secureFiles();
    files["scripts/nested-shell.sh"] = [
      "if [ -f .next ]; then next start; fi",
      "(next start)",
      'echo "$(next start)"',
      'eval "next start"',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const findings = report.worktree.findings.filter(
      (finding) =>
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(findings).toHaveLength(4);
    expect(
      findings.every(
        (finding) => finding.classification === "DANGEROUS",
      ),
    ).toBe(true);
  });

  it("detects A7.2 PowerShell ScriptBlock bypass samples", async () => {
    const files = secureFiles();
    files["scripts/blocks.ps1"] = [
      "if (Test-Path .next) { next start }",
      "Invoke-Command -ScriptBlock { next start }",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const findings = report.worktree.findings.filter(
      (finding) =>
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(findings).toHaveLength(2);
  });

  it("marks unresolved PowerShell and CMD dynamic blocks as UNKNOWN", async () => {
    const files = secureFiles();
    files["scripts/dynamic.ps1"] = [
      "$block = $env:DYNAMIC_SCRIPT_BLOCK",
      "Invoke-Command -ScriptBlock $block",
    ].join("\n");
    files["scripts/dynamic.cmd"] = [
      "set DYNAMIC_COMMAND=%EXTERNAL_COMMAND%",
      "call %DYNAMIC_COMMAND%",
    ].join("\r\n");

    const report = await inspectScenario(files, secureFiles());
    const unknownFiles = report.unknowns.map(
      (finding) => finding.file,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(unknownFiles).toEqual(
      expect.arrayContaining([
        "scripts/dynamic.ps1",
        "scripts/dynamic.cmd",
      ]),
    );
  });

  it("detects A7.2 CMD conditional and loop bypass samples", async () => {
    const files = secureFiles();
    files["scripts/blocks.cmd"] = [
      "if exist .next next start",
      "for %%x in (a) do next start",
    ].join("\r\n");

    const report = await inspectScenario(files, secureFiles());
    const findings = report.worktree.findings.filter(
      (finding) =>
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(findings).toHaveLength(2);
  });

  it("detects A7.2 JavaScript dynamic require and computed process calls", async () => {
    const files = secureFiles();
    files["scripts/dynamic-require.mjs"] = [
      "const moduleName = process.env.MODULE_NAME;",
      "require(moduleName);",
    ].join("\n");
    files["scripts/computed-spawn.mjs"] = [
      'const cp = require("node:child_process");',
      'cp["spawn"]("next", ["start"]);',
    ].join("\n");
    files["scripts/variable-property.mjs"] = [
      'const cp = require("node:child_process");',
      'const method = "spawn";',
      'cp[method]("next", ["start"]);',
    ].join("\n");
    files["scripts/unknown-property.mjs"] = [
      'const cp = require("node:child_process");',
      "const method = process.env.METHOD;",
      'cp[method]("next", ["start"]);',
    ].join("\n");
    files["scripts/path-entry.mjs"] = [
      'import { spawn } from "node:child_process";',
      'import path from "node:path";',
      'const entry = path.join("dist", "index.js");',
      "spawn(process.execPath, [entry]);",
    ].join("\n");
    files["scripts/await-import.mjs"] = [
      'const cp = await import("node:child_process");',
      'cp["spawn"]("next", ["start"]);',
    ].join("\n");
    files["scripts/wrapper.mjs"] = [
      'import { spawn } from "node:child_process";',
      "function launch(command, args) {",
      "  spawn(command, args);",
      "}",
      'launch("next", ["start"]);',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const codes = report.worktree.findings.map(
      (finding) => finding.code,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(codes).toContain("SCRIPT_UNKNOWN_DYNAMIC_REQUIRE");
    expect(codes).toContain("SCRIPT_DIRECT_NEXT_START");
    expect(codes).toContain("SCRIPT_DIRECT_WORKER_DIST");
    expect(report.unknowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
          file: "scripts/unknown-property.mjs",
        }),
      ]),
    );
  });

  it("detects A7.4 JavaScript dynamic execution and alias forms", async () => {
    const files = secureFiles();
    files["scripts/eval.mjs"] =
      "eval('require(\"child_process\").spawn(\"next\",[\"start\"])');\n";
    files["scripts/function.mjs"] =
      "new Function('require(\"child_process\").spawn(\"next\",[\"start\"])');\n";
    files["scripts/dynamic-body.mjs"] = [
      "const body = process.env.DYNAMIC_CODE;",
      "eval(body);",
    ].join("\n");
    files["scripts/bind.mjs"] = [
      'const cp = require("node:child_process");',
      'const run = cp["spawn"].bind(cp);',
      'run("next", ["start"]);',
    ].join("\n");
    files["scripts/computed-alias.mjs"] = [
      'const cp = require("node:child_process");',
      'const method = "spawn";',
      "const run = cp[method];",
      'run("next", ["start"]);',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const findings = report.worktree.findings.filter(
      (finding) =>
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(findings.length).toBeGreaterThanOrEqual(4);
    expect(
      findings.every(
        (finding) => finding.classification === "DANGEROUS",
      ),
    ).toBe(true);
    expect(report.unknowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          file: "scripts/dynamic-body.mjs",
        }),
      ]),
    );
  });

  it("detects A7.6 JavaScript deep alias and dynamic source forms", async () => {
    const files = secureFiles();
    files["scripts/deep-alias.mjs"] = [
      'const cp = require("node:child_process");',
      "const { spawn: run } = cp;",
      'run("next", ["start"]);',
      "const comma = (0, cp.spawn);",
      'comma("next", ["start"]);',
      "const doubled = cp.spawn.bind(null).bind(null);",
      'doubled("next", ["start"]);',
      "function make(api) { return function (cmd, args) { api(cmd, args); }; }",
      "const higher = make(cp.spawn);",
      'higher("next", ["start"]);',
      "const [arrayRun] = [cp.spawn];",
      'arrayRun("next", ["start"]);',
      "const mixed = [() => {}, cp.spawn];",
      "const selectedIndex = process.env.SELECTED_INDEX;",
      'mixed[selectedIndex]("next", ["start"]);',
      "const conditional = true ? cp.spawn : (() => {});",
      'conditional("next", ["start"]);',
      "Reflect.apply(cp.spawn, null, [\"next\", [\"start\"]]);",
      "Reflect.apply(eval, null, [\"require('child_process').spawn('next',['start'])\"]);",
      "Reflect.construct(Function, [\"require('child_process').spawn('next',['start'])\"]);",
    ].join("\n");
    files["scripts/deep-eval.mjs"] = [
      "const tools = { run: eval };",
      'tools.run("require(\\\"child_process\\\").spawn(\\\"next\\\",[\\\"start\\\"])");',
      "const elementEval = globalThis['eval'];",
      'elementEval("require(\\\"child_process\\\").spawn(\\\"next\\\",[\\\"start\\\"])");',
      "const boundEval = eval.bind(globalThis);",
      'boundEval("require(\\\"child_process\\\").spawn(\\\"next\\\",[\\\"start\\\"])");',
      'eval`require("child_process").spawn("next",["start"])`;',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const nextStartFindings = report.worktree.findings.filter(
      (finding) =>
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(nextStartFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "scripts/deep-alias.mjs" }),
        expect.objectContaining({ file: "scripts/deep-eval.mjs" }),
      ]),
    );
  });

  it("detects A7.9 JavaScript reassignment, arrays, conditionals, and Reflect forms", async () => {
    const files = secureFiles();
    files["scripts/a79-js-danger.mjs"] = [
      'const cp = require("node:child_process");',
      "let reassigned = () => {};",
      "reassigned = cp.spawn;",
      'reassigned("next", ["start"]);',
      "const [arrayRun] = [cp.spawn];",
      'arrayRun("next", ["start"]);',
      "const nested = [[cp.spawn]];",
      'nested[0][0]("next", ["start"]);',
      "const conditional = process.env.USE_SPAWN",
      "  ? cp.spawn",
      "  : (() => {});",
      'conditional("next", ["start"]);',
      'Reflect.apply(cp.spawn, null, ["next", ["start"]]);',
      "Reflect.apply(eval, null, [",
      '  "require(\'child_process\').spawn(\'next\',[\'start\'])"',
      "]);",
      "Reflect.construct(Function, [",
      '  "require(\'child_process\').spawn(\'next\',[\'start\'])"',
      "]);",
    ].join("\n");
    files["scripts/a79-js-unknown.mjs"] = [
      'const cp = require("node:child_process");',
      "const reflectedArguments = process.env.REFLECTED_ARGS;",
      "Reflect.apply(cp.spawn, null, reflectedArguments);",
    ].join("\n");
    files["scripts/a79-js-nested-array.mjs"] = [
      'const cp = require("node:child_process");',
      "const nested = [[cp.spawn]];",
      'nested[0][0]("next", ["start"]);',
    ].join("\n");
    files["scripts/a79-js-reflect-eval.mjs"] = [
      "Reflect.apply(eval, null, [",
      '  "require(\'child_process\').spawn(\'next\',[\'start\'])"',
      "]);",
    ].join("\n");
    files["scripts/a79-js-reflect-function.mjs"] = [
      "Reflect.construct(Function, [",
      '  "require(\'child_process\').spawn(\'next\',[\'start\'])"',
      "]);",
    ].join("\n");
    files["scripts/a79-js-safe.mjs"] = [
      'const cp = require("node:child_process");',
      "let reclaimed = cp.spawn;",
      "reclaimed = () => {};",
      'reclaimed("next", ["start"]);',
      "const local = { execute(value) { return value; } };",
      "Reflect.apply(local.execute, local, ['next start']);",
      "const safe = true ? (() => {}) : (() => {});",
      "safe();",
      "const values = [1, 2];",
      "values.map((value) => value + 1);",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const dangerous = report.worktree.findings.filter(
      (finding) =>
        finding.file === "scripts/a79-js-danger.mjs" &&
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(dangerous.length).toBeGreaterThanOrEqual(5);
    expect(
      dangerous.every(
        (finding) => finding.classification === "DANGEROUS",
      ),
    ).toBe(true);
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a79-js-nested-array.mjs",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a79-js-reflect-eval.mjs",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a79-js-reflect-function.mjs",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a79-js-unknown.mjs",
          code: "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
          classification: "UNKNOWN",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a79-js-safe.mjs",
        }),
      ]),
    );
  });

  it("detects A7.11 JavaScript expression, mutation, and Reflect alias flows", async () => {
    const files = secureFiles();
    files["scripts/a711-js-danger.mjs"] = [
      'const cp = require("node:child_process");',
      "const logicalOr = (() => {}) || cp.spawn;",
      'logicalOr("next", ["start"]);',
      "const logicalNullish = null ?? cp.spawn;",
      'logicalNullish("next", ["start"]);',
      "let logicalAssign;",
      "logicalAssign ||= cp.spawn;",
      'logicalAssign("next", ["start"]);',
      "let conditionalAssign = () => {};",
      "flag ? conditionalAssign = cp.spawn : conditionalAssign = () => {};",
      'conditionalAssign("next", ["start"]);',
      "const arrayHolder = [() => {}];",
      "arrayHolder[0] = cp.spawn;",
      'arrayHolder[0]("next", ["start"]);',
      "const objectHolder = { run: () => {} };",
      "objectHolder.run = cp.spawn;",
      'objectHolder.run("next", ["start"]);',
      'const atValue = [cp.spawn].at(0);',
      'atValue("next", ["start"]);',
      "const mixed = { items: [{ run: () => {} }] };",
      "mixed.items[0].run = cp.spawn;",
      'mixed.items[0].run("next", ["start"]);',
      "const reflectApply = Reflect.apply;",
      'reflectApply(cp.spawn, null, ["next", ["start"]]);',
      "const reflectConstruct = Reflect.construct;",
      'reflectConstruct(Function, ["require(\'child_process\').spawn(\'next\',[\'start\'])"])',
      "const computedKey = 'run';",
      "const computedObject = { run: () => {} };",
      "computedObject[computedKey] = cp.spawn;",
      'computedObject[computedKey]("next", ["start"]);',
      "const { apply: destructuredReflect } = Reflect;",
      'destructuredReflect(cp.spawn, null, ["next", ["start"]]);',
    ].join("\n");
    files["scripts/a711-js-safe.mjs"] = [
      "const logicalSafe = (() => {}) || (() => {});",
      'logicalSafe("next", ["start"]);',
      "const arraySafe = [() => {}];",
      "arraySafe[0] = () => {};",
      'arraySafe[0]("next", ["start"]);',
      "const objectSafe = { run: () => {} };",
      "objectSafe.run = () => {};",
      'objectSafe.run("next", ["start"]);',
      "const local = { execute(value) { return value; } };",
      "Reflect.apply(local.execute, local, ['next start']);",
    ].join("\n");
    files["scripts/a711-js-unknown.mjs"] = [
      'const cp = require("node:child_process");',
      "const values = [() => {}];",
      "const index = process.env.INDEX;",
      "values[index] = cp.spawn;",
      'values[0]("next", ["start"]);',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const dangerous = report.worktree.findings.filter(
      (finding) =>
        finding.file === "scripts/a711-js-danger.mjs" &&
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(dangerous.length).toBeGreaterThanOrEqual(10);
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a711-js-unknown.mjs",
          code: "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
          classification: "UNKNOWN",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a711-js-safe.mjs",
        }),
      ]),
    );
  });

  it("fails closed when A7.11 JavaScript analysis exceeds its budget", async () => {
    const files = secureFiles();
    const depth = 12;
    const prefix = "[".repeat(depth);
    const suffix = "]".repeat(depth);
    const access = "[0]".repeat(depth);
    files["scripts/a711-js-budget.mjs"] =
      `const cp = require("node:child_process"); ` +
      `const value = ${prefix}cp.spawn${suffix}; ` +
      `value${access}("next", ["start"]);\n`;

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a711-js-budget.mjs",
          code: "SCRIPT_ANALYSIS_BUDGET_EXHAUSTED",
          classification: "ERROR",
        }),
      ]),
    );
  });

  it("propagates A7.12 dynamic values without crashing or returning SAFE", async () => {
    const files = secureFiles();
    files["scripts/a713-js-dynamic-object.mjs"] = [
      'const cp = require("node:child_process");',
      "const source = { safe: () => {}, run: cp.spawn };",
      "const key = process.env.KEY;",
      "const selected = source[key];",
      'selected("next", ["start"]);',
      "const { [key]: destructured } = source;",
      'destructured("next", ["start"]);',
    ].join("\n");
    files["scripts/a713-js-dynamic-array.mjs"] = [
      'const cp = require("node:child_process");',
      "const values = [() => {}, cp.spawn];",
      "const key = process.env.KEY;",
      "const selected = values[Number(key)];",
      'selected("next", ["start"]);',
    ].join("\n");
    files["scripts/a713-js-unknown-call.mjs"] = [
      "function factory() { return process.env.RUN; }",
      "const selected = factory();",
      'selected("next", ["start"]);',
    ].join("\n");
    files["scripts/a713-js-safe.mjs"] = [
      "const source = { first: () => {}, second: () => {} };",
      "const key = process.env.KEY;",
      "const selectedObject = source[key];",
      'selectedObject("next", ["start"]);',
      "const values = [() => {}, () => {}];",
      "const selectedArray = values[Number(key)];",
      'selectedArray("next", ["start"]);',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const codes = report.worktree.findings.map(
      (finding) => finding.code,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(codes).toContain("SCRIPT_DIRECT_NEXT_START");
    expect(codes).toContain("SCRIPT_UNKNOWN_DYNAMIC_INVOCATION");
    expect(codes).not.toContain("SCRIPT_SCANNER_INTERNAL_ERROR");
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a713-js-safe.mjs",
        }),
      ]),
    );
  });

  it("applies A7.15 recursive computed destructuring across candidates", async () => {
    const files = secureFiles();
    files["scripts/a715-js-nested.mjs"] = [
      'const cp = require("node:child_process");',
      "const source = {",
      "  safe: { run: () => {} },",
      "  nested: { run: cp.spawn },",
      "};",
      "const key = process.env.KEY;",
      "const { [key]: { run } } = source;",
      'run("next", ["start"]);',
      "const deep = { first: { second: { third: cp.spawn } } };",
      "const k1 = process.env.K1;",
      "const k2 = process.env.K2;",
      "const { [k1]: { [k2]: { third: deepRun } } } = deep;",
      'deepRun("next", ["start"]);',
      "const { [key]: { run: aliasRun } } = source;",
      'aliasRun("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-safe.mjs"] = [
      'const cp = require("node:child_process");',
      "const source = { nested: { run: () => {} } };",
      "const key = process.env.KEY;",
      "const { [key]: { run } } = source;",
      'run("next", ["start"]);',
      "let reassigned = cp.spawn;",
      "reassigned = () => {};",
      'reassigned("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-unknown.mjs"] = [
      "const source = { nested: null };",
      "const key = process.env.KEY;",
      "const { [key]: { run } } = source;",
      'run("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-alias.mjs"] = [
      'const cp = require("node:child_process");',
      "const source = { nested: { run: cp.spawn } };",
      "const alias = source;",
      "const key = process.env.KEY;",
      "const { [key]: { run } } = alias;",
      'run("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-static-dynamic.mjs"] = [
      'const cp = require("node:child_process");',
      "const source = {",
      "  anchor: { run: cp.spawn },",
      "  dynamic: { run: cp.spawn },",
      "};",
      "const key = process.env.KEY;",
      "const { anchor: { run: anchorRun }, [key]: { run: dynamicRun } } = source;",
      'anchorRun("next", ["start"]);',
      'dynamicRun("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-undefined.mjs"] = [
      "const source = { nested: undefined };",
      "const key = process.env.KEY;",
      "const { [key]: { run } } = source;",
      'run("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-primitive.mjs"] = [
      "const source = { nested: 42 };",
      "const key = process.env.KEY;",
      "const { [key]: { run } } = source;",
      'run("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-empty.mjs"] = [
      "const source = {};",
      "const key = process.env.KEY;",
      "const { [key]: { run } } = source;",
      'run("next", ["start"]);',
    ].join("\n");
    files["scripts/a715-js-invalid.mjs"] =
      "const { [key: { run } } = source;\n";

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a715-js-nested.mjs",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a715-js-unknown.mjs",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-js-alias.mjs",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
        expect.objectContaining({
          file: "scripts/a715-js-static-dynamic.mjs",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
        expect.objectContaining({
          file: "scripts/a715-js-undefined.mjs",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-js-primitive.mjs",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-js-empty.mjs",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-js-invalid.mjs",
          code: "SCRIPT_PARSE_ERROR",
          classification: "ERROR",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a715-js-safe.mjs",
        }),
      ]),
    );
  });

  it("handles eval aliases, call/apply, and shadowed local names", async () => {
    const files = secureFiles();
    files["scripts/eval-alias.mjs"] = [
      "const execute = (0, eval);",
      'execute("require(\\\"child_process\\\").spawn(\\\"next\\\",[\\\"start\\\"])");',
    ].join("\n");
    files["scripts/call-apply.mjs"] = [
      'const cp = require("node:child_process");',
      'cp.spawn.call(cp, "next", ["start"]);',
      'cp.spawn.apply(cp, ["next", ["start"]]);',
    ].join("\n");
    files["scripts/shadowed.mjs"] = [
      "function eval(value) { return value; }",
      "function Function(value) { return value; }",
      "function spawn(command, args) { return [command, args]; }",
      "const local = 'next start';",
      "eval(local);",
      "Function(local);",
      "spawn('next', ['start']);",
    ].join("\n");
    files["scripts/safe-bind.mjs"] = [
      "const local = { execute(value) { return value; } };",
      "const bound = local.execute.bind(local);",
      "bound('next start');",
      "const safeArray = [() => 'next start'];",
      "safeArray[0]();",
      "const safeConditional = true ? (() => {}) : (() => {});",
      "safeConditional();",
      "Reflect.apply(local.execute, local, ['next start']);",
    ].join("\n");
    files["scripts/multi-level.mjs"] = [
      'import { spawn } from "node:child_process";',
      "const first = spawn;",
      "const second = first;",
      "function outer(command, args) { inner(command, args); }",
      "function inner(command, args) { second(command, args); }",
      'outer("next", ["start"]);',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const codes = report.worktree.findings.map(
      (finding) => finding.code,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(codes).toContain("SCRIPT_DIRECT_NEXT_START");
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "scripts/shadowed.mjs" }),
        expect.objectContaining({ file: "scripts/safe-bind.mjs" }),
      ]),
    );
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/multi-level.mjs",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
      ]),
    );
  });

  it("detects Shell dynamic and nested execution without display false positives", async () => {
    const files = secureFiles();
    files["scripts/shell-dynamic.sh"] = [
      'exec "$UNRESOLVED_COMMAND"',
      "bash -c 'bash -c \"next start\"'",
      "FOO=1 bash -c 'next start'",
      "eval \"$(printf 'next start')\"",
    ].join("\n");
    files["scripts/shell-display.sh"] = [
      "echo 'bash -c \"next start\"'",
      "cat <<'EOF'",
      'bash -c "next start"',
      "EOF",
      "cat <<EOF",
      "next start",
      "EOF",
      "cat <<-'TABS'",
      "\tnext start",
      "\tTABS",
      'cat <<"DQ"',
      "next start",
      "DQ",
    ].join("\n");
    files["scripts/shell-heredoc-exec.sh"] = [
      "bash <<'EOF'",
      "next start",
      "EOF",
    ].join("\n");
    files["scripts/shell-wrapper-variants.sh"] = [
      "bash -lc 'next start'",
      "timeout 10 bash -c 'next start'",
      "sudo -u app bash -c 'next start'",
      "printf x | xargs bash -c 'next start'",
      "find . -exec bash -c 'next start' \\;",
    ].join("\n");
    files["scripts/shell-data-pipe.sh"] = [
      "cat <<EOF | bash -c 'cat'",
      "next start",
      "EOF",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const dynamicFindings = report.worktree.findings.filter(
      (finding) => finding.file === "scripts/shell-dynamic.sh",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(
      dynamicFindings.map((finding) => finding.classification),
    ).toEqual(
      expect.arrayContaining(["DANGEROUS", "UNKNOWN"]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "scripts/shell-display.sh" }),
      ]),
    );
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/shell-heredoc-exec.sh",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
      ]),
    );
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/shell-wrapper-variants.sh",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/shell-data-pipe.sh",
        }),
      ]),
    );
  });

  it("detects A7.9 Shell wrappers and nested Here-doc stdin execution", async () => {
    const files = secureFiles();
    files["scripts/a79-shell-wrappers.sh"] = [
      "command -p bash -c 'next start'",
      "exec -a app bash -c 'next start'",
      "nice -n 5 bash -c 'next start'",
      "stdbuf -oL bash -c 'next start'",
      "command -p nice -n 5 stdbuf -oL bash -c 'next start'",
    ].join("\n");
    files["scripts/a79-shell-heredoc.sh"] = [
      "cat <<EOF | bash -c 'cat | sh'",
      "next start",
      "EOF",
      "cat <<EOF | bash -c 'cat | cat | bash'",
      "next start",
      "EOF",
    ].join("\n");
    files["scripts/a79-shell-safe.sh"] = [
      "cat <<EOF | bash -c 'cat'",
      "next start",
      "EOF",
      "cat <<EOF | grep bash",
      'bash -c "next start"',
      "EOF",
      "echo 'bash -c \"next start\"'",
    ].join("\n");
    files["scripts/a79-shell-unknown.sh"] = [
      "cat <<EOF | command -p exec -a app bash -c \"$UNKNOWN_SINK\"",
      "next start",
      "EOF",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const dangerous = report.worktree.findings.filter(
      (finding) =>
        [
          "scripts/a79-shell-wrappers.sh",
          "scripts/a79-shell-heredoc.sh",
        ].includes(finding.file) &&
        finding.code === "SCRIPT_DIRECT_NEXT_START",
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(dangerous).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a79-shell-wrappers.sh",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a79-shell-heredoc.sh",
          classification: "DANGEROUS",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a79-shell-safe.sh",
        }),
      ]),
    );
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a79-shell-unknown.sh",
          classification: "UNKNOWN",
        }),
      ]),
    );
  });

  it("detects A7.11 Shell wrapper and xargs stdin semantics", async () => {
    const files = secureFiles();
    files["scripts/a711-shell-danger.sh"] = [
      "env -S 'bash -c \"next start\"'",
      "env --split-string='bash -c \"next start\"'",
      "sudo --chdir /tmp bash -c 'next start'",
      "cat <<EOF | xargs -I{} bash -c '{}'",
      "next start",
      "EOF",
      "cat <<EOF | xargs -I{} env -S 'bash -c \"{}\"'",
      "next start",
      "EOF",
      "bash -c",
    ].join("\n");
    files["scripts/a711-shell-safe.sh"] = [
      "cat <<EOF | xargs -I{} printf '%s\\n' '{}'",
      "next start",
      "EOF",
      "echo 'env -S \"bash -c next start\"'",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a711-shell-danger.sh",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a711-shell-danger.sh",
          code: "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
          classification: "UNKNOWN",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a711-shell-safe.sh",
        }),
      ]),
    );
  });

  it("treats unclosed Shell Here-doc as UNKNOWN", async () => {
    const files = secureFiles();
    files["scripts/unclosed.sh"] = [
      "cat <<'EOF'",
      "next start",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCRIPT_UNKNOWN_HEREDOC",
          classification: "UNKNOWN",
        }),
      ]),
    );
  });

  it("separates PowerShell Here-string data from executed content", async () => {
    const files = secureFiles();
    files["scripts/here-string-safe.ps1"] = [
      "@'",
      "next start",
      "Invoke-Expression next start",
      "'@ | Write-Host",
      '@"',
      "next start",
      '"@ | Write-Host',
    ].join("\n");
    files["scripts/here-string-exec.ps1"] = [
      "$code = @'",
      "next start",
      "'@",
      "Invoke-Expression $code",
    ].join("\n");
    files["scripts/here-string-unclosed.ps1"] = [
      "$code = @'",
      "next start",
    ].join("\n");
    files["scripts/here-string-scriptblock.ps1"] = [
      "$code = @'",
      "next start",
      "'@",
      "& ([scriptblock]::Create($code))",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/here-string-safe.ps1",
        }),
      ]),
    );
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/here-string-exec.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
        expect.objectContaining({
          file: "scripts/here-string-unclosed.ps1",
          code: "SCRIPT_UNKNOWN_HERESTRING",
        }),
        expect.objectContaining({
          file: "scripts/here-string-scriptblock.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
      ]),
    );
  });

  it("detects A7.9 PowerShell Here-string interpolation and Get-Content aliases", async () => {
    const files = secureFiles();
    files["scripts/a79-ps-interpolation.ps1"] = [
      '@"',
      "$(next start)",
      '"@ | Write-Host',
      '@"',
      "value=$(& { next start })",
      '"@ | Write-Host',
    ].join("\n");
    files["scripts/a79-ps-gc-alias.ps1"] =
      "gc .\\release.ps1 | Invoke-Expression\n";
    files["scripts/a79-ps-other-alias.ps1"] =
      "cat .\\release.ps1 | iex\n";
    files["scripts/a79-ps-safe.ps1"] = [
      "gc .\\release.ps1 | Write-Host",
      "Get-Content .\\release.ps1 | Write-Host",
      "@'",
      "$(next start)",
      "'@ | Write-Host",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a79-ps-interpolation.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a79-ps-gc-alias.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a79-ps-other-alias.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          classification: "UNKNOWN",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a79-ps-safe.ps1",
        }),
      ]),
    );
  });

  it("detects A7.11 PowerShell static flow, ScriptBlock, alias, and encoded execution", async () => {
    const files = secureFiles();
    files["scripts/a711-ps-static.ps1"] = [
      "$cmd = 'next'",
      "$arg = 'start'",
      "& $cmd $arg",
      "$code = 'next ' + 'start'",
      "Invoke-Expression $code",
      "[scriptblock]::Create($code).Invoke()",
    ].join("\n");
    files["scripts/a711-ps-scriptblock.ps1"] =
      "& ([scriptblock]::Create((Get-Content .\\release.ps1 -Raw)))\n";
    files["scripts/a711-ps-pipeline.ps1"] = [
      "Get-Content .\\release.ps1 |",
      "  ForEach-Object { [scriptblock]::Create($_) } |",
      "  ForEach-Object { $_.Invoke() }",
    ].join("\n");
    files["scripts/a711-ps-custom-gc.ps1"] = [
      "function gc { Write-Output 'next start' }",
      "gc | iex",
    ].join("\n");
    files["scripts/a711-ps-nested-function.ps1"] = [
      "function gc {",
      "  Write-Output 'next start'",
      "  if ($true) { Write-Host 'nested' }",
      "}",
      "gc | iex",
    ].join("\n");
    files["scripts/a711-ps-alias-provider.ps1"] = [
      "Set-Item -Path Alias:gc -Value Get-Content",
      "gc .\\release.ps1 | Invoke-Expression",
    ].join("\n");
    files["scripts/a711-ps-scriptblock-variable.ps1"] = [
      "$script = [scriptblock]::Create('next start')",
      "$script.Invoke()",
    ].join("\n");
    files["scripts/a711-ps-encoded.ps1"] =
      "pwsh -EncodedCommand bmV4dCBzdGFydA==\n";
    files["scripts/a711-ps-incomplete.ps1"] =
      "function broken {\n";
    files["scripts/a711-ps-unresolved-expression.ps1"] =
      "Invoke-Expression ('next{0}' -f ' start')\n";
    files["scripts/a711-ps-safe.ps1"] = [
      "Set-Item -Path Alias:gc -Value Write-Host",
      "gc .\\release.ps1 | Invoke-Expression",
      "Write-Host 'next start'",
      "@'",
      "$(next start)",
      "'@ | Write-Host",
      "$notInvoked = [scriptblock]::Create('next start')",
      "Invoke-Expression ('Write-Host \"next start\"')",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a711-ps-static.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-scriptblock.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-pipeline.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-custom-gc.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-nested-function.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-alias-provider.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-scriptblock-variable.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-encoded.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-incomplete.ps1",
          code: "SCRIPT_POWERSHELL_SYNTAX_INCOMPLETE",
          classification: "ERROR",
        }),
        expect.objectContaining({
          file: "scripts/a711-ps-unresolved-expression.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          classification: "UNKNOWN",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a711-ps-safe.ps1",
        }),
      ]),
    );
  });

  it("propagates A7.13 ScriptBlock identity and validates encoded commands", async () => {
    const files = secureFiles();
    files["scripts/a713-ps-scriptblock-call.ps1"] = [
      "$script = [scriptblock]::Create('next start')",
      "& $script",
      "$alias = $script",
      "& $alias",
    ].join("\n");
    files["scripts/a713-ps-scriptblock-function.ps1"] = [
      "function Get-Script {",
      "  return [scriptblock]::Create('next start')",
      "}",
      "$script = Get-Script",
      "& $script",
    ].join("\n");
    files["scripts/a713-ps-scriptblock-array.ps1"] = [
      "$scripts = @([scriptblock]::Create('next start'))",
      "& $scripts[0]",
    ].join("\n");
    files["scripts/a713-ps-scriptblock-param.ps1"] = [
      "function Run-Script($script) { & $script }",
      "$script = [scriptblock]::Create('next start')",
      "Run-Script $script",
    ].join("\n");
    files["scripts/a713-ps-encoded-invalid.ps1"] = [
      "pwsh -EncodedCommand not_base64!",
      "powershell -ec bad!",
    ].join("\n");
    files["scripts/a713-ps-safe.ps1"] = [
      "$script = [scriptblock]::Create('Write-Host next start')",
      "& $script",
      "$reassigned = [scriptblock]::Create('next start')",
      "$reassigned = 'safe data'",
      "& $reassigned",
      "pwsh -EncodedCommand " +
        Buffer.from("Write-Host 'next start'", "utf8").toString("base64"),
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a713-ps-scriptblock-call.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a713-ps-scriptblock-function.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a713-ps-scriptblock-array.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a713-ps-scriptblock-param.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
        expect.objectContaining({
          file: "scripts/a713-ps-encoded-invalid.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
          classification: "UNKNOWN",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a713-ps-safe.ps1",
        }),
      ]),
    );
  });

  it("fails closed for A7.15 unknown PowerShell invocation sources", async () => {
    const files = secureFiles();
    files["scripts/a715-ps-unknown-command.ps1"] = [
      "$script = Get-RemoteScript",
      "& $script",
    ].join("\n");
    files["scripts/a715-ps-unknown-file.ps1"] = [
      "$script = Get-Content .\\release.ps1",
      "& $script",
    ].join("\n");
    files["scripts/a715-ps-unknown-input.ps1"] = [
      "$script = Read-Host 'Command'",
      "& $script",
    ].join("\n");
    files["scripts/a715-ps-unknown-return.ps1"] = [
      "function Get-Remote { return Get-Random }",
      "$script = Get-Remote",
      "& $script",
    ].join("\n");
    files["scripts/a715-ps-unknown-param.ps1"] = [
      "function Invoke-Target($target) { & $target }",
      "$script = Get-RemoteScript",
      "Invoke-Target $script",
    ].join("\n");
    files["scripts/a715-ps-unknown-array.ps1"] = [
      "$items = @(Get-RemoteScript)",
      "$script = $items[0]",
      "& $script",
    ].join("\n");
    files["scripts/a715-ps-unknown-object.ps1"] = [
      "$obj = @{ target = Get-RemoteScript }",
      "& $obj.target",
    ].join("\n");
    files["scripts/a715-ps-unknown-alias.ps1"] = [
      "$source = Get-RemoteScript",
      "$alias = $source",
      "& $alias",
    ].join("\n");
    files["scripts/a715-ps-unknown-global.ps1"] = [
      "$global:script = Get-RemoteScript",
      "& $global:script",
    ].join("\n");
    files["scripts/a715-ps-unknown-reassign.ps1"] = [
      "$script = [scriptblock]::Create('Write-Host safe')",
      "$script = Get-RemoteScript",
      "& $script",
    ].join("\n");
    files["scripts/a715-ps-nested-call.ps1"] =
      "& (& { Get-RemoteScript })\n";
    files["scripts/a715-ps-danger-reassign.ps1"] = [
      "$script = [scriptblock]::Create('Write-Host safe')",
      "$script = [scriptblock]::Create('next start')",
      "& $script",
    ].join("\n");
    files["scripts/a715-ps-safe.ps1"] = [
      "$script = [scriptblock]::Create('Write-Host next start')",
      "& $script",
      "$unknown = Get-RemoteScript",
      "$unknown = [scriptblock]::Create('Write-Host safe')",
      "& $unknown",
      "$nonCallable = 42",
      "& $nonCallable",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-command.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-file.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-input.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-return.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-param.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-array.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-object.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-alias.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-global.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-unknown-reassign.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-nested-call.ps1",
          classification: "UNKNOWN",
        }),
        expect.objectContaining({
          file: "scripts/a715-ps-danger-reassign.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
          classification: "DANGEROUS",
        }),
      ]),
    );
    expect(report.worktree.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/a715-ps-safe.ps1",
        }),
      ]),
    );
  });

  it("fails closed for PowerShell dynamic script sources", async () => {
    const files = secureFiles();
    files["scripts/dynamic-source.ps1"] =
      "Invoke-Expression (Get-Content .\\release.ps1)\n";
    files["scripts/scriptblock-create.ps1"] =
      "Invoke-Expression ([scriptblock]::Create('next start'))\n";
    files["scripts/filepath.ps1"] =
      "Invoke-Command -FilePath .\\release.ps1\n";
    files["scripts/invoke-alias.ps1"] = [
      "$runner = Get-Command Invoke-Expression",
      "& $runner 'next start'",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "scripts/dynamic-source.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
        }),
        expect.objectContaining({
          file: "scripts/scriptblock-create.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
        expect.objectContaining({
          file: "scripts/filepath.ps1",
          code: "SCRIPT_UNKNOWN_DYNAMIC_EXECUTION",
        }),
        expect.objectContaining({
          file: "scripts/invoke-alias.ps1",
          code: "SCRIPT_DIRECT_NEXT_START",
        }),
      ]),
    );
  });

  it("reports parser errors as ERROR rather than SAFE", async () => {
    const files = secureFiles();
    files["scripts/broken.mjs"] =
      "import { spawn } from ; const = ;\n";

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCRIPT_PARSE_ERROR",
          classification: "ERROR",
        }),
      ]),
    );
  });

  it("marks unsupported executable script types as UNKNOWN", async () => {
    const files = secureFiles();
    files["scripts/tool.py"] =
      "#!/usr/bin/env python3\nprint('safe-looking text')\n";

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.worktree.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCRIPT_UNKNOWN_FILE_TYPE",
          file: "scripts/tool.py",
          classification: "UNKNOWN",
        }),
      ]),
    );
  });

  it("keeps known safe child-process calls free of findings", async () => {
    const files = secureFiles();
    files["scripts/safe-process.mjs"] = [
      'import { execFile } from "node:child_process";',
      'execFile("git", ["status"]);',
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("PASS");
    expect(report.worktree.findings).toEqual([]);
  });

  it("records package scripts that target unscanned wrappers", async () => {
    const files = secureFiles();
    files["package.json"] = JSON.stringify({
      scripts: {
        build: "pnpm -r build",
        release: "powershell -File scripts/missing-release.ps1",
      },
    });

    const report = await inspectScenario(files, secureFiles());

    expect(report.worktree.status).toBe("FAIL");
    expect(report.unknowns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PACKAGE_SCRIPT_TARGET_UNSCANNED",
          file: "package.json#scripts.release",
          classification: "UNKNOWN",
        }),
      ]),
    );
  });

  it("marks script-type alias declarations and process aliases as UNKNOWN", async () => {
    const files = secureFiles();
    files["scripts/alias.sh"] = "alias release=next\n";
    files["scripts/alias.ps1"] = "Set-Alias release next\n";
    files["scripts/alias.cmd"] = "doskey release=next start\n";
    files["scripts/alias.mjs"] = [
      'import { spawn } from "node:child_process";',
      "const release = spawn;",
      "const dynamicCommand = process.env.RELEASE_COMMAND;",
      "release(dynamicCommand);",
    ].join("\n");

    const report = await inspectScenario(files, secureFiles());
    const unknownCodes = report.unknowns.map(
      (finding) => finding.code,
    );

    expect(report.worktree.status).toBe("FAIL");
    expect(
      unknownCodes.filter(
        (code) => code === "SCRIPT_UNKNOWN_COMMAND_ALIAS",
      ),
    ).toHaveLength(3);
    expect(unknownCodes).toContain(
      "SCRIPT_UNKNOWN_DYNAMIC_INVOCATION",
    );
  });
});

describe("guarded build execution", () => {
  function validWebTarget() {
    return path.join(
      root,
      "apps/web/.p13-releases/release-guarded",
    );
  }

  async function actualPreflight(
    files: Record<string, string | null>,
    targetRoot = validWebTarget(),
  ) {
    await writeFiles(files);
    return runBuildSecurityPreflight({
      application: "web",
      workspaceRoot: root,
      appDirectory: path.join(root, "apps/web"),
      targetRoot,
      newWritePaths: [
        path.join(
          root,
          "apps/web/.p13-build/release-guarded",
        ),
      ],
      readRevision: headReader(files),
      listHeadPaths: headPathList(files),
    });
  }

  it("runs the builder only after preflight and identity checks", async () => {
    const files = secureFiles();
    const events: string[] = [];

    const result = await executeGuardedBuild({
      runPreflight: async () => {
        events.push("preflight");
        return actualPreflight(files);
      },
      verifyBuildIdentity: () => {
        events.push("identity");
      },
      build: async (report) => {
        events.push("build");
        expect(report.worktree.status).toBe("PASS");
        return "built";
      },
    });

    expect(result).toBe("built");
    expect(events).toEqual([
      "preflight",
      "identity",
      "build",
    ]);
  });

  it("does not call the builder when preflight fails", async () => {
    const builder = vi.fn();

    await expect(
      executeGuardedBuild({
        runPreflight: async () => {
          throw new Error("PREFLIGHT_FAILED");
        },
        build: builder,
      }),
    ).rejects.toThrow("PREFLIGHT_FAILED");
    expect(builder).not.toHaveBeenCalled();
  });

  it("allows a complete but unsafe HEAD to retain a secure worktree build", async () => {
    const files = secureFiles();
    const headFiles = {
      ...secureFiles(),
      "apps/web/package.json": JSON.stringify({
        scripts: {
          build: "next build",
          start: "next start",
        },
      }),
      "apps/worker/package.json": JSON.stringify({
        scripts: {
          build: "tsc -p tsconfig.build.json",
          start: "node dist/index.js",
        },
      }),
    };
    await writeFiles(files);
    const builder = vi.fn(async () => "built");

    const result = await executeGuardedBuild({
      runPreflight: () =>
        runBuildSecurityPreflight({
          application: "web",
          workspaceRoot: root,
          appDirectory: path.join(root, "apps/web"),
          targetRoot: validWebTarget(),
          readRevision: headReader(headFiles),
          listHeadPaths: headPathList(headFiles),
        }),
      build: builder,
    });

    expect(result).toBe("built");
    expect(builder).toHaveBeenCalledTimes(1);
  });

  it("does not call the builder when HEAD audit is incomplete", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const builder = vi.fn();

    await expect(
      executeGuardedBuild({
        runPreflight: () =>
          runBuildSecurityPreflight({
            application: "web",
            workspaceRoot: root,
            appDirectory: path.join(root, "apps/web"),
            targetRoot: validWebTarget(),
            readRevision: headReader(files),
            listHeadPaths: async () => {
              throw new Error("HEAD_ENUMERATION_UNAVAILABLE");
            },
          }),
        build: builder,
      }),
    ).rejects.toMatchObject({
      code: "BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE",
    });
    expect(builder).not.toHaveBeenCalled();
  });

  it("does not call the builder for required HEAD completeness failures", async () => {
    const missingHead = secureFiles();
    delete missingHead["apps/web/scripts/build-secure.ts"];
    const unreadableHead = {
      ...secureFiles(),
      "apps/web/scripts/build-secure.ts": null,
    };
    const unparseableHead = {
      ...secureFiles(),
      "package.json": "{invalid-json",
    };

    for (const headFiles of [
      missingHead,
      unreadableHead,
      unparseableHead,
    ]) {
      const files = secureFiles();
      await writeFiles(files);
      const builder = vi.fn();
      await expect(
        executeGuardedBuild({
          runPreflight: () =>
            runBuildSecurityPreflight({
              application: "web",
              workspaceRoot: root,
              appDirectory: path.join(root, "apps/web"),
              targetRoot: validWebTarget(),
              readRevision: headReader(headFiles),
              listHeadPaths: headPathList(headFiles),
            }),
          build: builder,
        }),
      ).rejects.toMatchObject({
        code: "BUILD_HEAD_SECURITY_AUDIT_INCOMPLETE",
      });
      expect(builder).not.toHaveBeenCalled();
      await expect(fs.access(validWebTarget())).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
  });

  it("does not call the builder when the worktree gate fails", async () => {
    const headFiles = secureFiles();
    const files = secureFiles();
    files["apps/web/package.json"] = JSON.stringify({
      scripts: {
        build: "tsx scripts/build-secure.ts",
        start: "next start",
      },
    });
    await writeFiles(files);
    const builder = vi.fn();

    await expect(
      executeGuardedBuild({
        runPreflight: () =>
          runBuildSecurityPreflight({
            application: "web",
            workspaceRoot: root,
            appDirectory: path.join(root, "apps/web"),
            targetRoot: validWebTarget(),
            readRevision: headReader(headFiles),
            listHeadPaths: headPathList(headFiles),
          }),
        build: builder,
      }),
    ).rejects.toMatchObject({
      code: "BUILD_SOURCE_SECURITY_FAILED",
    });
    expect(builder).not.toHaveBeenCalled();
  });

  it("blocks the builder for A7.13 UNKNOWN, parser, and budget errors", async () => {
    const headFiles = secureFiles();
    const failures = [
      {
        path: "scripts/a713-unknown.sh",
        content: 'exec "$COMMAND"\n',
      },
      {
        path: "scripts/a713-parser.mjs",
        content: "const = ;\n",
      },
      {
        path: "scripts/a713-budget.mjs",
        content:
          `const cp = require("node:child_process"); ` +
          `const value = ${"[".repeat(16)}cp.spawn${"]".repeat(16)}; ` +
          `value${"[0]".repeat(16)}("next", ["start"]);\n`,
      },
    ];

    for (const failure of failures) {
      await fs.rm(root, { recursive: true, force: true });
      root = await fs.mkdtemp(
        path.join(os.tmpdir(), "p13-startup-preflight-"),
      );
      const files = secureFiles();
      files[failure.path] = failure.content;
      await writeFiles(files);
      const builder = vi.fn();

      await expect(
        executeGuardedBuild({
          runPreflight: () =>
            runBuildSecurityPreflight({
              application: "web",
              workspaceRoot: root,
              appDirectory: path.join(root, "apps/web"),
              targetRoot: path.join(
                root,
                "apps/web/.p13-releases",
                `release-${failure.path.split("/").at(-1)}`,
              ),
              readRevision: headReader(headFiles),
              listHeadPaths: headPathList(headFiles),
            }),
          build: builder,
        }),
      ).rejects.toMatchObject({
        code: "BUILD_SOURCE_SECURITY_FAILED",
      });
      expect(builder).not.toHaveBeenCalled();
    }
  });

  it("does not call the builder when manifest identity is missing or mismatched", async () => {
    const files = secureFiles();
    for (const code of [
      "MANIFEST_IDENTITY_MISSING",
      "BUILD_IDENTITY_MISMATCH",
    ]) {
      const builder = vi.fn();
      await expect(
        executeGuardedBuild({
          runPreflight: () => actualPreflight(files),
          verifyBuildIdentity: () => {
            throw new Error(code);
          },
          build: builder,
        }),
      ).rejects.toThrow(code);
      expect(builder).not.toHaveBeenCalled();
    }
  });

  it("does not call the builder when the signing key crosses a security boundary", async () => {
    const files = secureFiles();
    const embeddedKey = path.join(root, "signing-key.pem");
    await fs.writeFile(embeddedKey, "not-a-real-key");
    const builder = vi.fn();

    await expect(
      executeGuardedBuild({
        runPreflight: () => actualPreflight(files),
        verifyBuildIdentity: async () => {
          await validateSigningPrivateKeyPath({
            workspaceRoot: root,
            artifactRoot: validWebTarget(),
            privateKeyPath: embeddedKey,
          });
        },
        build: builder,
      }),
    ).rejects.toMatchObject({
      code: "PRIVATE_KEY_PATH_FORBIDDEN",
    });
    expect(builder).not.toHaveBeenCalled();
  });

  it("does not call the builder for an existing or reparse target", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const existing = validWebTarget();
    await fs.mkdir(existing, { recursive: true });
    const existingBuilder = vi.fn();

    await expect(
      executeGuardedBuild({
        runPreflight: () => actualPreflight(files, existing),
        build: existingBuilder,
      }),
    ).rejects.toMatchObject({
      code: "BUILD_TARGET_ALREADY_EXISTS",
    });
    expect(existingBuilder).not.toHaveBeenCalled();

    await fs.rm(
      path.join(root, "apps/web/.p13-releases"),
      { recursive: true, force: true },
    );
    const actualParent = path.join(root, "reparse-target");
    const linkedParent = path.join(
      root,
      "apps/web/.p13-releases",
    );
    await fs.mkdir(actualParent, { recursive: true });
    await fs.symlink(
      actualParent,
      linkedParent,
      "junction",
    );
    const reparseBuilder = vi.fn();

    await expect(
      executeGuardedBuild({
        runPreflight: () =>
          runBuildSecurityPreflight({
            application: "web",
            workspaceRoot: root,
            appDirectory: path.join(root, "apps/web"),
            targetRoot: path.join(
              linkedParent,
              "release-reparse",
            ),
            readRevision: headReader(files),
            listHeadPaths: headPathList(files),
          }),
        build: reparseBuilder,
      }),
    ).rejects.toMatchObject({
      code: "BUILD_WRITE_PATH_REPARSE_FORBIDDEN",
    });
    expect(reparseBuilder).not.toHaveBeenCalled();
  });

  it("does not continue to success or fallback after builder failure", async () => {
    const files = secureFiles();
    const afterSuccessfulBuild = vi.fn();

    await expect(
      executeGuardedBuild({
        runPreflight: () => actualPreflight(files),
        verifyBuildIdentity: vi.fn(),
        build: async () => {
          throw new Error("BUILDER_FAILED");
        },
        afterSuccessfulBuild,
      }),
    ).rejects.toThrow("BUILDER_FAILED");
    expect(afterSuccessfulBuild).not.toHaveBeenCalled();
  });
});
  it("rejects legacy, non-isolated, and existing build targets", async () => {
    const files = secureFiles();
    await writeFiles(files);
    const appDirectory = path.join(root, "apps/web");
    const readRevision = headReader(files);
    const listHeadPaths = headPathList(files);

    await expect(
      runBuildSecurityPreflight({
        application: "web",
        workspaceRoot: root,
        appDirectory,
        targetRoot: path.join(root, "apps/web/.next"),
        readRevision,
        listHeadPaths,
      }),
    ).rejects.toMatchObject({
      code: "BUILD_TARGET_IS_LEGACY_ARTIFACT",
    });
    await expect(
      runBuildSecurityPreflight({
        application: "web",
        workspaceRoot: root,
        appDirectory,
        targetRoot: path.join(root, "apps/web/out"),
        readRevision,
        listHeadPaths,
      }),
    ).rejects.toMatchObject({
      code: "WEB_BUILD_TARGET_NOT_ISOLATED",
    });

    const existing = path.join(
      root,
      "apps/web/.p13-releases/existing",
    );
    await fs.mkdir(existing, { recursive: true });
    await expect(
      runBuildSecurityPreflight({
        application: "web",
        workspaceRoot: root,
        appDirectory,
        targetRoot: existing,
        readRevision,
        listHeadPaths,
      }),
    ).rejects.toMatchObject({
      code: "BUILD_TARGET_ALREADY_EXISTS",
    });
  });

  it("rejects Worker output to legacy dist", async () => {
    const files = secureFiles();
    await writeFiles(files);

    await expect(
      runBuildSecurityPreflight({
        application: "worker",
        workspaceRoot: root,
        appDirectory: path.join(root, "apps/worker"),
        targetRoot: path.join(root, "apps/worker/dist"),
        readRevision: headReader(files),
        listHeadPaths: headPathList(files),
      }),
    ).rejects.toBeInstanceOf(ReleaseSecurityError);
  });
});
