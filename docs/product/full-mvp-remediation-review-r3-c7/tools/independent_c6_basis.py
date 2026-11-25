"""Independent C6-SNAP-01 reconstruction; does not import R3-C7 tools."""

from __future__ import annotations

import hashlib
import json
import re
import struct
import sys
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT.parent / "full-mvp-remediation-design-r3-c6"
FIXTURE = DESIGN / "C6_SNAPSHOT_VECTOR_01.json"
HEX_DOC = DESIGN / "C6_SNAPSHOT_VECTOR_01_HEX.md"


def u16(value: int) -> bytes:
    return struct.pack(">H", value)


def u32(value: int) -> bytes:
    return struct.pack(">I", value)


def u64(value: int) -> bytes:
    return struct.pack(">Q", value)


def i64(value: object) -> bytes:
    if isinstance(value, bool):
        raise ValueError("integer type")
    return struct.pack(">q", int(value))


def ascii_bytes(value: object, empty: bool = False) -> bytes:
    if not isinstance(value, str) or (not value and not empty):
        raise ValueError("ascii type")
    payload = value.encode("ascii")
    if len(payload) > 64 or any(byte < 0x20 or byte > 0x7E for byte in payload):
        raise ValueError("ascii domain")
    return payload


def source_key(components: list[list[object]]) -> bytes:
    if len(components) != 4:
        raise ValueError("source count")
    result = bytearray(b"SRC3" + u16(3) + u16(4))
    for index, (_, kind, value) in enumerate(components, 1):
        if value is None:
            if kind != "UTF8_NULLABLE":
                raise ValueError("source null")
            tag, presence, payload = 0, 0, b""
        elif kind == "ASCII":
            tag, presence, payload = 1, 1, ascii_bytes(value)
        elif kind == "UTF8_NULLABLE":
            normalized = unicodedata.normalize("NFC", str(value))
            if not normalized:
                raise ValueError("source empty")
            if any(ord(char) < 0x20 or 0x7F <= ord(char) <= 0x9F for char in normalized):
                raise ValueError("source control")
            payload = normalized.encode("utf-8")
            if len(payload) > 128:
                raise ValueError("source length")
            tag, presence = 2, 1
        else:
            raise ValueError("source kind")
        result += u16(index) + bytes((tag, presence)) + u32(len(payload)) + payload
    result += u16(0xFFFF)
    if len(result) > 362:
        raise ValueError("source key limit")
    return bytes(result)


def stable_key(record_type: int, values: list[list[object]]) -> bytes:
    result = bytearray(b"SKR2" + u16(2) + u16(3) + u16(record_type) + u16(len(values)))
    for index, [_, kind, value] in enumerate(values, 1):
        if kind == "ASCII_ID":
            tag, payload = 1, ascii_bytes(value, True)
        elif kind == "ASCII_KEY":
            tag, payload = 2, ascii_bytes(value, True)
        elif kind == "INT64":
            tag, payload = 3, i64(value)
        else:
            raise ValueError("stable component")
        result += u16(index) + bytes((tag, 1)) + u32(len(payload)) + payload
    result += u16(0xFFFF)
    if len(result) > 158:
        raise ValueError("stable key limit")
    return bytes(result)


def scalar(field: dict) -> tuple[int, int, bytes]:
    kind = field["type"]
    value = field.get("value")
    if kind == "NULL":
        return 0, 0, b""
    if kind == "BOOLEAN":
        if not isinstance(value, bool):
            raise ValueError("boolean")
        return 1, 1, bytes((1 if value else 0,))
    if kind == "INTEGER":
        return 2, 1, i64(value)
    if kind == "DECIMAL":
        if not isinstance(value, str):
            raise ValueError("decimal")
        if not re.fullmatch(r"-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?", value):
            raise ValueError("decimal grammar")
        if value.lstrip("-").replace(".", "").__len__() > 18:
            raise ValueError("decimal precision")
        return 3, 1, value.encode("ascii")
    if kind == "TEXT":
        if not isinstance(value, str) or value != unicodedata.normalize("NFC", value):
            raise ValueError("text")
        if "\x00" in value or len(value) > 4000:
            raise ValueError("text limit")
        return 4, 1, value.encode("utf-8")
    if kind == "ENUM":
        return 5, 1, ascii_bytes(value)
    if kind == "CANONICAL_ID":
        return 6, 1, ascii_bytes(value)
    if kind == "TIMESTAMP":
        return 7, 1, i64(value)
    if kind == "BYTES":
        if field.get("derive") != "SOURCE_KEY_R3":
            raise ValueError("bytes derivation")
        payload = source_key(field["sourceComponents"])
        if len(payload) > 512:
            raise ValueError("bytes limit")
        return 8, 1, payload
    raise ValueError("scalar kind")


def encode_record(fixture: dict, record: dict) -> tuple[bytes, bytes]:
    record_type = int(record["recordType"])
    definition = fixture["recordTypeDefinitions"][str(record_type)]["tuple"]
    if [item[:2] for item in record["stableKeyTuple"]] != definition:
        raise ValueError("tuple definition")
    key = stable_key(record_type, record["stableKeyTuple"])
    row_id = ascii_bytes(record["rowId"])
    fields = sorted(record["fields"], key=lambda item: int(item["tag"]))
    encoded_fields = bytearray()
    for field in fields:
        tag, presence, payload = scalar(field)
        encoded_fields += u16(int(field["tag"])) + bytes((tag, presence))
        encoded_fields += u32(len(payload)) + payload
    inner = (
        u16(record_type)
        + u16(len(row_id))
        + row_id
        + u16(len(key))
        + key
        + u16(len(fields))
        + bytes(encoded_fields)
    )
    return u32(len(inner) + 4) + inner, key


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    records = []
    for record in fixture["records"]:
        payload, key = encode_record(fixture, record)
        records.append((int(record["recordType"]), key, record["rowId"].encode("ascii"), payload))
    records.sort(key=lambda item: (item[0], item[1], item[2]))
    body = b"".join(item[3] for item in records)
    basis = (
        b"R3BASIS\0"
        + u16(6)
        + u16(1)
        + u32(28)
        + u32(len(records))
        + u64(len(body))
        + body
    )
    documented_hex = next(
        line.strip()
        for line in HEX_DOC.read_text(encoding="utf-8").splitlines()
        if len(line.strip()) > 100 and re.fullmatch(r"[0-9A-F]+", line.strip())
    )
    result = {
        "records": len(records),
        "record_types": [item[0] for item in records],
        "bytes": len(basis),
        "sha256": hashlib.sha256(basis).hexdigest().upper(),
        "hex_match": basis.hex().upper() == documented_hex,
        "expected_record_types": [0,1,1,2,2,3,3,4,4,5,5,6,7,8,9],
        "expected_bytes": 4036,
        "expected_sha256": "7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB",
    }
    result["result"] = "PASS" if (
        result["records"] == 15
        and result["record_types"] == result["expected_record_types"]
        and result["bytes"] == result["expected_bytes"]
        and result["sha256"] == result["expected_sha256"]
        and result["hex_match"]
    ) else "FAIL"
    rendered = json.dumps(result, indent=2)
    if len(sys.argv) == 2:
        Path(sys.argv[1]).write_text(f"{rendered}\n", encoding="utf-8")
    print(rendered)
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
