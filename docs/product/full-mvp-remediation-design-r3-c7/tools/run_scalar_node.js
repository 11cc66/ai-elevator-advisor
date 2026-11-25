"use strict";

const fs = require("fs");
const { R6Error, encodeScalar, validateSourceAux } = require("./r6_encoder_r3_c7");

const path = process.argv[2];
if (!path) throw new Error("usage: run_scalar_node.js <vectors.json>");
const document = JSON.parse(fs.readFileSync(path, "utf8"));
const allVectors = [...document.vectors, ...(document.additionalVectors || [])];

function materializeField(input) {
  const field = JSON.parse(JSON.stringify(input));
  if (field.repeat) {
    field.value = String(field.repeat.char).repeat(field.repeat.count);
    delete field.repeat;
  }
  if (Number.isInteger(field.bytesLength)) {
    const byte = Number.isInteger(field.bytesByte) ? field.bytesByte : 0;
    field.bytesHex = Buffer.alloc(field.bytesLength, byte).toString("hex");
    delete field.bytesLength;
    delete field.bytesByte;
  }
  return field;
}

function summarize(field) {
  if (field.repeat) return `${field.type}:repeat(${field.repeat.count})`;
  if (Number.isInteger(field.bytesLength)) return `${field.type}:bytes(${field.bytesLength})`;
  return `${field.type}:${JSON.stringify(field.value ?? null).slice(0, 80)}`;
}

const results = allVectors.map((vector) => {
  const field = materializeField(vector.field);
  let observed;
  let reason = null;
  let outputBytes = 0;
  try {
    if (field.type === "SOURCE_AUX") {
      outputBytes = validateSourceAux(field.value).length;
      observed = "ACCEPT";
      reason = "SOURCE_AUX_ACCEPT";
    } else {
      const [typeTag, presence, payload] = encodeScalar(field);
      observed = "ACCEPT";
      reason = `TAG_${typeTag}_PRESENCE_${presence}`;
      outputBytes = payload.length;
    }
  } catch (error) {
    observed = "REJECT";
    reason = error instanceof R6Error ? error.code : "UNEXPECTED_ERROR";
  }
  return {
    id: vector.id,
    inputSummary: summarize(vector.field),
    expected: vector.expected,
    observed,
    reason,
    outputBytes,
    partialBasisProduced: false,
    result: observed === vector.expected ? "PASS" : "FAIL",
  };
});

process.stdout.write(`${JSON.stringify({
  runtime: "node",
  version: process.version,
  total: results.length,
  accepted: results.filter((item) => item.observed === "ACCEPT").length,
  rejected: results.filter((item) => item.observed === "REJECT").length,
  failed: results.filter((item) => item.result === "FAIL").length,
  results,
}, null, 2)}\n`);

if (results.some((item) => item.result === "FAIL")) process.exitCode = 1;
