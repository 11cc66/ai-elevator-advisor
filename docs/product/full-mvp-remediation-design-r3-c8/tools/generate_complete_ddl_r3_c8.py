"""Generate the complete R3-C8 DDL from the frozen R3-C7 base plus C8 overlay."""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 4:
        raise SystemExit("usage: generate_complete_ddl_r3_c8.py <c7.sql> <c8-overlay.sql> <output.sql>")
    c7_path, overlay_path, output_path = map(Path, sys.argv[1:])
    c7 = c7_path.read_text(encoding="utf-8")
    overlay = overlay_path.read_text(encoding="utf-8")
    header = (
        "-- FULL-MVP-REMEDIATION-DESIGN-R3-C8\n"
        "-- Complete PostgreSQL 18 design DDL draft.\n"
        "-- The frozen R3-C7 base is followed by the R3-C8 final-state amendment layer.\n"
        "-- This file is DOCUMENTATION ONLY and must not be executed in this phase.\n"
        "-- CREATE OR REPLACE and ALTER are intentionally used; later definitions are final.\n\n"
    )
    combined = (
        header
        + "-- ===== BEGIN FROZEN R3-C7 BASE =====\n"
        + c7
        + "\n-- ===== END FROZEN R3-C7 BASE =====\n\n"
        + "-- ===== BEGIN R3-C8 FINAL-STATE CORRECTIONS =====\n"
        + overlay
        + "\n-- ===== END R3-C8 FINAL-STATE CORRECTIONS =====\n"
    )
    function_pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((?P<args>.*?)\)\s+RETURNS\b",
        re.IGNORECASE | re.DOTALL,
    )
    signatures = []
    for match in function_pattern.finditer(combined):
        argument_types = []
        for argument in match.group("args").split(","):
            pieces = re.sub(r"\s+", " ", argument.strip().lower()).split()
            if pieces:
                argument_types.append(
                    " ".join(pieces[1:]) if len(pieces) > 1 else pieces[0]
                )
        signatures.append(f"{match.group('name').lower()}({','.join(argument_types)})")
    owner_lines = [
        f"ALTER FUNCTION {signature} OWNER TO elevator_review_function_owner;"
        for signature in sorted(set(signatures))
    ]
    combined = combined.replace(
        "-- __R3_C8_AUTO_OWNERS__",
        "\n".join(owner_lines),
    )
    output_path.write_text(combined, encoding="utf-8")
    print(f"output={output_path}")
    print(f"bytes={output_path.stat().st_size}")
    print(f"lines={len(combined.splitlines())}")
    print(f"sha256={hashlib.sha256(combined.encode('utf-8')).hexdigest().upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
