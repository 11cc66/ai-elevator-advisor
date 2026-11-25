import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditBuildArtifacts } from "./scanner.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = path.resolve(
  scriptDirectory,
  "../../../..",
);
const workspaceRoot =
  process.argv[2] === undefined || process.argv[2].startsWith("--")
    ? defaultWorkspaceRoot
    : path.resolve(process.argv[2]);
const summaryOnly = process.argv.includes("--summary");

const result = await auditBuildArtifacts(workspaceRoot);
const summary = {
  workspaceRoot: result.workspaceRoot,
  artifactRootCount: result.artifactRoots.length,
  artifactRoots: result.artifactRoots,
  dangerousFindingCount: result.dangerousFindings.length,
  dangerousArtifactPaths: [
    ...new Set(
      result.dangerousFindings.map(
        (finding) => finding.relativePath,
      ),
    ),
  ],
  dangerousFindings: summaryOnly
    ? undefined
    : result.dangerousFindings,
};

console.log(JSON.stringify(summary, null, 2));

if (result.dangerousFindings.length > 0) {
  process.exitCode = 1;
}
