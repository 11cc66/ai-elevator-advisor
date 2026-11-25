import json
from pathlib import Path
import subprocess
import sys


def main():
    if len(sys.argv) != 3:
        raise SystemExit("encoder path and fixture path required")
    encoder = Path(sys.argv[1])
    fixture = Path(sys.argv[2])
    completed = subprocess.run(
        [sys.executable, str(encoder), str(fixture)],
        check=True,
        capture_output=True,
        text=True,
    )
    result = json.loads(completed.stdout)
    output = fixture.with_name("C5_SNAPSHOT_VECTOR_01_HEX.md")
    lines = [
        "# C5 Snapshot Vector 01 — Canonical Basis Hex",
        "",
        "Status:",
        "",
        "```text",
        "MECHANICALLY GENERATED FROM C5_SNAPSHOT_VECTOR_01.json",
        "REGISTRY: SNAPSHOT-R2",
        "PROTOCOL: R3-BASIS-1-R5",
        "STABLE KEY ENCODING: SK-R2",
        "NO DATABASE/RUNTIME ACCESS",
        "```",
        "",
        "```text",
        result["basisHex"],
        "```",
        "",
        "```text",
        f"BasisByteLength = {result['length']}",
        f"RecordCount = {result['recordCount']}",
        f"SHA-256 = {result['sha256']}",
        "```",
        "",
    ]
    output.write_text("\n".join(lines), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
