import json
import struct
import sys
from pathlib import Path

TUPLES = {
    "HEADER": (0, ("ASCII_ID",)),
    "PRICE": (4, ("ASCII_ID", "ASCII_ID")),
    "PARAM": (3, ("ASCII_ID", "ASCII_KEY")),
    "WARN": (8, ("ASCII_ID", "INT64")),
    "CAND": (2, ("ASCII_ID",)),
}


def encode_case(value):
    registry = 3
    if value[0] == "SNAPSHOT-R3":
        name, components = value[1], value[2:]
    elif value[0] == "SNAPSHOT-R4-SYNTHETIC":
        registry, name, components = 4, value[1], value[2:]
    else:
        name, components = value[0], value[1:]
    record_type, types = TUPLES[name]
    if len(types) != len(components):
        return None
    out = bytearray(b"SKR2")
    out += struct.pack(">HHHH", 2, registry, record_type, len(types))
    for index, (kind, item) in enumerate(zip(types, components), 1):
        if item is None:
            type_tag, presence, payload = 0, 0, b""
        elif kind in ("ASCII_ID", "ASCII_KEY"):
            type_tag = 1 if kind == "ASCII_ID" else 2
            presence = 1
            payload = item.encode("ascii")
            if len(payload) > 64:
                raise ValueError("ASCII length")
        elif kind == "INT64":
            type_tag, presence, payload = 3, 1, struct.pack(">q", item)
        else:
            raise ValueError("type")
        out += struct.pack(">HBBI", index, type_tag, presence, len(payload))
        out += payload
    out += struct.pack(">H", 0xFFFF)
    return bytes(out)


def main():
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    checks = 0
    for case in data["cases"]:
        for side in ("A", "B"):
            tuple_key, bytes_key = f"tuple{side}", f"bytes{side}"
            if tuple_key not in case or case.get(bytes_key) is None:
                continue
            actual = encode_case(case[tuple_key])
            if actual is None or actual.hex().upper() != case[bytes_key]:
                raise ValueError(f"{case['id']} {side}")
            checks += 1
    print(f"STABLE_KEY_BYTE_CHECKS={checks}")
    print("STABLE_KEY_RESULT=PASS")


if __name__ == "__main__":
    main()
