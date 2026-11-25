import hashlib
import json
import struct
import sys
from pathlib import Path


FIELD_SCHEMA = {
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

EXPECTED_TYPE_COUNTS = {0: 1, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1}
TUPLE_NAMES = {
    "HEADER": (0, ("ASCII_ID",)),
    "PRICE": (4, ("ASCII_ID", "ASCII_ID")),
    "PARAM": (3, ("ASCII_ID", "ASCII_KEY")),
    "WARN": (8, ("ASCII_ID", "INT64")),
    "CAND": (2, ("ASCII_ID",)),
}


def pack_u16(value):
    return struct.pack(">H", value)


def pack_u32(value):
    return struct.pack(">I", value)


def pack_i64(value):
    return struct.pack(">q", value)


def pack_u64(value):
    return struct.pack(">Q", value)


def ascii_bytes(value, *, allow_empty=False):
    if not isinstance(value, str):
        raise ValueError("ASCII string required")
    if not value and not allow_empty:
        raise ValueError("empty ASCII rejected")
    encoded = value.encode("ascii")
    if any(byte < 0x20 or byte > 0x7E for byte in encoded):
        raise ValueError("non-printable ASCII")
    if len(encoded) > 64:
        raise ValueError("ASCII component too long")
    return encoded


def stable_key(record_type, tuple_definition, tuple_values):
    if len(tuple_definition) != len(tuple_values):
        raise ValueError("stable tuple arity mismatch")
    result = bytearray(b"SKR2")
    result += pack_u16(2)
    result += pack_u16(2)
    result += pack_u16(record_type)
    result += pack_u16(len(tuple_values))
    for index, (definition, supplied) in enumerate(
        zip(tuple_definition, tuple_values), 1
    ):
        name, component_type = definition
        supplied_name, supplied_type, value = supplied
        if (name, component_type) != (supplied_name, supplied_type):
            raise ValueError("stable tuple definition mismatch")
        if value is None:
            type_tag, presence, payload = 0, 0, b""
        elif component_type in ("ASCII_ID", "ASCII_KEY"):
            type_tag = 1 if component_type == "ASCII_ID" else 2
            presence = 1
            payload = ascii_bytes(value, allow_empty=True)
        elif component_type == "INT64":
            if not isinstance(value, int) or isinstance(value, bool):
                raise ValueError("INT64 component required")
            type_tag, presence, payload = 3, 1, pack_i64(value)
        else:
            raise ValueError("unknown stable component type")
        result += pack_u16(index)
        result += bytes([type_tag, presence])
        result += pack_u32(len(payload))
        result += payload
    result += pack_u16(0xFFFF)
    return bytes(result)


def source_key(components):
    result = bytearray(b"SRC3")
    result += pack_u16(3)
    result += pack_u16(4)
    for index, (name, component_type, value) in enumerate(components, 1):
        if value is None:
            if component_type != "UTF8_NULLABLE":
                raise ValueError("NULL source component rejected")
            type_tag, presence, payload = 0, 0, b""
        elif component_type == "ASCII":
            type_tag, presence, payload = 1, 1, ascii_bytes(value)
        elif component_type == "UTF8_NULLABLE":
            normalized = __import__("unicodedata").normalize("NFC", value)
            payload = normalized.encode("utf-8")
            if len(payload) > 128:
                raise ValueError("source auxiliary too long")
            type_tag, presence = 2, 1
        else:
            raise ValueError("unknown source component type")
        result += pack_u16(index)
        result += bytes([type_tag, presence])
        result += pack_u32(len(payload))
        result += payload
    result += pack_u16(0xFFFF)
    return bytes(result)


def encode_value(field):
    value_type = field["type"]
    if value_type == "NULL":
        return 0, 0, b""
    if value_type == "BOOLEAN":
        return 1, 1, bytes([1 if field["value"] else 0])
    if value_type == "INTEGER":
        return 2, 1, pack_i64(field["value"])
    if value_type == "DECIMAL":
        return 3, 1, field["value"].encode("ascii")
    if value_type == "TEXT":
        normalized = __import__("unicodedata").normalize("NFC", field["value"])
        if normalized != field["value"]:
            raise ValueError("non-NFC text")
        return 4, 1, field["value"].encode("utf-8")
    if value_type == "ENUM":
        return 5, 1, ascii_bytes(field["value"])
    if value_type == "CANONICAL_ID":
        return 6, 1, ascii_bytes(field["value"])
    if value_type == "TIMESTAMP":
        return 7, 1, pack_i64(field["value"])
    if value_type == "BYTES":
        if field.get("derive") != "SOURCE_KEY_R3":
            raise ValueError("unknown BYTES field")
        return 8, 1, source_key(field["sourceComponents"])
    raise ValueError(f"unknown field type {value_type}")


def encode_record(fixture, record):
    record_type = record["recordType"]
    definition = fixture["recordTypeDefinitions"][str(record_type)]
    expected_names = {
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
    }[record_type]
    actual_names = tuple(tuple(item) for item in definition["tuple"])
    if actual_names != expected_names:
        raise ValueError("registry tuple schema mismatch")
    key = stable_key(record_type, expected_names, record["stableKeyTuple"])
    row_id = ascii_bytes(record["rowId"])
    fields = sorted(record["fields"], key=lambda item: item["tag"])
    if len({field["tag"] for field in fields}) != len(fields):
        raise ValueError("duplicate field tag")
    if set(field["tag"] for field in fields) != set(FIELD_SCHEMA[record_type]):
        raise ValueError("record field tag set mismatch")
    field_bytes = bytearray()
    for field in fields:
        if field["type"] not in FIELD_SCHEMA[record_type][field["tag"]]:
            raise ValueError("record field type mismatch")
        type_tag, presence, payload = encode_value(field)
        field_bytes += pack_u16(field["tag"])
        field_bytes += bytes([type_tag, presence])
        field_bytes += pack_u32(len(payload))
        field_bytes += payload
    inner = pack_u16(record_type)
    inner += pack_u16(len(row_id)) + row_id
    inner += pack_u16(len(key)) + key
    inner += pack_u16(len(fields)) + bytes(field_bytes)
    return pack_u32(len(inner) + 4) + inner, key


def verify_stable_vectors(path):
    fixture = json.loads(Path(path).read_text(encoding="utf-8"))
    checks = 0
    for case in fixture["cases"]:
        for side in ("A", "B"):
            tuple_name = f"tuple{side}"
            bytes_name = f"bytes{side}"
            if tuple_name not in case or case.get(bytes_name) is None:
                continue
            supplied = case[tuple_name]
            registry = 2
            if supplied[0] == "SNAPSHOT-R2":
                record_name, values = supplied[1], supplied[2:]
            elif supplied[0] == "SNAPSHOT-R3-HYPOTHETICAL":
                registry, record_name, values = 3, supplied[1], supplied[2:]
            else:
                record_name, values = supplied[0], supplied[1:]
            record_type, types = TUPLE_NAMES[record_name]
            definition = tuple((f"c{i}", kind) for i, kind in enumerate(types, 1))
            normalized = tuple(
                (definition[i][0], kind, value)
                for i, (kind, value) in enumerate(zip(types, values))
            )
            encoded = stable_key(record_type, definition, normalized)
            encoded = encoded[:6] + pack_u16(registry) + encoded[8:]
            expected = bytes.fromhex(case[bytes_name])
            if encoded != expected:
                raise ValueError(f"{case['id']} {side}: stable key mismatch")
            checks += 1
    return checks


def main():
    c5_dir = Path(sys.argv[1])
    fixture = json.loads(
        (c5_dir / "C5_SNAPSHOT_VECTOR_01.json").read_text(encoding="utf-8")
    )
    if fixture["registryVersion"] != "SNAPSHOT-R2":
        raise ValueError("registry version mismatch")
    if fixture["protocolVersion"] != "R3-BASIS-1-R5":
        raise ValueError("protocol version mismatch")
    actual_counts = {}
    for record in fixture["records"]:
        actual_counts[record["recordType"]] = actual_counts.get(record["recordType"], 0) + 1
    if actual_counts != EXPECTED_TYPE_COUNTS:
        raise ValueError("record inventory mismatch")

    records = []
    for record in fixture["records"]:
        encoded, key = encode_record(fixture, record)
        records.append((record["recordType"], key, record["rowId"].encode("ascii"), encoded))
    records.sort(key=lambda item: (item[0], item[1], item[2]))
    body = b"".join(item[3] for item in records)
    basis = (
        b"R3BASIS\0"
        + pack_u16(5)
        + pack_u16(1)
        + pack_u32(28)
        + pack_u32(len(records))
        + pack_u64(len(body))
        + body
    )
    hex_doc = (c5_dir / "C5_SNAPSHOT_VECTOR_01_HEX.md").read_text(encoding="utf-8")
    documented_hex = next(
        line.strip()
        for line in hex_doc.splitlines()
        if len(line.strip()) > 100 and all(c in "0123456789ABCDEF" for c in line.strip())
    )
    stable_checks = verify_stable_vectors(c5_dir / "STABLE_KEY_TEST_VECTORS_R2.json")
    print(f"C5_LENGTH={len(basis)}")
    print(f"C5_SHA256={hashlib.sha256(basis).hexdigest().upper()}")
    print(f"C5_HEX_MATCH={basis.hex().upper() == documented_hex}")
    print(f"C5_RECORD_TYPES={','.join(str(item[0]) for item in records)}")
    print(f"STABLE_VECTOR_BYTE_CHECKS={stable_checks}")
    source_key_max = 4 + 2 + 2 + 4 * (2 + 1 + 1 + 4) + (64 + 64 + 64 + 128) + 2
    print(f"SOURCE_KEY_R3_MAX_BYTES={source_key_max}")
    print("SPEC_SOURCE_KEY_BASIS_MAX_BYTES=256")


if __name__ == "__main__":
    main()
