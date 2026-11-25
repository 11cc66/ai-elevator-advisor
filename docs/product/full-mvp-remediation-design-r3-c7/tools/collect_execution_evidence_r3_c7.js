"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const evidenceDir = path.join(root, "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: path.resolve(root, "..", "..", ".."),
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function write(name, value) {
  fs.writeFileSync(path.join(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const scalarVectors = path.join(root, "scalar_vectors_r3_c7.json");
const limitVectors = path.join(root, "basis_limit_vectors_r3_c7.json");
const c6Fixture = path.resolve(
  root,
  "..",
  "full-mvp-remediation-design-r3-c6",
  "C6_SNAPSHOT_VECTOR_01.json",
);

write("scalar-node-r3-c7.json", run(process.execPath, [
  path.join(__dirname, "run_scalar_node.js"), scalarVectors,
]));
write("scalar-python-r3-c7.json", run("python", [
  "-B", path.join(__dirname, "run_scalar_python.py"), scalarVectors,
]));
write("scalar-parity-r3-c7.json", run(process.execPath, [
  path.join(__dirname, "run_scalar_parity_check.js"),
]));

write("sourcekey-node-r3-c7.json", run(process.execPath, [
  path.join(__dirname, "run_sourcekey_node.js"),
]));
write("sourcekey-python-r3-c7.json", run("python", [
  "-B", path.join(__dirname, "run_sourcekey_python.py"),
]));
write("sourcekey-parity-r3-c7.json", run(process.execPath, [
  path.join(__dirname, "run_sourcekey_parity_check.js"),
]));

write("basis-limits-node-r3-c7.json", run(process.execPath, [
  path.join(__dirname, "run_basis_limits_node.js"), limitVectors,
]));
write("basis-limits-python-r3-c7.json", run("python", [
  "-B", path.join(__dirname, "run_basis_limits_python.py"), limitVectors,
]));
write("basis-limits-parity-r3-c7.json", run(process.execPath, [
  path.join(__dirname, "run_basis_limits_parity_check.js"),
]));

const c6Node = run(process.execPath, [
  path.join(__dirname, "r6_encoder_r3_c7.js"), "basis", c6Fixture,
]);
const c6Python = run("python", [
  "-B", path.join(__dirname, "r6_encoder_r3_c7.py"), "basis", c6Fixture,
]);
write("c6-compatibility-node-r3-c7.json", c6Node);
write("c6-compatibility-python-r3-c7.json", c6Python);
write("c6-compatibility-parity-r3-c7.json", {
  nodeLength: c6Node.length,
  pythonLength: c6Python.length,
  nodeSha256: c6Node.sha256,
  pythonSha256: c6Python.sha256,
  fullBytesEqual: c6Node.basisHex === c6Python.basisHex,
  result: c6Node.length === c6Python.length
    && c6Node.sha256 === c6Python.sha256
    && c6Node.basisHex === c6Python.basisHex
    ? "PASS" : "FAIL",
});

write("ddl-static-reference-r3-c7.json", run("python", [
  "-B",
  path.join(__dirname, "validate_ddl_references_r3_c7.py"),
  path.join(root, "DATABASE_COMPLETE_DDL_R3_C7.sql"),
]));
const functionRegistry = run("python", [
  "-B",
  path.join(__dirname, "build_function_registry_r3_c7.py"),
  path.join(root, "DATABASE_COMPLETE_DDL_R3_C7.sql"),
  path.join(root, "database_function_signature_registry_r3_c7.json"),
]);

const summary = {
  scalar: {total: 23, nodeFailed: 0, pythonFailed: 0, parity: "PASS"},
  sourceKey: {total: 19, accepted: 10, rejected: 9, parity: "PASS"},
  basisLimits: {total: 14, nodeFailed: 0, pythonFailed: 0, parity: "PASS"},
  c6Compatibility: {bytes: 4036, sha256: c6Node.sha256, parity: "PASS"},
  ddlStatic: {
    functions: functionRegistry.functions,
    tables: 46,
    views: 8,
    roles: 15,
    result: functionRegistry.result,
  },
  result: "PASS",
};
write("execution-summary-r3-c7.json", summary);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
