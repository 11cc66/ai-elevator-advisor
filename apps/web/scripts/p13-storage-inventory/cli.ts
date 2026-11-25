import path from "node:path";

import { inventoryStorageRoot } from "./inventory.js";

const root = process.argv[2];
if (!root) {
  console.error("usage: tsx scripts/p13-storage-inventory/cli.ts <root>");
  process.exitCode = 1;
} else {
  const result = await inventoryStorageRoot(path.resolve(root));
  console.log(JSON.stringify(result, null, 2));
}
