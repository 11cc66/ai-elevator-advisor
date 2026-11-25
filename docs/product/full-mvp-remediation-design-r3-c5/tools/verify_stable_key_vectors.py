import json
import struct
from pathlib import Path
import sys


DEFINITIONS = {
    "HEADER": (0, ("ASCII_ID",)),
    "PRICE": (4, ("ASCII_ID", "ASCII_ID")),
    "PARAM": (3, ("ASCII_ID", "ASCII_KEY")),
    "WARN": (8, ("ASCII_ID", "INT64")),
    "CAND": (2, ("ASCII_ID",)),
}


def encode(tuple_value):
    registry = 2
    if tuple_value[0] == "SNAPSHOT-R2":
        record_name = tuple_value[1]
        components = tuple_value[2:]
    elif tuple_value[0] == "SNAPSHOT-R3-HYPOTHETICAL":
        registry = 3
        record_name = tuple_value[1]
        components = tuple_value[2:]
    else:
        record_name = tuple_value[0]
        components = tuple_value[1:]
    record_type, types = DEFINITIONS[record_name]
    if len(components) != len(types):
        return None
    chunks = [
        b"SKR2",
        struct.pack(">HHHH", 2, registry, record_type, len(components)),
    ]
    for index, (component_type, value) in enumerate(zip(types, components), 1):
        if value is None:
            chunks.append(struct.pack(">HBBI", index, 0, 0, 0))
        elif component_type == "INT64":
            chunks.append(struct.pack(">HBBIq", index, 3, 1, 8, int(value)))
        elif component_type in ("ASCII_ID", "ASCII_KEY"):
            encoded = value.encode("ascii")
            tag = 1 if component_type == "ASCII_ID" else 2
            chunks.append(
                struct.pack(">HBBI", index, tag, 1, len(encoded)) + encoded
            )
        else:
            raise ValueError(f"unsupported component type {component_type}")
    chunks.append(struct.pack(">H", 0xFFFF))
    return b"".join(chunks)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("stable-key vectors path required")
    data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    checks = 0
    for case in data["cases"]:
        for side in ("A", "B"):
            tuple_key = f"tuple{side}"
            bytes_key = f"bytes{side}"
            if tuple_key not in case or case.get(bytes_key) is None:
                continue
            actual = encode(case[tuple_key])
            if actual is None or actual.hex().upper() != case[bytes_key]:
                raise ValueError(f"{case['id']} {side}: fixed bytes mismatch")
            checks += 1
    print(f"STABLE_KEY_FIXED_BYTE_CHECKS={checks}")
    print("STABLE_KEY_FIXED_BYTE_RESULT=PASS")


if __name__ == "__main__":
    main()
