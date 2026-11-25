"""Independent R6 scalar, SourceKey and resource-limit checks."""

from __future__ import annotations

import json
import re
import struct
import sys
import unicodedata
from pathlib import Path


DESIGN = Path(__file__).resolve().parents[2] / "full-mvp-remediation-design-r3-c7"
SCALAR = DESIGN / "scalar_vectors_r3_c7.json"
LIMITS = DESIGN / "basis_limit_vectors_r3_c7.json"


def materialize(field: dict) -> dict:
    result = dict(field)
    repeat = result.pop("repeat", None)
    if repeat:
        result["value"] = str(repeat["char"]) * int(repeat["count"])
    length = result.pop("bytesLength", None)
    if length is not None:
        byte = int(result.pop("bytesByte", 0))
        result["bytesHex"] = (bytes((byte,)) * int(length)).hex()
    return result


def ascii_bytes(value: object, empty: bool = False) -> bytes:
    if not isinstance(value, str) or (not value and not empty):
        raise ValueError("ASCII_TYPE")
    payload = value.encode("ascii")
    if len(payload) > 64 or any(byte < 0x20 or byte > 0x7E for byte in payload):
        raise ValueError("ASCII_DOMAIN")
    return payload


def aux(value: object) -> bytes:
    if not isinstance(value, str):
        raise ValueError("SOURCE_UTF8_INVALID")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError as exc:
        raise ValueError("SOURCE_UTF8_INVALID") from exc
    value = unicodedata.normalize("NFC", value)
    if not value:
        raise ValueError("SOURCE_AUX_EMPTY")
    if any(ord(char) < 0x20 or 0x7F <= ord(char) <= 0x9F for char in value):
        raise ValueError("SOURCE_AUX_CONTROL")
    payload = value.encode("utf-8")
    if len(payload) > 128:
        raise ValueError("SOURCE_AUX_LENGTH")
    return payload


def scalar(field: dict) -> tuple[str, str]:
    try:
        kind = field["type"]
        value = field.get("value")
        if kind == "NULL":
            pass
        elif kind == "BOOLEAN":
            if not isinstance(value, bool):
                raise ValueError("BOOLEAN_TYPE")
        elif kind == "INTEGER":
            if isinstance(value, bool) or not -(2**63) <= int(value) < 2**63:
                raise ValueError("INTEGER_RANGE")
        elif kind == "DECIMAL":
            if not isinstance(value, str) or not re.fullmatch(r"-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?", value):
                raise ValueError("DECIMAL_GRAMMAR")
            if re.fullmatch(r"-0(\.0+)?", value):
                raise ValueError("DECIMAL_NEGATIVE_ZERO")
            if "." in value and value.endswith("0"):
                raise ValueError("DECIMAL_NOT_CANONICAL")
            if len(value.lstrip("-").replace(".", "")) > 18:
                raise ValueError("DECIMAL_PRECISION")
        elif kind == "TEXT":
            if not isinstance(value, str) or value != unicodedata.normalize("NFC", value):
                raise ValueError("TEXT_NOT_NFC")
            if "\x00" in value:
                raise ValueError("TEXT_NUL")
            if len(value) > 4000:
                raise ValueError("TEXT_LENGTH")
        elif kind == "ENUM":
            ascii_bytes(value)
        elif kind == "CANONICAL_ID":
            ascii_bytes(value)
        elif kind == "TIMESTAMP":
            if isinstance(value, bool) or not -(2**63) <= int(value) < 2**63:
                raise ValueError("INTEGER_RANGE")
        elif kind == "BYTES":
            payload = bytes.fromhex(field.get("bytesHex", ""))
            if not payload:
                raise ValueError("BYTES_EMPTY")
            if len(payload) > 512:
                raise ValueError("BYTES_LENGTH")
        elif kind == "SOURCE_AUX":
            aux(value)
        else:
            raise ValueError("SCALAR_TYPE")
        return "ACCEPT", "OK"
    except (ValueError, KeyError, TypeError) as exc:
        return "REJECT", str(exc)


def source_key_case(kind: str, aux_value: object = "a") -> tuple[str, int]:
    components = [
        ["SOURCE_KIND", "ASCII", kind],
        ["SOURCE_ENTITY_TYPE", "ASCII", "b"],
        ["SOURCE_ENTITY_ID", "ASCII", "c"],
        ["SOURCE_AUX", "UTF8_NULLABLE", aux_value],
    ]
    try:
        pieces = [b"SRC3", struct.pack(">H", 3), struct.pack(">H", 4)]
        for index, (_, component_kind, value) in enumerate(components, 1):
            if value is None:
                tag, presence, payload = 0, 0, b""
            elif component_kind == "ASCII":
                tag, presence, payload = 1, 1, ascii_bytes(value)
            else:
                tag, presence, payload = 2, 1, aux(value)
            pieces.extend((struct.pack(">H", index), bytes((tag, presence)), struct.pack(">I", len(payload)), payload))
        pieces.append(struct.pack(">H", 0xFFFF))
        result = b"".join(pieces)
        if len(result) > 362:
            raise ValueError("SOURCE_KEY_LENGTH")
        return "ACCEPT", len(result)
    except ValueError as exc:
        return "REJECT", len(str(exc))


def main() -> int:
    scalar_doc = json.loads(SCALAR.read_text(encoding="utf-8"))
    vectors = [*scalar_doc["vectors"], *scalar_doc.get("additionalVectors", [])]
    scalar_results = []
    for vector in vectors:
        observed, reason = scalar(materialize(vector["field"]))
        scalar_results.append({
            "id": vector["id"],
            "expected": vector["expected"],
            "observed": observed,
            "reason": reason,
            "result": "PASS" if observed == vector["expected"] else "FAIL",
        })

    limit_doc = json.loads(LIMITS.read_text(encoding="utf-8"))
    limits = [
        ("recordCount", 4096),
        ("totalFields", 65536),
        ("fieldsPerRecord", 32),
        ("recordBytes", 16874),
        ("fieldBytes", 520),
        ("bodyBytes", 16777216),
        ("basisBytes", 16777244),
    ]
    limit_results = []
    for vector in limit_doc["vectors"]:
        observed = "ACCEPT"
        for key, maximum in limits:
            if vector["input"][key] > maximum:
                observed = "REJECT"
                break
        limit_results.append({
            "id": vector["id"],
            "expected": vector["expected"],
            "observed": observed,
            "result": "PASS" if observed == vector["expected"] else "FAIL",
        })

    source_results = [
        {"id": "MAX-ASCII", "observed": source_key_case("a" * 64)},
        {"id": "MAX+1-ASCII", "observed": source_key_case("a" * 65)},
        {"id": "AUX-NFC", "observed": source_key_case("a", "café")},
        {"id": "AUX-NFD", "observed": source_key_case("a", "cafe\u0301")},
    ]
    output = {
        "scalar": {
            "total": len(scalar_results),
            "failed": sum(item["result"] == "FAIL" for item in scalar_results),
            "results": scalar_results,
        },
        "resource_limits": {
            "total": len(limit_results),
            "failed": sum(item["result"] == "FAIL" for item in limit_results),
            "results": limit_results,
        },
        "source_key": source_results,
        "result": "PASS" if (
            not any(item["result"] == "FAIL" for item in scalar_results)
            and not any(item["result"] == "FAIL" for item in limit_results)
        ) else "FAIL",
    }
    rendered = json.dumps(output, indent=2)
    if len(sys.argv) == 2:
        Path(sys.argv[1]).write_text(f"{rendered}\n", encoding="utf-8")
    print(rendered)
    return 0 if output["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
