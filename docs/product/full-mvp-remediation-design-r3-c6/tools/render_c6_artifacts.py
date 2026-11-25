import json
import subprocess
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 3:
        raise SystemExit("encoder and fixture paths required")
    encoder = Path(sys.argv[1])
    fixture = Path(sys.argv[2])
    out = subprocess.run(
        [sys.executable, str(encoder), str(fixture)],
        check=True,
        capture_output=True,
        text=True,
    )
    result = json.loads(out.stdout)
    lines = [
        "# C6 Snapshot Vector 01 — Canonical Basis Hex",
        "",
        "```text",
        "MECHANICALLY GENERATED FROM C6_SNAPSHOT_VECTOR_01.json",
        "REGISTRY: SNAPSHOT-R3",
        "PROTOCOL: R3-BASIS-1-R6",
        "STABLE KEY: SK-R2",
        "```",
        "",
        "```text",
        result["basisHex"],
        "```",
        "",
        "```text",
        f"BasisByteLength = {result['length']}",
        f"RecordCount = {len(result['records'])}",
        f"SHA-256 = {result['sha256']}",
        "```",
        "",
    ]
    fixture.with_name("C6_SNAPSHOT_VECTOR_01_HEX.md").write_text(
        "\n".join(lines), encoding="utf-8", newline="\n"
    )
    expected = [
        "# C6 Snapshot Vector 01 Expected Result",
        "",
        "```text",
        f"RecordCount = {len(result['records'])}",
        f"BasisByteLength = {result['length']}",
        f"SHA-256 = {result['sha256']}",
        "```",
        "",
        "| Type | Row ID | StableKey bytes | Record length |",
        "|---:|---|---|---:|",
    ]
    for record in result["records"]:
        expected.append(
            f"| {record['recordType']} | `{record['rowId']}` | "
            f"`{record['stableKeyHex']}` | {record['recordLength']} |"
        )
    expected.append("")
    fixture.with_name("C6_SNAPSHOT_VECTOR_01_EXPECTED_RESULT.md").write_text(
        "\n".join(expected), encoding="utf-8", newline="\n"
    )


if __name__ == "__main__":
    main()
