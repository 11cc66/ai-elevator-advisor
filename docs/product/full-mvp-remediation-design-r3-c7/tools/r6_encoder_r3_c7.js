"use strict";

const crypto = require("crypto");

class R6Error extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "R6Error";
    this.code = code;
  }
}

const LIMITS = Object.freeze({
  textScalars: 4000,
  asciiBytes: 64,
  genericBytes: 512,
  sourceKeyBytes: 362,
  sourceAuxBytes: 128,
  stableKeyBytes: 158,
  records: 4096,
  fieldsPerRecord: 32,
  fieldsPerSnapshot: 65536,
  recordBytes: 16874,
  bodyBytes: 16777216,
  completeBasisBytes: 16777244,
});

const TYPE_TAG = Object.freeze({
  NULL: 0,
  BOOLEAN: 1,
  INTEGER: 2,
  DECIMAL: 3,
  TEXT: 4,
  ENUM: 5,
  CANONICAL_ID: 6,
  TIMESTAMP: 7,
  BYTES: 8,
});

const RECORD_TUPLES = Object.freeze({
  0: [["snapshotId", "ASCII_ID"]],
  1: [["requirementVersionId", "ASCII_ID"], ["fieldKey", "ASCII_KEY"]],
  2: [["candidateId", "ASCII_ID"]],
  3: [["candidateId", "ASCII_ID"], ["parameterKey", "ASCII_KEY"]],
  4: [["candidateId", "ASCII_ID"], ["priceRevisionId", "ASCII_ID"]],
  5: [["sourceRevisionId", "ASCII_ID"]],
  6: [["catalogReviewId", "ASCII_ID"]],
  7: [["professionalReviewId", "ASCII_ID"], ["eventSequence", "INT64"]],
  8: [["candidateId", "ASCII_ID"], ["warningSequence", "INT64"]],
  9: [["candidateId", "ASCII_ID"], ["fieldKey", "ASCII_KEY"]],
});

const FIELD_SCHEMA = Object.freeze({
  0: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["CANONICAL_ID"],4:["CANONICAL_ID"],5:["CANONICAL_ID"],6:["CANONICAL_ID"],7:["ENUM"],8:["CANONICAL_ID"],9:["CANONICAL_ID"],10:["TEXT"],11:["TIMESTAMP"],12:["ENUM"],13:["ENUM"],14:["ENUM"]},
  1: {1:["TEXT"],2:["ENUM"],3:["BOOLEAN","INTEGER","DECIMAL","TEXT","ENUM","CANONICAL_ID","TIMESTAMP","BYTES","NULL"],4:["TEXT","NULL"],5:["ENUM"],6:["CANONICAL_ID"],7:["ENUM"],8:["ENUM"],9:["CANONICAL_ID"],10:["TEXT","NULL"],11:["BYTES"]},
  2: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["CANONICAL_ID"],4:["CANONICAL_ID"],5:["TEXT"],6:["CANONICAL_ID"],7:["TEXT"],8:["CANONICAL_ID","NULL"],9:["CANONICAL_ID"],10:["ENUM"],11:["ENUM"],12:["ENUM"],13:["ENUM"],14:["ENUM"]},
  3: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["TEXT"],4:["ENUM"],5:["BOOLEAN","INTEGER","DECIMAL","TEXT","ENUM","CANONICAL_ID","TIMESTAMP","BYTES"],6:["TEXT","NULL"],7:["CANONICAL_ID"]},
  4: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["CANONICAL_ID"],4:["CANONICAL_ID"],5:["INTEGER"],6:["ENUM"],7:["ENUM"],8:["ENUM"],9:["ENUM"],10:["TIMESTAMP"],11:["TIMESTAMP","NULL"],12:["TIMESTAMP"]},
  5: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["TEXT"],4:["ENUM"],5:["TIMESTAMP"]},
  6: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["CANONICAL_ID"],4:["CANONICAL_ID"],5:["ENUM"],6:["TIMESTAMP"]},
  7: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["INTEGER"],4:["CANONICAL_ID"],5:["ENUM"],6:["TEXT"],7:["TIMESTAMP"]},
  8: {1:["CANONICAL_ID"],2:["CANONICAL_ID"],3:["INTEGER"],4:["ENUM"],5:["ENUM"],6:["TEXT"]},
  9: {1:["CANONICAL_ID"],2:["TEXT"],3:["ENUM"],4:["ENUM"]},
});

function u16(value) {
  const out = Buffer.alloc(2);
  out.writeUInt16BE(value);
  return out;
}

function u32(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new R6Error("U32_RANGE");
  }
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value);
  return out;
}

function u64(value) {
  const number = BigInt(value);
  if (number < 0n || number > 0xffffffffffffffffn) {
    throw new R6Error("U64_RANGE");
  }
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(number);
  return out;
}

function i64(value) {
  let number;
  try {
    number = BigInt(value);
  } catch {
    throw new R6Error("INTEGER_TYPE");
  }
  if (number < -(2n ** 63n) || number > 2n ** 63n - 1n) {
    throw new R6Error("INTEGER_RANGE");
  }
  const out = Buffer.alloc(8);
  out.writeBigInt64BE(number);
  return out;
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function ascii(value, empty = false) {
  if (typeof value !== "string" || (!value && !empty)) {
    throw new R6Error("ASCII_TYPE");
  }
  if (!/^[\x20-\x7e]*$/.test(value)) {
    throw new R6Error("ASCII_DOMAIN");
  }
  const bytes = Buffer.from(value, "ascii");
  if (bytes.length > LIMITS.asciiBytes) {
    throw new R6Error("ASCII_LENGTH");
  }
  return bytes;
}

function validateSourceAux(value) {
  if (typeof value !== "string" || hasUnpairedSurrogate(value)) {
    throw new R6Error("SOURCE_UTF8_INVALID");
  }
  const normalized = value.normalize("NFC");
  if (normalized.length === 0) throw new R6Error("SOURCE_AUX_EMPTY");
  for (const character of normalized) {
    const code = character.codePointAt(0);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
      throw new R6Error("SOURCE_AUX_CONTROL");
    }
  }
  const payload = Buffer.from(normalized, "utf8");
  if (payload.length > LIMITS.sourceAuxBytes) {
    throw new R6Error("SOURCE_AUX_LENGTH");
  }
  return payload;
}

function sourceKey(components) {
  if (!Array.isArray(components) || components.length !== 4) {
    throw new R6Error("SOURCE_COMPONENT_COUNT");
  }
  const parts = [Buffer.from("SRC3"), u16(3), u16(4)];
  components.forEach((component, index) => {
    if (!Array.isArray(component) || component.length !== 3) {
      throw new R6Error("SOURCE_COMPONENT_SHAPE");
    }
    const [name, kind, raw] = component;
    if (typeof name !== "string" || name.length === 0) {
      throw new R6Error("SOURCE_COMPONENT_NAME");
    }
    let typeTag;
    let presence;
    let payload;
    if (raw === null) {
      if (kind !== "UTF8_NULLABLE") throw new R6Error("SOURCE_NULL_DOMAIN");
      typeTag = 0;
      presence = 0;
      payload = Buffer.alloc(0);
    } else if (kind === "ASCII") {
      typeTag = 1;
      presence = 1;
      payload = ascii(raw);
    } else if (kind === "UTF8_NULLABLE") {
      payload = validateSourceAux(raw);
      typeTag = 2;
      presence = 1;
    } else {
      throw new R6Error("SOURCE_COMPONENT_TYPE");
    }
    parts.push(u16(index + 1), Buffer.from([typeTag, presence]), u32(payload.length), payload);
  });
  parts.push(u16(0xffff));
  const result = Buffer.concat(parts);
  if (result.length > LIMITS.sourceKeyBytes) {
    throw new R6Error("SOURCE_KEY_LENGTH");
  }
  return result;
}

function encodeScalar(field) {
  if (!field || typeof field !== "object" || typeof field.type !== "string") {
    throw new R6Error("SCALAR_SHAPE");
  }
  const type = field.type;
  const value = field.value;
  if (type === "NULL") return [0, 0, Buffer.alloc(0)];
  if (type === "BOOLEAN") {
    if (typeof value !== "boolean") throw new R6Error("BOOLEAN_TYPE");
    return [1, 1, Buffer.from([value ? 1 : 0])];
  }
  if (type === "INTEGER") return [2, 1, i64(value)];
  if (type === "DECIMAL") {
    if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(value)) {
      throw new R6Error("DECIMAL_GRAMMAR");
    }
    if (/^-0(?:\.0+)?$/.test(value)) throw new R6Error("DECIMAL_NEGATIVE_ZERO");
    if (value.includes(".") && value.endsWith("0")) {
      throw new R6Error("DECIMAL_NOT_CANONICAL");
    }
    const digits = value.replace(/^-/, "").replace(".", "");
    if (digits.length > 18) throw new R6Error("DECIMAL_PRECISION");
    return [3, 1, Buffer.from(value, "ascii")];
  }
  if (type === "TEXT") {
    if (typeof value !== "string" || hasUnpairedSurrogate(value)) {
      throw new R6Error("TEXT_TYPE");
    }
    if (value !== value.normalize("NFC")) throw new R6Error("TEXT_NOT_NFC");
    if (value.includes("\0")) throw new R6Error("TEXT_NUL");
    if ([...value].length > LIMITS.textScalars) throw new R6Error("TEXT_LENGTH");
    return [4, 1, Buffer.from(value, "utf8")];
  }
  if (type === "ENUM") return [5, 1, ascii(value)];
  if (type === "CANONICAL_ID") return [6, 1, ascii(value)];
  if (type === "TIMESTAMP") return [7, 1, i64(value)];
  if (type === "BYTES") {
    let payload;
    if (field.derive === "SOURCE_KEY_R3") {
      payload = sourceKey(field.sourceComponents);
    } else if (typeof field.bytesHex === "string") {
      if (!/^(?:[0-9A-Fa-f]{2})*$/.test(field.bytesHex)) {
        throw new R6Error("BYTES_HEX");
      }
      payload = Buffer.from(field.bytesHex, "hex");
    } else {
      throw new R6Error("BYTES_DERIVATION");
    }
    if (payload.length < 1) throw new R6Error("BYTES_EMPTY");
    if (payload.length > LIMITS.genericBytes) throw new R6Error("BYTES_LENGTH");
    return [8, 1, payload];
  }
  throw new R6Error("SCALAR_TYPE");
}

function stableKey(recordType, values) {
  const definitions = RECORD_TUPLES[recordType];
  if (!definitions || !Array.isArray(values) || values.length !== definitions.length) {
    throw new R6Error("STABLE_TUPLE_ARITY");
  }
  const parts = [Buffer.from("SKR2"), u16(2), u16(3), u16(recordType), u16(values.length)];
  values.forEach((item, index) => {
    if (!Array.isArray(item) || item.length !== 3) throw new R6Error("STABLE_TUPLE_SHAPE");
    const [name, kind, value] = item;
    if (name !== definitions[index][0] || kind !== definitions[index][1]) {
      throw new R6Error("STABLE_TUPLE_DEFINITION");
    }
    let typeTag;
    let payload;
    if (kind === "ASCII_ID" || kind === "ASCII_KEY") {
      typeTag = kind === "ASCII_ID" ? 1 : 2;
      payload = ascii(value, true);
    } else if (kind === "INT64") {
      typeTag = 3;
      payload = i64(value);
    } else {
      throw new R6Error("STABLE_TUPLE_TYPE");
    }
    parts.push(u16(index + 1), Buffer.from([typeTag, 1]), u32(payload.length), payload);
  });
  parts.push(u16(0xffff));
  const result = Buffer.concat(parts);
  if (result.length > LIMITS.stableKeyBytes) throw new R6Error("STABLE_KEY_LENGTH");
  return result;
}

function encodeRecord(fixture, record) {
  const recordType = record.recordType;
  const definitions = fixture.recordTypeDefinitions[String(recordType)]?.tuple;
  if (!definitions || JSON.stringify(definitions) !== JSON.stringify(RECORD_TUPLES[recordType])) {
    throw new R6Error("REGISTRY_TUPLE_MISMATCH");
  }
  const key = stableKey(recordType, record.stableKeyTuple);
  const rowId = ascii(record.rowId);
  const fields = [...record.fields].sort((left, right) => left.tag - right.tag);
  if (fields.length > LIMITS.fieldsPerRecord) throw new R6Error("RECORD_FIELD_COUNT");
  if (fields.length !== Object.keys(FIELD_SCHEMA[recordType]).length) {
    throw new R6Error("RECORD_FIELD_INVENTORY");
  }
  if (new Set(fields.map((field) => field.tag)).size !== fields.length) {
    throw new R6Error("RECORD_FIELD_DUPLICATE");
  }
  const encodedFields = [];
  for (const field of fields) {
    if (!FIELD_SCHEMA[recordType][field.tag]?.includes(field.type)) {
      throw new R6Error("RECORD_FIELD_TYPE");
    }
    const [typeTag, presence, payload] = encodeScalar(field);
    encodedFields.push(u16(field.tag), Buffer.from([typeTag, presence]), u32(payload.length), payload);
  }
  const inner = Buffer.concat([
    u16(recordType),
    u16(rowId.length),
    rowId,
    u16(key.length),
    key,
    u16(fields.length),
    ...encodedFields,
  ]);
  const encoded = Buffer.concat([u32(inner.length + 4), inner]);
  if (encoded.length > LIMITS.recordBytes) throw new R6Error("RECORD_BYTES");
  return {encoded, key};
}

function buildBasis(fixture) {
  if (
    fixture.registryVersion !== "SNAPSHOT-R3"
    || fixture.protocolVersion !== "R3-BASIS-1-R6"
    || fixture.stableKeyEncodingVersion !== "SK-R2"
  ) {
    throw new R6Error("BASIS_VERSION");
  }
  if (!Array.isArray(fixture.records) || fixture.records.length > LIMITS.records) {
    throw new R6Error("BASIS_RECORD_COUNT");
  }
  const encoded = fixture.records.map((record) => {
    const result = encodeRecord(fixture, record);
    return {
      recordType: record.recordType,
      rowId: record.rowId,
      key: result.key,
      bytes: result.encoded,
    };
  });
  const totalFields = fixture.records.reduce((sum, record) => sum + record.fields.length, 0);
  if (totalFields > LIMITS.fieldsPerSnapshot) throw new R6Error("BASIS_FIELD_COUNT");
  encoded.sort((left, right) => (
    left.recordType - right.recordType
    || Buffer.compare(left.key, right.key)
    || Buffer.compare(Buffer.from(left.rowId), Buffer.from(right.rowId))
  ));
  const body = Buffer.concat(encoded.map((item) => item.bytes));
  if (body.length > LIMITS.bodyBytes) throw new R6Error("BASIS_BODY_BYTES");
  const basis = Buffer.concat([
    Buffer.from("R3BASIS\0"),
    u16(6),
    u16(1),
    u32(28),
    u32(encoded.length),
    u64(body.length),
    body,
  ]);
  if (basis.length > LIMITS.completeBasisBytes) throw new R6Error("BASIS_TOTAL_BYTES");
  return {
    basis,
    records: encoded.map((item) => ({
      recordType: item.recordType,
      rowId: item.rowId,
      stableKeyHex: item.key.toString("hex").toUpperCase(),
      recordLength: item.bytes.length,
    })),
  };
}

function validateResourceBudget(input) {
  const checks = [
    ["BASIS_RECORD_COUNT", input.recordCount, LIMITS.records],
    ["BASIS_FIELD_COUNT", input.totalFields, LIMITS.fieldsPerSnapshot],
    ["RECORD_FIELD_COUNT", input.fieldsPerRecord, LIMITS.fieldsPerRecord],
    ["RECORD_BYTES", input.recordBytes, LIMITS.recordBytes],
    ["FIELD_BYTES", input.fieldBytes, 520],
    ["BASIS_BODY_BYTES", input.bodyBytes, LIMITS.bodyBytes],
    ["BASIS_TOTAL_BYTES", input.basisBytes, LIMITS.completeBasisBytes],
  ];
  for (const [code, actual, maximum] of checks) {
    if (!Number.isInteger(actual) || actual < 0 || actual > maximum) {
      throw new R6Error(code, `${code}: ${actual} > ${maximum}`);
    }
  }
  return true;
}

function resultFromFixture(fixturePath) {
  const fs = require("fs");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const built = buildBasis(fixture);
  return {
    length: built.basis.length,
    sha256: crypto.createHash("sha256").update(built.basis).digest("hex").toUpperCase(),
    records: built.records,
    basisHex: built.basis.toString("hex").toUpperCase(),
  };
}

function main() {
  const [mode, fixturePath] = process.argv.slice(2);
  if (mode !== "basis" || !fixturePath) {
    throw new R6Error("CLI_USAGE", "usage: r6_encoder_r3_c7.js basis <fixture.json>");
  }
  process.stdout.write(`${JSON.stringify(resultFromFixture(fixturePath))}\n`);
}

module.exports = {
  LIMITS,
  R6Error,
  TYPE_TAG,
  encodeScalar,
  validateSourceAux,
  sourceKey,
  stableKey,
  buildBasis,
  validateResourceBudget,
  resultFromFixture,
};

if (require.main === module) main();
