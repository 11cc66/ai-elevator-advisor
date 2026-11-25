import path from "node:path";

import { auditStorageDeletePaths } from "./scanner.js";

const workspaceRoot = process.argv[2];
if (!workspaceRoot) {
  console.error(
    "usage: tsx scripts/p13-storage-delete-audit/cli.ts <workspace-root>",
  );
  process.exitCode = 1;
} else {
  const result = await auditStorageDeletePaths({
    workspaceRoot: path.resolve(workspaceRoot),
  });
  console.log(JSON.stringify(result, null, 2));
  if (
    result.productionBlockingFindings.length > 0 ||
    result.unresolvedDynamicImports.length > 0
  ) {
    process.exitCode = 2;
  }
}
