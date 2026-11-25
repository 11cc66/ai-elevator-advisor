import hashlib
import json
import struct
import sys
from pathlib import Path


REGISTRY_FIELDS = {
    0: {
        1: ("CANONICAL_ID",), 2: ("CANONICAL_ID",), 3: ("CANONICAL_ID",),
        4: ("CANONICAL_ID",), 5: ("CANONICAL_ID",), 6: ("CANONICAL_ID",),
        7: ("ENUM",), 8: ("ENUM",), 9: ("ENUM",),
    },
    1: {
        1: ("TEXT",), 2: ("ENUM",),
        3: ("BOOLEAN", "INTEGER", "DECIMAL", "TEXT", "ENUM",
            "CANONICAL_ID", "TIMESTAMP", "BYTES", "NULL"),
        4: ("TEXT", "NULL"), 5: ("ENUM",), 6: ("CANONICAL_ID",),
        7: ("ENUM",), 8: ("ENUM",), 9: ("CANONICAL_ID",),
        10: ("TEXT", "NULL"), 11: ("BYTES",),
    },
    2: {
        1: ("CANONICAL_ID",), 2: ("CANONICAL_ID",), 3: ("CANONICAL_ID",),
        4: ("CANONICAL_ID", "NULL"), 5: ("ENUM",), 6: ("ENUM",),
        7: ("ENUM",), 8: ("ENUM",), 9: ("ENUM",),
    },
    3: {
        1: ("CANONICAL_ID",), 2: ("TEXT",), 3: ("ENUM",),
        4: ("BOOLEAN", "INTEGER", "DECIMAL", "TEXT", "ENUM",
            "CANONICAL_ID", "TIMESTAMP", "BYTES"),
        5: ("TEXT", "NULL"), 6: ("CANONICAL_ID",),
    },
    4: {
        1: ("CANONICAL_ID",), 2: ("CANONICAL_ID",), 3: ("INTEGER",),
        4: ("ENUM",), 5: ("ENUM",), 6: ("ENUM",),
    },
    5: {
        1: ("CANONICAL_ID",), 2: ("CANONICAL_ID",), 3: ("TEXT",),
        4: ("ENUM",),
    },
    6: {
        1: ("CANONICAL_ID",), 2: ("CANONICAL_ID",), 3: ("CANONICAL_ID",),
        4: ("ENUM",), 5: ("TIMESTAMP",),
    },
    7: {
        1: ("CANONICAL_ID",), 2: ("CANONICAL_ID",), 3: ("CANONICAL_ID",),
        4: ("ENUM",), 5: ("TEXT",),
    },
    8: {
        1: ("CANONICAL_ID",), 2: ("INTEGER",), 3: ("ENUM",), 4: ("TEXT",),
    },
    9: {
        1: ("CANONICAL_ID",), 2: ("TEXT",), 3: ("ENUM",),
    },
}

REGISTRY_TUPLES = {
    0: (("snapshotId", "ASCII_ID"),),
    1: (("requirementVersionId", "ASCII_ID"), ("fieldKey", "ASCII_KEY")),
    2: (("candidateId", "ASCII_ID"),),
    3: (("candidateId", "ASCII_ID"), ("parameterKey", "ASCII_KEY")),
    4: (("candidateId", "ASCII_ID"), ("priceRevisionId", "ASCII_ID")),
    5: (("sourceRevisionId", "ASCII_ID"),),
    6: (("catalogReviewId", "ASCII_ID"),),
    7: (("professionalReviewId", "ASCII_ID"), ("eventSequence", "INT64")),
    8: (("candidateId", "ASCII_ID"), ("warningSequence", "INT64")),
    9: (("candidateId", "ASCII_ID"), ("fieldKey", "ASCII_KEY")),
}


def u16(number):
    return struct.pack(">H", number)


def u32(number):
    return struct.pack(">I", number)


def u64(number):
    return struct.pack(">Q", number)


def i64(number):
    return struct.pack(">q", number)


def ascii_bytes(value, label):
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label}: nonempty ASCII required")
    encoded = value.encode("ascii")
    if len(encoded) > 64:
        raise ValueError(f"{label}: exceeds 64 bytes")
    if any(byte < 0x20 or byte > 0x7E for byte in encoded):
        raise ValueError(f"{label}: control character")
    return encoded


def encode_tuple(record_type, definitions, values):
    if len(definitions) != len(values):
        raise ValueError("tuple arity mismatch")
    chunks = [b"SKR2", u16(2), u16(2), u16(record_type), u16(len(values))]
    for index, (definition, supplied) in enumerate(zip(definitions, values), 1):
        expected_name, expected_type = definition
        name, value_type, value = supplied
        if name != expected_name or value_type != expected_type:
            raise ValueError("tuple definition mismatch")
        if value_type in ("ASCII_ID", "ASCII_KEY"):
            payload = ascii_bytes(value, name)
            type_tag = 1 if value_type == "ASCII_ID" else 2
        elif value_type == "INT64":
            payload = i64(value)
            type_tag = 3
        else:
            raise ValueError(f"unsupported tuple type {value_type}")
        chunks.append(u16(index) + bytes([type_tag, 1]) + u32(len(payload)) + payload)
    chunks.append(u16(0xFFFF))
    return b"".join(chunks)


def encode_source_key(components):
    if len(components) != 4:
        raise ValueError("SOURCE_KEY_R3 requires four components")
    chunks = [b"SRC3", u16(3), u16(4)]
    for index, (name, value_type, value) in enumerate(components, 1):
        if value is None:
            if value_type != "UTF8_NULLABLE":
                raise ValueError(f"{name}: NULL not allowed")
            type_tag = 0
            presence = 0
            payload = b""
        elif value_type == "ASCII":
            type_tag = 1
            presence = 1
            payload = ascii_bytes(value, name)
        elif value_type == "UTF8_NULLABLE":
            type_tag = 2
            presence = 1
            payload = value.encode("utf-8")
            if len(payload) > 128:
                raise ValueError(f"{name}: exceeds 128 UTF-8 bytes")
        else:
            raise ValueError(f"{name}: unsupported source component type")
        chunks.append(
            u16(index) + bytes([type_tag, presence]) + u32(len(payload)) + payload
        )
    chunks.append(u16(0xFFFF))
    return b"".join(chunks)


def encode_field(field):
    value_type = field["type"]
    if value_type == "NULL":
        type_tag, presence, payload = 0, 0, b""
    elif value_type == "BOOLEAN":
        type_tag, presence = 1, 1
        payload = bytes([1 if field["value"] else 0])
    elif value_type == "INTEGER":
        type_tag, presence, payload = 2, 1, i64(field["value"])
    elif value_type == "DECIMAL":
        type_tag, presence = 3, 1
        payload = field["value"].encode("ascii")
    elif value_type == "TEXT":
        type_tag, presence = 4, 1
        value = field["value"]
        if value != __import__("unicodedata").normalize("NFC", value):
            raise ValueError(f"{field['name']}: text is not NFC")
        payload = value.encode("utf-8")
    elif value_type == "ENUM":
        type_tag, presence = 5, 1
        payload = ascii_bytes(field["value"], field["name"])
    elif value_type == "CANONICAL_ID":
        type_tag, presence = 6, 1
        payload = ascii_bytes(field["value"], field["name"])
    elif value_type == "TIMESTAMP":
        type_tag, presence, payload = 7, 1, i64(field["value"])
    elif value_type == "BYTES":
        if field.get("derive") != "SOURCE_KEY_R3":
            raise ValueError(f"{field['name']}: unsupported BYTES derivation")
        type_tag, presence = 8, 1
        payload = encode_source_key(field["sourceComponents"])
    else:
        raise ValueError(f"{field['name']}: unsupported field type {value_type}")
    return (
        u16(field["tag"])
        + bytes([type_tag, presence])
        + u32(len(payload))
        + payload
    )


def encode_record(fixture, record):
    definition = fixture["recordTypeDefinitions"].get(str(record["recordType"]))
    if definition is None:
        raise ValueError(f"unknown record type {record['recordType']}")
    expected_fields = REGISTRY_FIELDS.get(record["recordType"])
    if expected_fields is None:
        raise ValueError("record type has no Registry field schema")
    definition_tuple = tuple(tuple(component) for component in definition["tuple"])
    if definition_tuple != REGISTRY_TUPLES[record["recordType"]]:
        raise ValueError("record type tuple schema mismatch")
    stable_key = encode_tuple(
        record["recordType"], definition["tuple"], record["stableKeyTuple"]
    )
    row_id = ascii_bytes(record["rowId"], "rowId")
    fields = sorted(record["fields"], key=lambda field: field["tag"])
    tags = [field["tag"] for field in fields]
    if len(tags) != len(set(tags)):
        raise ValueError("duplicate field tag")
    if set(tags) != set(expected_fields):
        raise ValueError("record field set mismatch")
    for field in fields:
        if field["type"] not in expected_fields[field["tag"]]:
            raise ValueError(f"field tag {field['tag']} has invalid type")
    field_bytes = b"".join(encode_field(field) for field in fields)
    body = (
        u16(record["recordType"])
        + u16(len(row_id))
        + row_id
        + u16(len(stable_key))
        + stable_key
        + u16(len(fields))
        + field_bytes
    )
    return u32(len(body) + 4) + body, stable_key


def main():
    if len(sys.argv) != 2:
        raise SystemExit("fixture path required")
    fixture = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if (
        fixture.get("registryVersion") != "SNAPSHOT-R2"
        or fixture.get("protocolVersion") != "R3-BASIS-1-R5"
        or fixture.get("stableKeyEncodingVersion") != "SK-R2"
    ):
        raise ValueError("fixture version declarations do not match encoder")
    expected_counts = {0: 1, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1}
    actual_counts = {}
    for record in fixture["records"]:
        record_type = record["recordType"]
        actual_counts[record_type] = actual_counts.get(record_type, 0) + 1
    if actual_counts != expected_counts:
        raise ValueError("fixture record type inventory mismatch")
    encoded = []
    for record in fixture["records"]:
        record_bytes, stable_key = encode_record(fixture, record)
        encoded.append((record, record_bytes, stable_key))
    encoded.sort(
        key=lambda item: (
            item[0]["recordType"],
            item[2],
            item[0]["rowId"].encode("ascii"),
        )
    )
    body = b"".join(item[1] for item in encoded)
    basis = (
        b"R3BASIS\0"
        + u16(5)
        + u16(1)
        + u32(28)
        + u32(len(encoded))
        + u64(len(body))
        + body
    )
    result = {
        "implementation": "python",
        "fixtureId": fixture["fixtureId"],
        "length": len(basis),
        "sha256": hashlib.sha256(basis).hexdigest().upper(),
        "recordCount": len(encoded),
        "records": [
            {
                "recordType": record["recordType"],
                "rowId": record["rowId"],
                "stableKeyHex": stable_key.hex().upper(),
                "recordLength": len(record_bytes),
            }
            for record, record_bytes, stable_key in encoded
        ],
        "basisHex": basis.hex().upper(),
    }
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
