"use strict";

const fs = require("fs");
const { R6Error, validateResourceBudget } = require("./r6_encoder_r3_c7");

const path = process.argv[2];
if (!path) throw new Error("usage: run_basis_limits_node.js <vectors.json>");
const document = JSON.parse(fs.readFileSync(path, "utf8"));
const results = document.vectors.map((vector) => {
  let observed = "ACCEPT";
  let reason = "OK";
  try {
    validateResourceBudget(vector.input);
  } catch (error) {
    observed = "REJECT";
    reason = error instanceof R6Error ? error.code : "UNEXPECTED_ERROR";
  }
  return {
    id: vector.id,
    expected: vector.expected,
    observed,
    reason,
    result: observed === vector.expected ? "PASS" : "FAIL",
  };
});
const output = {
  runtime: "node",
  total: results.length,
  failed: results.filter((item) => item.result === "FAIL").length,
  results,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.failed) process.exitCode = 1;
