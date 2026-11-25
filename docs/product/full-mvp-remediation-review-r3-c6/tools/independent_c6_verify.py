import hashlib
import json
import re
import struct
import sys
import unicodedata
from pathlib import Path

TYPE_TAG = {
    "NULL": 0, "BOOLEAN": 1, "INTEGER": 2, "DECIMAL": 3, "TEXT": 4,
    "ENUM": 5, "CANONICAL_ID": 6, "TIMESTAMP": 7, "BYTES": 8,
}
TUPLE = {
    0:(("snapshotId","ASCII_ID"),),
    1:(("requirementVersionId","ASCII_ID"),("fieldKey","ASCII_KEY")),
    2:(("candidateId","ASCII_ID"),),
    3:(("candidateId","ASCII_ID"),("parameterKey","ASCII_KEY")),
    4:(("candidateId","ASCII_ID"),("priceRevisionId","ASCII_ID")),
    5:(("sourceRevisionId","ASCII_ID"),),
    6:(("catalogReviewId","ASCII_ID"),),
    7:(("professionalReviewId","ASCII_ID"),("eventSequence","INT64")),
    8:(("candidateId","ASCII_ID"),("warningSequence","INT64")),
    9:(("candidateId","ASCII_ID"),("fieldKey","ASCII_KEY")),
}
EXPECTED = {0:1,1:2,2:2,3:2,4:2,5:2,6:1,7:1,8:1,9:1}


def u16(n): return struct.pack(">H", n)
def u32(n): return struct.pack(">I", n)
def u64(n): return struct.pack(">Q", n)
def i64(n):
    if isinstance(n, bool) or not isinstance(n, int) or not -(2**63) <= n < 2**63:
        raise ValueError("INTEGER")
    return struct.pack(">q", n)


def ascii_id(value, allow_empty=False):
    if not isinstance(value, str) or (not value and not allow_empty):
        raise ValueError("ASCII")
    try:
        data = value.encode("ascii")
    except UnicodeEncodeError as exc:
        raise ValueError("ASCII") from exc
    if len(data) > 64 or any(x < 0x20 or x > 0x7E for x in data):
        raise ValueError("ASCII")
    return data


def stable_key(record_type, components):
    defs = TUPLE[record_type]
    if len(defs) != len(components):
        raise ValueError("tuple arity")
    out = b"SKR2" + u16(2) + u16(3) + u16(record_type) + u16(len(defs))
    pieces = []
    for index, (definition, supplied) in enumerate(zip(defs, components), 1):
        if tuple(definition) != tuple(supplied[:2]):
            raise ValueError("tuple definition")
        kind, value = supplied[1], supplied[2]
        if value is None:
            payload = b""
            type_tag = 0
            presence = 0
        elif kind in ("ASCII_ID", "ASCII_KEY"):
            payload = ascii_id(value, allow_empty=True)
            type_tag = 1 if kind == "ASCII_ID" else 2
            presence = 1
        elif kind == "INT64":
            payload = i64(value)
            type_tag = 3
            presence = 1
        else:
            raise ValueError("tuple type")
        pieces.append(u16(index) + bytes([type_tag, presence]) + u32(len(payload)) + payload)
    result = out + b"".join(pieces) + u16(0xFFFF)
    if len(result) > 158:
        raise ValueError("stable length")
    return result


def source_key(parts):
    if len(parts) != 4:
        raise ValueError("source count")
    result = b"SRC3" + u16(3) + u16(4)
    chunks = []
    for index, (name, kind, value) in enumerate(parts, 1):
        if value is None:
            if kind != "UTF8_NULLABLE":
                raise ValueError("source NULL")
            type_tag, presence, payload = 0, 0, b""
        elif kind == "ASCII":
            type_tag, presence, payload = 1, 1, ascii_id(value)
        elif kind == "UTF8_NULLABLE":
            text = unicodedata.normalize("NFC", value)
            if not text or any(ord(ch) < 0x20 or 0x7F <= ord(ch) <= 0x9F for ch in text):
                raise ValueError("source text")
            payload = text.encode("utf-8")
            if len(payload) > 128:
                raise ValueError("source text length")
            type_tag, presence = 2, 1
        else:
            raise ValueError("source type")
        chunks.append(u16(index) + bytes([type_tag, presence]) + u32(len(payload)) + payload)
    result += b"".join(chunks) + u16(0xFFFF)
    if len(result) > 362:
        raise ValueError("source key length")
    return result


DECIMAL_RE = re.compile(r"^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$")
def encode_value(field):
    kind, value = field["type"], field.get("value")
    if kind == "NULL":
        return 0, 0, b""
    if kind == "BOOLEAN":
        if not isinstance(value, bool):
            raise ValueError("boolean")
        return 1, 1, bytes([1 if value else 0])
    if kind == "INTEGER":
        return 2, 1, i64(value)
    if kind == "DECIMAL":
        if not isinstance(value, str) or not DECIMAL_RE.fullmatch(value):
            raise ValueError("decimal")
        if re.fullmatch(r"-0(?:\.0+)?", value) or (value.endswith("0") and "." in value):
            raise ValueError("decimal canonical")
        digits = value.lstrip("-").replace(".", "")
        if len(digits) > 18:
            raise ValueError("decimal precision")
        return 3, 1, value.encode("ascii")
    if kind == "TEXT":
        if (not isinstance(value, str) or value != unicodedata.normalize("NFC", value)
                or len(value) > 4000 or "\x00" in value):
            raise ValueError("text")
        return 4, 1, value.encode("utf-8")
    if kind == "ENUM":
        return 5, 1, ascii_id(value)
    if kind == "CANONICAL_ID":
        return 6, 1, ascii_id(value)
    if kind == "TIMESTAMP":
        return 7, 1, i64(value)
    if kind == "BYTES":
        if field.get("derive") != "SOURCE_KEY_R3":
            raise ValueError("bytes")
        payload = source_key(field["sourceComponents"])
        if len(payload) > 512:
            raise ValueError("bytes length")
        return 8, 1, payload
    raise ValueError("type")


def encode_record(fixture, record):
    rt = record["recordType"]
    if tuple(tuple(x) for x in fixture["recordTypeDefinitions"][str(rt)]["tuple"]) != TUPLE[rt]:
        raise ValueError("tuple schema")
    key = stable_key(rt, record["stableKeyTuple"])
    fields = sorted(record["fields"], key=lambda item: item["tag"])
    if len(fields) != len({item["tag"] for item in fields}):
        raise ValueError("duplicate tag")
    encoded_fields = []
    for item in fields:
        type_tag, presence, payload = encode_value(item)
        encoded_fields.append(
            u16(item["tag"]) + bytes([type_tag, presence]) + u32(len(payload)) + payload
        )
    row = ascii_id(record["rowId"])
    inner = (
        u16(rt) + u16(len(row)) + row + u16(len(key)) + key
        + u16(len(fields)) + b"".join(encoded_fields)
    )
    return u32(len(inner) + 4) + inner, key


def verify_stable(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    checks = 0
    for case in data["cases"]:
        for side in ("A", "B"):
            tuple_key, bytes_key = f"tuple{side}", f"bytes{side}"
            if tuple_key not in case or case.get(bytes_key) is None:
                continue
            supplied = case[tuple_key]
            if supplied[0] == "SNAPSHOT-R3":
                name, values, registry = supplied[1], supplied[2:], 3
            elif supplied[0] == "SNAPSHOT-R4-SYNTHETIC":
                name, values, registry = supplied[1], supplied[2:], 4
            else:
                name, values, registry = supplied[0], supplied[1:], 3
            defs = {
                "PRICE":(4,(("candidateId","ASCII_ID"),("priceRevisionId","ASCII_ID"))),
                "PARAM":(3,(("candidateId","ASCII_ID"),("parameterKey","ASCII_KEY"))),
                "WARN":(8,(("candidateId","ASCII_ID"),("warningSequence","INT64"))),
                "CAND":(2,(("candidateId","ASCII_ID"),)),
            }
            rt, definitions = defs[name]
            norm = [(definitions[i][0], definitions[i][1], value)
                    for i, value in enumerate(values)]
            got = stable_key(rt, norm)
            got = got[:6] + u16(registry) + got[8:]
            if got.hex().upper() != case[bytes_key]:
                raise ValueError(f"{case['id']} {side}")
            checks += 1
    return checks


def main():
    root = Path(sys.argv[1])
    fixture = json.loads((root / "C6_SNAPSHOT_VECTOR_01.json").read_text(encoding="utf-8"))
    counts = {}
    for record in fixture["records"]:
        counts[record["recordType"]] = counts.get(record["recordType"], 0) + 1
    if counts != EXPECTED:
        raise ValueError("record inventory")
    records = []
    for record in fixture["records"]:
        encoded, key = encode_record(fixture, record)
        records.append((record["recordType"], key, record["rowId"].encode("ascii"), encoded))
    records.sort(key=lambda item: (item[0], item[1], item[2]))
    body = b"".join(item[3] for item in records)
    basis = (
        b"R3BASIS\0" + u16(6) + u16(1) + u32(28)
        + u32(len(records)) + u64(len(body)) + body
    )
    hex_doc = (root / "C6_SNAPSHOT_VECTOR_01_HEX.md").read_text(encoding="utf-8")
    documented = next(
        line.strip() for line in hex_doc.splitlines()
        if len(line.strip()) > 100 and all(ch in "0123456789ABCDEF" for ch in line.strip())
    )
    stable_checks = verify_stable(root / "STABLE_KEY_TEST_VECTORS_R3_C6.json")
    print(f"C6_BYTES={len(basis)}")
    print(f"C6_SHA256={hashlib.sha256(basis).hexdigest().upper()}")
    print(f"C6_HEX_MATCH={basis.hex().upper() == documented}")
    print(f"C6_RECORD_TYPES={','.join(str(item[0]) for item in records)}")
    print(f"STABLE_KEY_BYTE_CHECKS={stable_checks}")


if __name__ == "__main__":
    main()
