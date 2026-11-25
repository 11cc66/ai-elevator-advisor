"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");

const fixturePath = process.argv[2];
if (!fixturePath) {
  throw new Error("fixture path required");
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (fixture.registryVersion !== "SNAPSHOT-R2"
    || fixture.protocolVersion !== "R3-BASIS-1-R5"
    || fixture.stableKeyEncodingVersion !== "SK-R2") {
  throw new Error("fixture version declarations do not match encoder");
}
const expectedTypeCounts = {0:1,1:2,2:2,3:2,4:2,5:2,6:1,7:1,8:1,9:1};
const actualTypeCounts = {};
for (const record of fixture.records) {
  actualTypeCounts[record.recordType] = (actualTypeCounts[record.recordType] || 0) + 1;
}
if (JSON.stringify(actualTypeCounts) !== JSON.stringify(expectedTypeCounts)) {
  throw new Error("fixture record type inventory mismatch");
}

const registryFields = {
  0: {
    1: ["CANONICAL_ID"], 2: ["CANONICAL_ID"], 3: ["CANONICAL_ID"],
    4: ["CANONICAL_ID"], 5: ["CANONICAL_ID"], 6: ["CANONICAL_ID"],
    7: ["ENUM"], 8: ["ENUM"], 9: ["ENUM"],
  },
  1: {
    1: ["TEXT"], 2: ["ENUM"],
    3: ["BOOLEAN", "INTEGER", "DECIMAL", "TEXT", "ENUM",
        "CANONICAL_ID", "TIMESTAMP", "BYTES", "NULL"],
    4: ["TEXT", "NULL"], 5: ["ENUM"], 6: ["CANONICAL_ID"],
    7: ["ENUM"], 8: ["ENUM"], 9: ["CANONICAL_ID"],
    10: ["TEXT", "NULL"], 11: ["BYTES"],
  },
  2: {
    1: ["CANONICAL_ID"], 2: ["CANONICAL_ID"], 3: ["CANONICAL_ID"],
    4: ["CANONICAL_ID", "NULL"], 5: ["ENUM"], 6: ["ENUM"],
    7: ["ENUM"], 8: ["ENUM"], 9: ["ENUM"],
  },
  3: {
    1: ["CANONICAL_ID"], 2: ["TEXT"], 3: ["ENUM"],
    4: ["BOOLEAN", "INTEGER", "DECIMAL", "TEXT", "ENUM",
        "CANONICAL_ID", "TIMESTAMP", "BYTES"],
    5: ["TEXT", "NULL"], 6: ["CANONICAL_ID"],
  },
  4: {
    1: ["CANONICAL_ID"], 2: ["CANONICAL_ID"], 3: ["INTEGER"],
    4: ["ENUM"], 5: ["ENUM"], 6: ["ENUM"],
  },
  5: {
    1: ["CANONICAL_ID"], 2: ["CANONICAL_ID"], 3: ["TEXT"], 4: ["ENUM"],
  },
  6: {
    1: ["CANONICAL_ID"], 2: ["CANONICAL_ID"], 3: ["CANONICAL_ID"],
    4: ["ENUM"], 5: ["TIMESTAMP"],
  },
  7: {
    1: ["CANONICAL_ID"], 2: ["CANONICAL_ID"], 3: ["CANONICAL_ID"],
    4: ["ENUM"], 5: ["TEXT"],
  },
  8: {
    1: ["CANONICAL_ID"], 2: ["INTEGER"], 3: ["ENUM"], 4: ["TEXT"],
  },
  9: {
    1: ["CANONICAL_ID"], 2: ["TEXT"], 3: ["ENUM"],
  },
};

const registryTuples = {
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
};

function be16(value) {
  const out = Buffer.alloc(2);
  out.writeUInt16BE(value);
  return out;
}

function be32(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value);
  return out;
}

function be64(value) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64BE(BigInt(value));
  return out;
}

function i64(value) {
  const out = Buffer.alloc(8);
  out.writeBigInt64BE(BigInt(value));
  return out;
}

function assertAscii(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}: nonempty ASCII required`);
  }
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      throw new Error(`${label}: non-ASCII or control character`);
    }
  }
  return Buffer.from(value, "ascii");
}

function tupleComponent(type, value, label) {
  let payload;
  let typeTag;
  if (type === "ASCII_ID" || type === "ASCII_KEY") {
    typeTag = type === "ASCII_ID" ? 1 : 2;
    payload = assertAscii(value, label);
    if (payload.length > 64) {
      throw new Error(`${label}: exceeds 64 bytes`);
    }
  } else if (type === "INT64") {
    typeTag = 3;
    if (!Number.isSafeInteger(value) && typeof value !== "bigint") {
      throw new Error(`${label}: INT64 required`);
    }
    payload = i64(value);
  } else {
    throw new Error(`${label}: unsupported tuple type ${type}`);
  }
  return Buffer.concat([
    Buffer.from([typeTag]),
    Buffer.from([1]),
    be32(payload.length),
    payload,
  ]);
}

function encodeTuple(recordType, tupleDefinition, tupleValues) {
  if (tupleDefinition.length !== tupleValues.length) {
    throw new Error(`record type ${recordType}: tuple arity mismatch`);
  }
  const components = [];
  tupleValues.forEach((entry, index) => {
    if (entry.length !== 3) {
      throw new Error(`record type ${recordType}: tuple component malformed`);
    }
    const [definitionName, definitionType] = tupleDefinition[index];
    const [name, type, value] = entry;
    if (name !== definitionName || type !== definitionType) {
      throw new Error(`record type ${recordType}: tuple definition mismatch`);
    }
    components.push(
      Buffer.concat([
        be16(index + 1),
        tupleComponent(type, value, `${recordType}.${name}`),
      ]),
    );
  });
  return Buffer.concat([
    Buffer.from("SKR2", "ascii"),
    be16(2),
    be16(2),
    be16(recordType),
    be16(tupleValues.length),
    ...components,
    be16(0xffff),
  ]);
}

function encodeSourceKey(components) {
  if (components.length !== 4) {
    throw new Error("SOURCE_KEY_R3 requires four components");
  }
  const out = [Buffer.from("SRC3", "ascii"), be16(3), be16(4)];
  components.forEach((entry, index) => {
    const [name, type, value] = entry;
    let typeTag;
    let presence;
    let payload;
    if (value === null) {
      if (type !== "UTF8_NULLABLE") {
        throw new Error(`${name}: NULL not allowed`);
      }
      typeTag = 0;
      presence = 0;
      payload = Buffer.alloc(0);
    } else if (type === "ASCII") {
      typeTag = 1;
      presence = 1;
      payload = assertAscii(value, name);
    } else if (type === "UTF8_NULLABLE") {
      typeTag = 2;
      presence = 1;
      payload = Buffer.from(value.normalize("NFC"), "utf8");
      if (payload.length > 128) {
        throw new Error(`${name}: exceeds 128 UTF-8 bytes`);
      }
    } else {
      throw new Error(`${name}: unsupported source component type`);
    }
    out.push(
      Buffer.concat([
        be16(index + 1),
        Buffer.from([typeTag, presence]),
        be32(payload.length),
        payload,
      ]),
    );
  });
  out.push(be16(0xffff));
  return Buffer.concat(out);
}

function encodeField(field) {
  let typeTag;
  let presence;
  let payload;
  if (field.type === "NULL") {
    typeTag = 0;
    presence = 0;
    payload = Buffer.alloc(0);
  } else if (field.type === "BOOLEAN") {
    typeTag = 1;
    presence = 1;
    payload = Buffer.from([field.value ? 1 : 0]);
  } else if (field.type === "INTEGER") {
    typeTag = 2;
    presence = 1;
    payload = i64(field.value);
  } else if (field.type === "DECIMAL") {
    typeTag = 3;
    presence = 1;
    payload = Buffer.from(field.value, "ascii");
  } else if (field.type === "TEXT") {
    typeTag = 4;
    presence = 1;
    if (field.value !== field.value.normalize("NFC")) {
      throw new Error(`${field.name}: text is not NFC`);
    }
    payload = Buffer.from(field.value, "utf8");
  } else if (field.type === "ENUM") {
    typeTag = 5;
    presence = 1;
    payload = assertAscii(field.value, field.name);
    if (payload.length > 64) {
      throw new Error(`${field.name}: enum exceeds 64 bytes`);
    }
  } else if (field.type === "CANONICAL_ID") {
    typeTag = 6;
    presence = 1;
    payload = assertAscii(field.value, field.name);
    if (payload.length > 64) {
      throw new Error(`${field.name}: ID exceeds 64 bytes`);
    }
  } else if (field.type === "TIMESTAMP") {
    typeTag = 7;
    presence = 1;
    payload = i64(field.value);
  } else if (field.type === "BYTES") {
    typeTag = 8;
    presence = 1;
    if (field.derive === "SOURCE_KEY_R3") {
      payload = encodeSourceKey(field.sourceComponents);
    } else {
      throw new Error(`${field.name}: unsupported BYTES derivation`);
    }
  } else {
    throw new Error(`${field.name}: unsupported field type ${field.type}`);
  }
  return Buffer.concat([
    be16(field.tag),
    Buffer.from([typeTag, presence]),
    be32(payload.length),
    payload,
  ]);
}

function encodeRecord(record) {
  const definition = fixture.recordTypeDefinitions[String(record.recordType)];
  if (!definition) {
    throw new Error(`unknown record type ${record.recordType}`);
  }
  const expectedFields = registryFields[record.recordType];
  if (!expectedFields) {
    throw new Error(`record type ${record.recordType}: no registry field schema`);
  }
  if (JSON.stringify(definition.tuple) !== JSON.stringify(registryTuples[record.recordType])) {
    throw new Error(`record type ${record.recordType}: tuple schema mismatch`);
  }
  const stableKey = encodeTuple(
    record.recordType,
    definition.tuple,
    record.stableKeyTuple,
  );
  const rowId = assertAscii(record.rowId, "rowId");
  const tags = new Set();
  const fields = [...record.fields].sort((left, right) => left.tag - right.tag);
  for (const field of fields) {
    if (tags.has(field.tag)) {
      throw new Error(`duplicate field tag ${field.tag}`);
    }
    tags.add(field.tag);
    const allowedTypes = expectedFields[field.tag];
    if (!allowedTypes || !allowedTypes.includes(field.type)) {
      throw new Error(
        `record type ${record.recordType}: unknown/mistyped field tag ${field.tag}`,
      );
    }
  }
  const expectedTags = Object.keys(expectedFields).map(Number);
  if (
    expectedTags.length !== fields.length
    || expectedTags.some((tag) => !tags.has(tag))
  ) {
    throw new Error(`record type ${record.recordType}: field set mismatch`);
  }
  const fieldBytes = fields.map(encodeField);
  const body = Buffer.concat([
    be16(record.recordType),
    be16(rowId.length),
    rowId,
    be16(stableKey.length),
    stableKey,
    be16(fields.length),
    ...fieldBytes,
  ]);
  return {
    bytes: Buffer.concat([be32(body.length + 4), body]),
    stableKey,
  };
}

const encoded = fixture.records
  .map((record) => {
    const result = encodeRecord(record);
    return {
      record,
      bytes: result.bytes,
      stableKey: result.stableKey,
    };
  })
  .sort((left, right) => {
    if (left.record.recordType !== right.record.recordType) {
      return left.record.recordType - right.record.recordType;
    }
    const keyOrder = Buffer.compare(left.stableKey, right.stableKey);
    if (keyOrder !== 0) {
      return keyOrder;
    }
    return Buffer.compare(
      Buffer.from(left.record.rowId, "ascii"),
      Buffer.from(right.record.rowId, "ascii"),
    );
  });

const body = Buffer.concat(encoded.map((entry) => entry.bytes));
const basis = Buffer.concat([
  Buffer.from("R3BASIS\0", "ascii"),
  be16(5),
  be16(1),
  be32(28),
  be32(encoded.length),
  be64(body.length),
  body,
]);

const result = {
  implementation: "node",
  fixtureId: fixture.fixtureId,
  length: basis.length,
  sha256: crypto.createHash("sha256").update(basis).digest("hex").toUpperCase(),
  recordCount: encoded.length,
  records: encoded.map((entry) => ({
    recordType: entry.record.recordType,
    rowId: entry.record.rowId,
    stableKeyHex: entry.stableKey.toString("hex").toUpperCase(),
    recordLength: entry.bytes.length,
  })),
  basisHex: basis.toString("hex").toUpperCase(),
};

process.stdout.write(`${JSON.stringify(result)}\n`);
