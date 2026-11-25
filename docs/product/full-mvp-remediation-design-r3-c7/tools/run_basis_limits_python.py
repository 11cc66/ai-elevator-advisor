"""Execute Basis resource-limit vectors through the Python encoder entry."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from r6_encoder_r3_c7 import R6Error, validate_resource_budget


if len(sys.argv) != 2:
    raise SystemExit("usage: run_basis_limits_python.py <vectors.json>")
document = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
results = []
for vector in document["vectors"]:
    observed = "ACCEPT"
    reason = "OK"
    try:
        validate_resource_budget(vector["input"])
    except R6Error as exc:
        observed = "REJECT"
        reason = exc.code
    results.append({
        "id": vector["id"],
        "expected": vector["expected"],
        "observed": observed,
        "reason": reason,
        "result": "PASS" if observed == vector["expected"] else "FAIL",
    })
output = {
    "runtime": "python",
    "total": len(results),
    "failed": sum(item["result"] == "FAIL" for item in results),
    "results": results,
}
print(json.dumps(output, indent=2))
raise SystemExit(1 if output["failed"] else 0)
