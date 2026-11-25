"""Generate the complete R2 design DDL from frozen inputs and the R2 overlay."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

from guard import require_guarded_context


EXPECTED_R1_MANIFEST = (
    "0ACBBB3A4CB5F0439302E7F7109F0ECFDCFDE50843D74941E232F830ECE552A2"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def main() -> int:
    r2_root = Path(__file__).resolve().parents[1]
    require_guarded_context(r2_root)
    repo = r2_root.parents[2]
    baseline_dir = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections"
    baseline_manifest = baseline_dir / "SHA256SUMS_R3_C8_CORRECTIONS.txt"
    baseline = baseline_dir / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS.sql"
    overlay = r2_root / "DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R2.sql"
    output = r2_root / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql"
    required = (baseline_manifest, baseline, overlay)
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise SystemExit(f"missing required inputs: {missing}")
    manifest_hash = sha256(baseline_manifest)
    if manifest_hash != EXPECTED_R1_MANIFEST:
        raise SystemExit(
            f"R1 manifest hash mismatch: expected={EXPECTED_R1_MANIFEST} "
            f"actual={manifest_hash}"
        )
    base_text = baseline.read_text(encoding="utf-8")
    overlay_text = overlay.read_text(encoding="utf-8")
    text = (
        "-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R2\n"
        "-- Complete PostgreSQL 18 design DDL draft.\n"
        "-- Frozen R3-C8 Corrections complete DDL plus R2 final-state overlay.\n"
        "-- DESIGN ONLY. Do not execute.\n\n"
        "-- ===== BEGIN FROZEN R3-C8 CORRECTIONS COMPLETE DDL =====\n"
        + base_text
        + "\n-- ===== END FROZEN R3-C8 CORRECTIONS COMPLETE DDL =====\n\n"
        + "-- ===== BEGIN R3-C8 CORRECTIONS R2 OVERLAY =====\n"
        + overlay_text
        + "\n-- ===== END R3-C8 CORRECTIONS R2 OVERLAY =====\n"
    )
    tmp = output.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8", newline="\n")
    os.replace(tmp, output)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest().upper()
    print(f"baseline_manifest_sha256={manifest_hash}")
    print(f"baseline_sha256={sha256(baseline)}")
    print(f"overlay_sha256={sha256(overlay)}")
    print(f"output={output}")
    print(f"bytes={output.stat().st_size}")
    print(f"lines={len(text.splitlines())}")
    print(f"sha256={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
