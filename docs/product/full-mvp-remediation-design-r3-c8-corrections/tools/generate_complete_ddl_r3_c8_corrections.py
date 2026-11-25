"""Generate the corrections complete DDL from the frozen C8 baseline and overlay.

This tool has fixed input/output locations. It never writes into the original
C8 or C8 Review directories.
"""

from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 1:
        raise SystemExit("usage: generate_complete_ddl_r3_c8_corrections.py")
    corrections = Path(__file__).resolve().parents[1]
    product = corrections.parent
    baseline_dir = product / "full-mvp-remediation-design-r3-c8"
    c8 = baseline_dir / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql"
    overlay = corrections / "DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql"
    output = corrections / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS.sql"
    for path in (c8, overlay):
        if not path.is_file():
            raise SystemExit(f"missing input: {path}")
    base = c8.read_text(encoding="utf-8")
    amendments = overlay.read_text(encoding="utf-8")
    text = (
        "-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS\n"
        "-- Complete PostgreSQL 18 design DDL draft.\n"
        "-- Frozen R3-C8 baseline followed by corrections overlay.\n"
        "-- DESIGN ONLY. Do not execute this file.\n\n"
        "-- ===== BEGIN FROZEN R3-C8 BASELINE =====\n"
        + base
        + "\n-- ===== END FROZEN R3-C8 BASELINE =====\n\n"
        + "-- ===== BEGIN R3-C8 CORRECTIONS OVERLAY =====\n"
        + amendments
        + "\n-- ===== END R3-C8 CORRECTIONS OVERLAY =====\n"
    )
    tmp = output.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, output)
    print(f"output={output}")
    print(f"bytes={output.stat().st_size}")
    print(f"lines={len(text.splitlines())}")
    print(f"sha256={hashlib.sha256(text.encode('utf-8')).hexdigest().upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
