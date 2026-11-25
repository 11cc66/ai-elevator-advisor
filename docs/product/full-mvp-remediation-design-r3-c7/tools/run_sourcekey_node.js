"use strict";

const { R6Error, sourceKey } = require("./r6_encoder_r3_c7");

const asciiMax = "a".repeat(64);
const auxiliaryMax = "é".repeat(64);
const cases = [
  { id:"SRC-361", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII",asciiMax],["SOURCE_ENTITY_TYPE","ASCII","b".repeat(64)],["SOURCE_ENTITY_ID","ASCII","c".repeat(64)],["SOURCE_AUX","UTF8_NULLABLE","é".repeat(63)+"a"]] },
  { id:"SRC-362", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII",asciiMax],["SOURCE_ENTITY_TYPE","ASCII","b".repeat(64)],["SOURCE_ENTITY_ID","ASCII","c".repeat(64)],["SOURCE_AUX","UTF8_NULLABLE",auxiliaryMax]] },
  { id:"SRC-363", expected:"REJECT", reason:"SOURCE_AUX_LENGTH", components:[["SOURCE_KIND","ASCII",asciiMax],["SOURCE_ENTITY_TYPE","ASCII","b".repeat(64)],["SOURCE_ENTITY_ID","ASCII","c".repeat(64)],["SOURCE_AUX","UTF8_NULLABLE",auxiliaryMax+"a"]] },
  { id:"SRC-KIND-MAX", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII",asciiMax],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]] },
  { id:"SRC-KIND-MAX+1", expected:"REJECT", reason:"ASCII_LENGTH", components:[["SOURCE_KIND","ASCII",asciiMax+"a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]] },
  { id:"SRC-TYPE-MAX", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII",asciiMax],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]] },
  { id:"SRC-TYPE-MAX+1", expected:"REJECT", reason:"ASCII_LENGTH", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII",asciiMax+"a"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]] },
  { id:"SRC-ID-MAX", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII",asciiMax],["SOURCE_AUX","UTF8_NULLABLE","d"]] },
  { id:"SRC-ID-MAX+1", expected:"REJECT", reason:"ASCII_LENGTH", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII",asciiMax+"a"],["SOURCE_AUX","UTF8_NULLABLE","d"]] },
  { id:"SRC-AUX-128", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",auxiliaryMax]] },
  { id:"SRC-AUX-129", expected:"REJECT", reason:"SOURCE_AUX_LENGTH", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",auxiliaryMax+"a"]] },
  { id:"SRC-AUX-NFC", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","café"]] },
  { id:"SRC-AUX-NFD", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","cafe\u0301"]] },
  { id:"SRC-AUX-CONTROL", expected:"REJECT", reason:"SOURCE_AUX_CONTROL", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","a\u0001b"]] },
  { id:"SRC-AUX-INVALID-UTF8", expected:"REJECT", reason:"SOURCE_UTF8_INVALID", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","\ud800"]] },
  { id:"SRC-AUX-NULL", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",null]] },
  { id:"SRC-AUX-EMPTY", expected:"REJECT", reason:"SOURCE_AUX_EMPTY", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",""]] },
  { id:"SRC-MISSING", expected:"REJECT", reason:"SOURCE_COMPONENT_COUNT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"]] },
  { id:"SRC-MIN-FRAMING", expected:"ACCEPT", components:[["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]] },
];

function summary(components) {
  if (!Array.isArray(components)) return "not-array";
  return components.map((item) => {
    if (!Array.isArray(item)) return "invalid";
    const [, kind, value] = item;
    if (value === null) return `${kind}:NULL`;
    if (typeof value === "string" && /[\uD800-\uDFFF]/.test(value)) return `${kind}:INVALID_UTF8`;
    return `${kind}:${Buffer.byteLength(String(value), "utf8")}`;
  }).join(",");
}

const results = cases.map((entry) => {
  let observed = "REJECT";
  let reason = "UNEXPECTED_ERROR";
  let outputLength = 0;
  let outputHex = "";
  try {
    const output = sourceKey(entry.components);
    observed = "ACCEPT";
    reason = "OK";
    outputLength = output.length;
    outputHex = output.toString("hex").toUpperCase();
  } catch (error) {
    reason = error instanceof R6Error ? error.code : "UNEXPECTED_ERROR";
  }
  return {
    id: entry.id,
    inputSummary: summary(entry.components),
    expected: entry.expected,
    observed,
    reason,
    outputLength,
    outputHex,
    partialSourceKeyProduced: false,
    result: observed === entry.expected ? "PASS" : "FAIL",
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
