"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const vectors = path.resolve(__dirname, "..", "basis_limit_vectors_r3_c7.json");
const nodeRun = spawnSync(process.execPath, [path.join(__dirname, "run_basis_limits_node.js"), vectors], {
  encoding: "utf8",
  env: process.env,
});
const pythonRun = spawnSync("python", ["-B", path.join(__dirname, "run_basis_limits_python.py"), vectors], {
  encoding: "utf8",
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
});
if (nodeRun.status !== 0 || pythonRun.status !== 0) {
  throw new Error(`limit runner failed\nNode: ${nodeRun.stderr}\nPython: ${pythonRun.stderr}`);
}
const node = JSON.parse(nodeRun.stdout);
const python = JSON.parse(pythonRun.stdout);
const mismatches = [];
for (const item of node.results) {
  const other = python.results.find((candidate) => candidate.id === item.id);
  if (!other) {
    mismatches.push({ id: item.id, problem: "missing-python-vector" });
    continue;
  }
  for (const key of ["expected", "observed", "reason", "result"]) {
    if (item[key] !== other[key]) mismatches.push({ id: item.id, field: key, node: item[key], python: other[key] });
  }
}
const output = {
  total: node.results.length,
  nodeFailed: node.failed,
  pythonFailed: python.failed,
  parityMismatches: mismatches,
  result: mismatches.length === 0 && node.failed === 0 && python.failed === 0 ? "PASS" : "FAIL",
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.result !== "PASS") process.exitCode = 1;
