"""Authoritative R3-C7 R6 encoder used by executable design vectors."""

from __future__ import annotations

import hashlib
import json
import re
import struct
import sys
import unicodedata
from pathlib import Path


class R6Error(ValueError):
    def __init__(self, code: str, message: str | None = None) -> None:
        super().__init__(message or code)
        self.code = code


LIMITS = {
    "textScalars": 4000,
    "asciiBytes": 64,
    "genericBytes": 512,
    "sourceKeyBytes": 362,
    "sourceAuxBytes": 128,
    "stableKeyBytes": 158,
    "records": 4096,
    "fieldsPerRecord": 32,
    "fieldsPerSnapshot": 65536,
    "recordBytes": 16874,
    "bodyBytes": 16777216,
    "completeBasisBytes": 16777244,
}

TYPE_TAG = {
    "NULL": 0,
    "BOOLEAN": 1,
    "INTEGER": 2,
    "DECIMAL": 3,
    "TEXT": 4,
    "ENUM": 5,
    "CANONICAL_ID": 6,
    "TIMESTAMP": 7,
    "BYTES": 8,
}

RECORD_TUPLES = {
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

FIELD_SCHEMA = {
    0: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("CANONICAL_ID",),6:("CANONICAL_ID",),7:("ENUM",),8:("CANONICAL_ID",),9:("CANONICAL_ID",),10:("TEXT",),11:("TIMESTAMP",),12:("ENUM",),13:("ENUM",),14:("ENUM",)},
    1: {1:("TEXT",),2:("ENUM",),3:("BOOLEAN","INTEGER","DECIMAL","TEXT","ENUM","CANONICAL_ID","TIMESTAMP","BYTES","NULL"),4:("TEXT","NULL"),5:("ENUM",),6:("CANONICAL_ID",),7:("ENUM",),8:("ENUM",),9:("CANONICAL_ID",),10:("TEXT","NULL"),11:("BYTES",)},
    2: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("TEXT",),6:("CANONICAL_ID",),7:("TEXT",),8:("CANONICAL_ID","NULL"),9:("CANONICAL_ID",),10:("ENUM",),11:("ENUM",),12:("ENUM",),13:("ENUM",),14:("ENUM",)},
    3: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("TEXT",),4:("ENUM",),5:("BOOLEAN","INTEGER","DECIMAL","TEXT","ENUM","CANONICAL_ID","TIMESTAMP","BYTES"),6:("TEXT","NULL"),7:("CANONICAL_ID",)},
    4: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("INTEGER",),6:("ENUM",),7:("ENUM",),8:("ENUM",),9:("ENUM",),10:("TIMESTAMP",),11:("TIMESTAMP","NULL"),12:("TIMESTAMP",)},
    5: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("TEXT",),4:("ENUM",),5:("TIMESTAMP",)},
    6: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("CANONICAL_ID",),4:("CANONICAL_ID",),5:("ENUM",),6:("TIMESTAMP",)},
    7: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("INTEGER",),4:("CANONICAL_ID",),5:("ENUM",),6:("TEXT",),7:("TIMESTAMP",)},
    8: {1:("CANONICAL_ID",),2:("CANONICAL_ID",),3:("INTEGER",),4:("ENUM",),5:("ENUM",),6:("TEXT",)},
    9: {1:("CANONICAL_ID",),2:("TEXT",),3:("ENUM",),4:("ENUM",)},
}

DECIMAL_RE = re.compile(r"^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$")


def u16(value: int) -> bytes:
    return struct.pack(">H", value)


def u32(value: int) -> bytes:
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 0xFFFFFFFF:
        raise R6Error("U32_RANGE")
    return struct.pack(">I", value)


def u64(value: int) -> bytes:
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 0xFFFFFFFFFFFFFFFF:
        raise R6Error("U64_RANGE")
    return struct.pack(">Q", value)


def i64(value: object) -> bytes:
    if isinstance(value, bool):
        raise R6Error("INTEGER_TYPE")
    try:
        number = int(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise R6Error("INTEGER_TYPE") from exc
    if isinstance(value, float) and not value.is_integer():
        raise R6Error("INTEGER_TYPE")
    if not -(2**63) <= number < 2**63:
        raise R6Error("INTEGER_RANGE")
    return struct.pack(">q", number)


def ascii_bytes(value: object, empty: bool = False) -> bytes:
    if not isinstance(value, str) or (not value and not empty):
        raise R6Error("ASCII_TYPE")
    try:
        payload = value.encode("ascii")
    except UnicodeEncodeError as exc:
        raise R6Error("ASCII_DOMAIN") from exc
    if any(byte < 0x20 or byte > 0x7E for byte in payload):
        raise R6Error("ASCII_DOMAIN")
    if len(payload) > LIMITS["asciiBytes"]:
        raise R6Error("ASCII_LENGTH")
    return payload


def _validate_unicode_text(value: str, code_type: str) -> str:
    try:
        value.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise R6Error(f"{code_type}_UTF8_INVALID") from exc
    return unicodedata.normalize("NFC", value)


def validate_source_aux(value: object) -> bytes:
    if not isinstance(value, str):
        raise R6Error("SOURCE_UTF8_INVALID")
    normalized = _validate_unicode_text(value, "SOURCE")
    if not normalized:
        raise R6Error("SOURCE_AUX_EMPTY")
    if any(ord(character) < 0x20 or 0x7F <= ord(character) <= 0x9F for character in normalized):
        raise R6Error("SOURCE_AUX_CONTROL")
    payload = normalized.encode("utf-8")
    if len(payload) > LIMITS["sourceAuxBytes"]:
        raise R6Error("SOURCE_AUX_LENGTH")
    return payload


def source_key(components: object) -> bytes:
    if not isinstance(components, list) or len(components) != 4:
        raise R6Error("SOURCE_COMPONENT_COUNT")
    parts = [b"SRC3", u16(3), u16(4)]
    for index, component in enumerate(components, 1):
        if not isinstance(component, list) or len(component) != 3:
            raise R6Error("SOURCE_COMPONENT_SHAPE")
        name, kind, raw = component
        if not isinstance(name, str) or not name:
            raise R6Error("SOURCE_COMPONENT_NAME")
        if raw is None:
            if kind != "UTF8_NULLABLE":
                raise R6Error("SOURCE_NULL_DOMAIN")
            type_tag, presence, payload = 0, 0, b""
        elif kind == "ASCII":
            type_tag, presence, payload = 1, 1, ascii_bytes(raw)
        elif kind == "UTF8_NULLABLE":
            payload = validate_source_aux(raw)
            type_tag, presence = 2, 1
        else:
            raise R6Error("SOURCE_COMPONENT_TYPE")
        parts.extend((u16(index), bytes((type_tag, presence)), u32(len(payload)), payload))
    parts.append(u16(0xFFFF))
    result = b"".join(parts)
    if len(result) > LIMITS["sourceKeyBytes"]:
        raise R6Error("SOURCE_KEY_LENGTH")
    return result


def encode_scalar(field: object) -> tuple[int, int, bytes]:
    if not isinstance(field, dict) or not isinstance(field.get("type"), str):
        raise R6Error("SCALAR_SHAPE")
    scalar_type = field["type"]
    value = field.get("value")
    if scalar_type == "NULL":
        return 0, 0, b""
    if scalar_type == "BOOLEAN":
        if not isinstance(value, bool):
            raise R6Error("BOOLEAN_TYPE")
        return 1, 1, bytes((1 if value else 0,))
    if scalar_type == "INTEGER":
        return 2, 1, i64(value)
    if scalar_type == "DECIMAL":
        if not isinstance(value, str) or not DECIMAL_RE.fullmatch(value):
            raise R6Error("DECIMAL_GRAMMAR")
        if re.fullmatch(r"-0(?:\.0+)?", value):
            raise R6Error("DECIMAL_NEGATIVE_ZERO")
        if "." in value and value.endswith("0"):
            raise R6Error("DECIMAL_NOT_CANONICAL")
        digits = value.lstrip("-").replace(".", "")
        if len(digits) > 18:
            raise R6Error("DECIMAL_PRECISION")
        return 3, 1, value.encode("ascii")
    if scalar_type == "TEXT":
        if not isinstance(value, str):
            raise R6Error("TEXT_TYPE")
        normalized = _validate_unicode_text(value, "TEXT")
        if value != normalized:
            raise R6Error("TEXT_NOT_NFC")
        if "\x00" in value:
            raise R6Error("TEXT_NUL")
        if len(value) > LIMITS["textScalars"]:
            raise R6Error("TEXT_LENGTH")
        return 4, 1, value.encode("utf-8")
    if scalar_type == "ENUM":
        return 5, 1, ascii_bytes(value)
    if scalar_type == "CANONICAL_ID":
        return 6, 1, ascii_bytes(value)
    if scalar_type == "TIMESTAMP":
        return 7, 1, i64(value)
    if scalar_type == "BYTES":
        if field.get("derive") == "SOURCE_KEY_R3":
            payload = source_key(field.get("sourceComponents"))
        elif isinstance(field.get("bytesHex"), str):
            try:
                payload = bytes.fromhex(field["bytesHex"])
            except ValueError as exc:
                raise R6Error("BYTES_HEX") from exc
            if re.search(r"[^0-9A-Fa-f]", field["bytesHex"]):
                raise R6Error("BYTES_HEX")
        else:
            raise R6Error("BYTES_DERIVATION")
        if not payload:
            raise R6Error("BYTES_EMPTY")
        if len(payload) > LIMITS["genericBytes"]:
            raise R6Error("BYTES_LENGTH")
        return 8, 1, payload
    raise R6Error("SCALAR_TYPE")


def stable_key(record_type: int, values: object) -> bytes:
    definitions = RECORD_TUPLES.get(record_type)
    if definitions is None or not isinstance(values, list) or len(values) != len(definitions):
        raise R6Error("STABLE_TUPLE_ARITY")
    parts = [b"SKR2", u16(2), u16(3), u16(record_type), u16(len(values))]
    for index, (item, definition) in enumerate(zip(values, definitions), 1):
        if not isinstance(item, list) or len(item) != 3:
            raise R6Error("STABLE_TUPLE_SHAPE")
        name, kind, value = item
        if (name, kind) != definition:
            raise R6Error("STABLE_TUPLE_DEFINITION")
        if kind in ("ASCII_ID", "ASCII_KEY"):
            type_tag, payload = (1 if kind == "ASCII_ID" else 2), ascii_bytes(value, True)
        elif kind == "INT64":
            type_tag, payload = 3, i64(value)
        else:
            raise R6Error("STABLE_TUPLE_TYPE")
        parts.extend((u16(index), bytes((type_tag, 1)), u32(len(payload)), payload))
    parts.append(u16(0xFFFF))
    result = b"".join(parts)
    if len(result) > LIMITS["stableKeyBytes"]:
        raise R6Error("STABLE_KEY_LENGTH")
    return result


def encode_record(fixture: dict, record: dict) -> tuple[bytes, bytes]:
    record_type = record["recordType"]
    definition = fixture["recordTypeDefinitions"].get(str(record_type), {}).get("tuple")
    if tuple(tuple(item) for item in definition or ()) != RECORD_TUPLES.get(record_type):
        raise R6Error("REGISTRY_TUPLE_MISMATCH")
    key = stable_key(record_type, record["stableKeyTuple"])
    row_id = ascii_bytes(record["rowId"])
    fields = sorted(record["fields"], key=lambda item: item["tag"])
    if len(fields) != len(FIELD_SCHEMA[record_type]):
        raise R6Error("RECORD_FIELD_INVENTORY")
    if len(fields) > LIMITS["fieldsPerRecord"]:
        raise R6Error("RECORD_FIELD_COUNT")
    if len({field["tag"] for field in fields}) != len(fields):
        raise R6Error("RECORD_FIELD_DUPLICATE")
    encoded_fields: list[bytes] = []
    for field in fields:
        if field["type"] not in FIELD_SCHEMA[record_type].get(field["tag"], ()):
            raise R6Error("RECORD_FIELD_TYPE")
        type_tag, presence, payload = encode_scalar(field)
        encoded_fields.extend((u16(field["tag"]), bytes((type_tag, presence)), u32(len(payload)), payload))
    inner = b"".join(
        (
            u16(record_type),
            u16(len(row_id)),
            row_id,
            u16(len(key)),
            key,
            u16(len(fields)),
            *encoded_fields,
        )
    )
    encoded = u32(len(inner) + 4) + inner
    if len(encoded) > LIMITS["recordBytes"]:
        raise R6Error("RECORD_BYTES")
    return encoded, key


def build_basis(fixture: dict) -> tuple[bytes, list[dict]]:
    if (
        fixture.get("registryVersion"),
        fixture.get("protocolVersion"),
        fixture.get("stableKeyEncodingVersion"),
    ) != ("SNAPSHOT-R3", "R3-BASIS-1-R6", "SK-R2"):
        raise R6Error("BASIS_VERSION")
    source_records = fixture.get("records")
    if not isinstance(source_records, list) or len(source_records) > LIMITS["records"]:
        raise R6Error("BASIS_RECORD_COUNT")
    encoded = []
    for record in source_records:
        payload, key = encode_record(fixture, record)
        encoded.append({
            "recordType": record["recordType"],
            "rowId": record["rowId"],
            "key": key,
            "bytes": payload,
        })
    total_fields = sum(len(record["fields"]) for record in source_records)
    if total_fields > LIMITS["fieldsPerSnapshot"]:
        raise R6Error("BASIS_FIELD_COUNT")
    encoded.sort(key=lambda item: (
        item["recordType"],
        item["key"],
        item["rowId"].encode("ascii"),
    ))
    body = b"".join(item["bytes"] for item in encoded)
    if len(body) > LIMITS["bodyBytes"]:
        raise R6Error("BASIS_BODY_BYTES")
    basis = (
        b"R3BASIS\0"
        + u16(6)
        + u16(1)
        + u32(28)
        + u32(len(encoded))
        + u64(len(body))
        + body
    )
    if len(basis) > LIMITS["completeBasisBytes"]:
        raise R6Error("BASIS_TOTAL_BYTES")
    metadata = [
        {
            "recordType": item["recordType"],
            "rowId": item["rowId"],
            "stableKeyHex": item["key"].hex().upper(),
            "recordLength": len(item["bytes"]),
        }
        for item in encoded
    ]
    return basis, metadata


def validate_resource_budget(inputs: dict) -> bool:
    checks = (
        ("BASIS_RECORD_COUNT", "recordCount", LIMITS["records"]),
        ("BASIS_FIELD_COUNT", "totalFields", LIMITS["fieldsPerSnapshot"]),
        ("RECORD_FIELD_COUNT", "fieldsPerRecord", LIMITS["fieldsPerRecord"]),
        ("RECORD_BYTES", "recordBytes", LIMITS["recordBytes"]),
        ("FIELD_BYTES", "fieldBytes", 520),
        ("BASIS_BODY_BYTES", "bodyBytes", LIMITS["bodyBytes"]),
        ("BASIS_TOTAL_BYTES", "basisBytes", LIMITS["completeBasisBytes"]),
    )
    for code, key, maximum in checks:
        actual = inputs.get(key)
        if not isinstance(actual, int) or isinstance(actual, bool) or actual < 0 or actual > maximum:
            raise R6Error(code, f"{code}: {actual} > {maximum}")
    return True


def result_from_fixture(path: str | Path) -> dict:
    fixture = json.loads(Path(path).read_text(encoding="utf-8"))
    basis, records = build_basis(fixture)
    return {
        "length": len(basis),
        "sha256": hashlib.sha256(basis).hexdigest().upper(),
        "records": records,
        "basisHex": basis.hex().upper(),
    }


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 2 or args[0] != "basis":
        raise R6Error("CLI_USAGE", "usage: r6_encoder_r3_c7.py basis <fixture.json>")
    print(json.dumps(result_from_fixture(args[1]), separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
