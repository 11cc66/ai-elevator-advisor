"""Generate R5 complete DDL from fully verified R4 inputs."""

from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

from guard import require_guard


R4_MANIFEST_SHA256 = (
    "BAB1129478D70E3CD21B6C2D60B338525CE7E18660ABE26D69BBE540409AB377"
)
R4_COMPLETE_SHA256 = (
    "F4DA543931B69F67DEB6672B41F968FCF24E1D8E025B367E5282B4AF44711B2F"
)
R4_OVERLAY_SHA256 = (
    "87A3814632B59FBD6614CCA31E6A388FE3FDEDD0D695611FC04B1E39C4664552"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def verify_manifest(manifest: Path, repo: Path) -> dict[str, int]:
    records = 0
    unique: set[str] = set()
    for line in manifest.read_text(encoding="utf-8").splitlines():
        match = re.match(
            r"^([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)$", line
        )
        if not match:
            raise SystemExit("malformed R4 Manifest record")
        expected_hash, expected_bytes, expected_lines, relative = match.groups()
        records += 1
        unique.add(relative)
        target = manifest.parent / relative
        if not target.is_file():
            raise SystemExit(f"R4 Manifest target missing: {relative}")
        if sha256(target) != expected_hash.upper():
            raise SystemExit(f"R4 Manifest hash mismatch: {relative}")
        if target.stat().st_size != int(expected_bytes):
            raise SystemExit(f"R4 Manifest byte mismatch: {relative}")
        if len(target.read_text(encoding="utf-8").splitlines()) != int(
            expected_lines
        ):
            raise SystemExit(f"R4 Manifest line mismatch: {relative}")
    if records != len(unique):
        raise SystemExit("R4 Manifest contains duplicate paths")
    return {"records": records, "unique": len(unique)}


def strip_uncontrolled_candidate_updates(sql: str) -> str:
    start_marker = (
        "-- Existing rows may predate the candidate-binding trigger. Backfill only from"
    )
    end_marker = (
        "-- ===========================================================================\n"
        "-- 2. Recovery attempt sequence"
    )
    start = sql.find(start_marker)
    if start < 0:
        raise SystemExit("R4 Candidate direct-backfill marker missing")
    end = sql.find(end_marker, start)
    if end < 0:
        raise SystemExit("R4 Candidate section end marker missing")
    replacement = (
        "-- R5 removes the uncontrolled R4 bulk UPDATE, NULL preflight and NOT NULL\n"
        "-- statements from this location. Candidate materialization is performed by\n"
        "-- app_private.execute_candidate_backfill_r5 under its durable batch audit.\n"
        "-- The R5 preflight and NOT NULL closure are restored after that function.\n\n"
    )
    return sql[:start] + replacement + sql[end:]


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    require_guard(root)
    repo = root.parents[2]
    r4 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r4"
    manifest = r4 / "SHA256SUMS_R4.txt"
    complete = r4 / "DATABASE_COMPLETE_DDL_DESIGN_R4.sql"
    overlay = r4 / "DATABASE_FINAL_STATE_OVERLAY_R4.sql"

    if sha256(manifest) != R4_MANIFEST_SHA256:
        raise SystemExit("R4 Manifest hash mismatch")
    coverage = verify_manifest(manifest, repo)
    if sha256(complete) != R4_COMPLETE_SHA256:
        raise SystemExit("R4 Complete DDL hash mismatch")
    if sha256(overlay) != R4_OVERLAY_SHA256:
        raise SystemExit("R4 Overlay hash mismatch")

    r4_sql = complete.read_text(encoding="utf-8")
    transformed = strip_uncontrolled_candidate_updates(r4_sql)
    r5_overlay_path = root / "DATABASE_FINAL_STATE_OVERLAY_R5.sql"
    r5_overlay = r5_overlay_path.read_text(encoding="utf-8")
    if "CORRECTIONS-R5" not in r5_overlay:
        raise SystemExit("R5 Overlay identity marker missing")

    text = (
        "-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R5\n"
        "-- Complete PostgreSQL 18 design DDL draft. DESIGN ONLY. Do not execute.\n"
        "-- The hash-verified R4 Complete DDL is frozen below except that the\n"
        "-- uncontrolled Candidate backfill segment is removed by the R5 transformer.\n\n"
        "-- ===== BEGIN TRANSFORMED FROZEN R4 COMPLETE DDL =====\n"
        + transformed
        + "\n-- ===== END TRANSFORMED FROZEN R4 COMPLETE DDL =====\n\n"
        + "-- ===== BEGIN R5 OVERLAY =====\n"
        + r5_overlay
        + "\n-- ===== END R5 OVERLAY =====\n"
    )
    output = root / "DATABASE_COMPLETE_DDL_DESIGN_R5.sql"
    temporary = output.with_suffix(".tmp")
    temporary.write_text(text, encoding="utf-8", newline="\n")
    os.replace(temporary, output)

    print(f"r4_manifest={sha256(manifest)}")
    print(f"r4_manifest_records={coverage['records']}")
    print(f"r4_complete_sha256={sha256(complete)}")
    print(f"r4_overlay_sha256={sha256(overlay)}")
    print(f"r5_overlay_sha256={sha256(r5_overlay_path)}")
    print(f"output={output}")
    print(f"bytes={output.stat().st_size}")
    print(f"lines={len(text.splitlines())}")
    print(f"sha256={sha256(output)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

