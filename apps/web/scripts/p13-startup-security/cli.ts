import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectStartupEntrySecurity } from "@elevator/build-integrity";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "../../../..");

const report = await inspectStartupEntrySecurity({
  workspaceRoot,
});

console.log(
  JSON.stringify(
    {
      event: "startup.security_audit",
      worktreeStatus: report.worktree.status,
      headStatus: report.head.status,
      headVsWorktree: report.headVsWorktree,
      differences: report.differences,
      additionalWorktreeScriptsScanned:
        report.additionalWorktreeScriptsScanned,
      additionalHeadScriptsScanned:
        report.additionalHeadScriptsScanned,
      worktreeScriptsEnumerated:
        report.worktreeScriptsEnumerated,
      headScriptsEnumerated: report.headScriptsEnumerated,
      worktreeComplete: report.worktree.complete,
      headComplete: report.head.complete,
      scriptInventory: report.scriptInventory,
      unknowns: report.unknowns,
      legacyArtifacts: report.legacyArtifacts,
      worktreeFindings: report.worktree.findings,
      headFindings: report.head.findings,
    },
    null,
    2,
  ),
);

if (report.worktree.status !== "PASS") {
  process.exitCode = 1;
}
