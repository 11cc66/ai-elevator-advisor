import json
import sys
from pathlib import Path


def patch_registry(encoded_hex, registry_code):
    raw = bytearray.fromhex(encoded_hex)
    raw[6:8] = registry_code.to_bytes(2, "big")
    return raw.hex().upper()


def main():
    source = Path(sys.argv[1])
    target = Path(sys.argv[2])
    data = json.loads(source.read_text(encoding="utf-8"))
    data["registryVersion"] = "SNAPSHOT-R3"
    for case in data["cases"]:
        for side in ("A", "B"):
            key = f"bytes{side}"
            if case.get(key) is not None:
                case[key] = patch_registry(case[key], 3)
    separation = next(case for case in data["cases"] if case["id"] == "SKV-REGISTRY-SEPARATION")
    separation["tupleA"] = ["SNAPSHOT-R3", "PRICE", "a", "b"]
    separation["tupleB"] = ["SNAPSHOT-R4-SYNTHETIC", "PRICE", "a", "b"]
    separation["bytesB"] = patch_registry(separation["bytesB"], 4)
    separation["dbResult"] = (
        "synthetic framing-only vector; production SNAPSHOT-R3 parser rejects code 4"
    )
    target.write_text(
        json.dumps(data, ensure_ascii=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


if __name__ == "__main__":
    main()
