"""Run independent R3-C7 review calculations and R3-C8 DDL checks."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def run(command: list[str], cwd: Path) -> str:
    result = subprocess.run(
        command,
        cwd=cwd,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"command failed: {command}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    review = root.parent / "full-mvp-remediation-review-r3-c7" / "tools"
    evidence = root / "evidence"
    evidence.mkdir(exist_ok=True)

    c6 = json.loads(run(
        [sys.executable, "-B", str(review / "independent_c6_basis.py")],
        root,
    ))
    r6 = json.loads(run(
        [sys.executable, "-B", str(review / "independent_r6_validation.py")],
        root,
    ))
    (evidence / "C6_BASIS_R3_C8.json").write_text(
        json.dumps(c6, indent=2) + "\n", encoding="utf-8"
    )
    (evidence / "R6_SCALAR_LIMITS_R3_C8.json").write_text(
        json.dumps(r6, indent=2) + "\n", encoding="utf-8"
    )

    ddl = root / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql"
    registry = root / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8.json"
    validator = run(
        [
            sys.executable, "-B",
            str(root / "tools" / "validate_c8_ddl.py"),
            str(ddl), str(registry), str(evidence / "DDL_STATIC_AUDIT_R3_C8.json"),
        ],
        root,
    )
    ddl_result = json.loads(validator)
    summary = {
        "c6": c6,
        "r6": {
            "scalar_total": r6["scalar"]["total"],
            "scalar_failed": r6["scalar"]["failed"],
            "basis_limit_total": r6["resource_limits"]["total"],
            "basis_limit_failed": r6["resource_limits"]["failed"],
            "result": r6["result"],
        },
        "ddl": ddl_result,
        "result": "PASS" if (
            c6["result"] == "PASS"
            and r6["result"] == "PASS"
            and ddl_result["result"] == "PASS"
        ) else "FAIL",
    }
    (evidence / "SUMMARY_R3_C8.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2))
    return 0 if summary["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
