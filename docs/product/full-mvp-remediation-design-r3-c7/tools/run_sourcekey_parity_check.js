"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const nodeRun = spawnSync(process.execPath, [path.join(__dirname, "run_sourcekey_node.js")], {
  cwd: path.resolve(__dirname, "..", "..", "..", "..", ".."),
  encoding: "utf8",
  env: process.env,
});
const pythonRun = spawnSync("python", ["-B", path.join(__dirname, "run_sourcekey_python.py")], {
  cwd: path.resolve(__dirname, "..", "..", "..", "..", ".."),
  encoding: "utf8",
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});

if (nodeRun.status !== 0) throw new Error(`Node SourceKey runner failed: ${nodeRun.stderr}`);
if (pythonRun.status !== 0) throw new Error(`Python SourceKey runner failed: ${pythonRun.stderr}`);

const node = JSON.parse(nodeRun.stdout);
const python = JSON.parse(pythonRun.stdout);
const pythonById = new Map(python.results.map((item) => [item.id, item]));
const mismatches = [];
for (const item of node.results) {
  const other = pythonById.get(item.id);
  if (!other) {
    mismatches.push({ id: item.id, problem: "missing-python-vector" });
    continue;
  }
  for (const key of ["expected", "observed", "reason", "outputLength", "outputHex", "partialSourceKeyProduced", "result"]) {
    if (item[key] !== other[key]) {
      mismatches.push({ id: item.id, field: key, node: item[key], python: other[key] });
    }
  }
}

const output = {
  nodeVersion: node.version,
  pythonVersion: python.version,
  total: node.results.length,
  nodeAccepted: node.accepted,
  nodeRejected: node.rejected,
  pythonAccepted: python.accepted,
  pythonRejected: python.rejected,
  nodeFailed: node.failed,
  pythonFailed: python.failed,
  parityMismatches: mismatches,
  result: mismatches.length === 0 && node.failed === 0 && python.failed === 0 ? "PASS" : "FAIL",
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.result !== "PASS") process.exitCode = 1;
