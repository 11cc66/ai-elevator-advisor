"""Execute scalar vectors through the R3-C7 Python encoder entry point."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from r6_encoder_r3_c7 import R6Error, encode_scalar, validate_source_aux


def materialize_field(source: dict) -> dict:
    field = dict(source)
    repeat = field.pop("repeat", None)
    if repeat:
        field["value"] = str(repeat["char"]) * int(repeat["count"])
    bytes_length = field.pop("bytesLength", None)
    if bytes_length is not None:
        byte = int(field.pop("bytesByte", 0))
        field["bytesHex"] = bytes((byte,)) * int(bytes_length)
        field["bytesHex"] = field["bytesHex"].hex()
    return field


def summarize(source: dict) -> str:
    if "repeat" in source:
        return f"{source['type']}:repeat({source['repeat']['count']})"
    if "bytesLength" in source:
        return f"{source['type']}:bytes({source['bytesLength']})"
    return f"{source['type']}:{str(source.get('value'))[:80]}"


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: run_scalar_python.py <vectors.json>")
    document = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    vectors = [*document["vectors"], *document.get("additionalVectors", [])]
    results = []
    for vector in vectors:
        field = materialize_field(vector["field"])
        observed = "REJECT"
        reason = "UNEXPECTED_ERROR"
        output_bytes = 0
        try:
            if field["type"] == "SOURCE_AUX":
                output_bytes = len(validate_source_aux(field.get("value")))
                observed = "ACCEPT"
                reason = "SOURCE_AUX_ACCEPT"
            else:
                type_tag, presence, payload = encode_scalar(field)
                observed = "ACCEPT"
                reason = f"TAG_{type_tag}_PRESENCE_{presence}"
                output_bytes = len(payload)
        except R6Error as exc:
            reason = exc.code
        results.append({
            "id": vector["id"],
            "inputSummary": summarize(vector["field"]),
            "expected": vector["expected"],
            "observed": observed,
            "reason": reason,
            "outputBytes": output_bytes,
            "partialBasisProduced": False,
            "result": "PASS" if observed == vector["expected"] else "FAIL",
        })
    print(json.dumps({
        "runtime": "python",
        "version": sys.version.split()[0],
        "total": len(results),
        "accepted": sum(item["observed"] == "ACCEPT" for item in results),
        "rejected": sum(item["observed"] == "REJECT" for item in results),
        "failed": sum(item["result"] == "FAIL" for item in results),
        "results": results,
    }, indent=2))
    return 1 if any(item["result"] == "FAIL" for item in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
