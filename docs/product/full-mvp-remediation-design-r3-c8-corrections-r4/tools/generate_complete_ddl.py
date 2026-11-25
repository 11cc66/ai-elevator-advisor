"""Generate R4 complete DDL only after fully verifying the frozen R3 Manifest."""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

from guard import require_guard


R3_MANIFEST_SHA256 = (
    "C5611B8807D50E3E02286A63B5C9E39F9F745684793C2FD5525DCA4537A71825"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def verify_manifest(manifest: Path, repo: Path) -> dict[str, int]:
    records = 0
    unique: set[str] = set()
    for line in manifest.read_text(encoding="utf-8").splitlines():
        match = re.match(
            r"^([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)$",
            line,
        )
        if not match:
            raise SystemExit("malformed R3 Manifest record")
        expected_hash, expected_bytes, expected_lines, relative = match.groups()
        records += 1
        unique.add(relative)
        target = repo / relative
        if not target.is_file():
            raise SystemExit(f"R3 Manifest target missing: {relative}")
        text = target.read_text(encoding="utf-8")
        if sha256(target) != expected_hash.upper():
            raise SystemExit(f"R3 Manifest hash mismatch: {relative}")
        if target.stat().st_size != int(expected_bytes):
            raise SystemExit(f"R3 Manifest byte mismatch: {relative}")
        if len(text.splitlines()) != int(expected_lines):
            raise SystemExit(f"R3 Manifest line mismatch: {relative}")
    if records != len(unique):
        raise SystemExit("R3 Manifest contains duplicate paths")
    return {"records": records, "unique": len(unique)}


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    require_guard(root)
    repo = root.parents[2]
    r3 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r3"
    manifest = r3 / "SHA256SUMS_R3_C8_CORRECTIONS_R3.txt"
    if sha256(manifest) != R3_MANIFEST_SHA256:
        raise SystemExit("R3 Manifest hash mismatch")
    coverage = verify_manifest(manifest, repo)

    base_path = r3 / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql"
    overlay_path = root / "DATABASE_FINAL_STATE_OVERLAY_R4.sql"
    base = base_path.read_text(encoding="utf-8")
    overlay = overlay_path.read_text(encoding="utf-8")
    if "CORRECTIONS-R4" not in overlay:
        raise SystemExit("R4 Overlay identity marker missing")
    text = (
        "-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R4\n"
        "-- Complete PostgreSQL 18 design DDL draft. DESIGN ONLY.\n\n"
        "-- ===== BEGIN FROZEN R3 COMPLETE DDL =====\n"
        + base
        + "\n-- ===== END FROZEN R3 COMPLETE DDL =====\n\n"
        + "-- ===== BEGIN R4 OVERLAY =====\n"
        + overlay
        + "\n-- ===== END R4 OVERLAY =====\n"
    )
    output = root / "DATABASE_COMPLETE_DDL_DESIGN_R4.sql"
    temporary = output.with_suffix(".tmp")
    temporary.write_text(text, encoding="utf-8", newline="\n")
    os.replace(temporary, output)
    print(f"r3_manifest={sha256(manifest)}")
    print(f"r3_manifest_records={coverage['records']}")
    print(f"overlay_sha256={sha256(overlay_path)}")
    print(f"output={output}")
    print(f"bytes={output.stat().st_size}")
    print(f"lines={len(text.splitlines())}")
    print(f"sha256={sha256(output)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
