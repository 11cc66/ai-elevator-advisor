"""Execute SourceKey boundary cases through the R3-C7 Python encoder."""

from __future__ import annotations

import json

from r6_encoder_r3_c7 import R6Error, source_key


ASCII_MAX = "a" * 64
AUX_MAX = "é" * 64

CASES = [
    ("SRC-361", "ACCEPT", [["SOURCE_KIND","ASCII",ASCII_MAX],["SOURCE_ENTITY_TYPE","ASCII","b"*64],["SOURCE_ENTITY_ID","ASCII","c"*64],["SOURCE_AUX","UTF8_NULLABLE","é"*63+"a"]]),
    ("SRC-362", "ACCEPT", [["SOURCE_KIND","ASCII",ASCII_MAX],["SOURCE_ENTITY_TYPE","ASCII","b"*64],["SOURCE_ENTITY_ID","ASCII","c"*64],["SOURCE_AUX","UTF8_NULLABLE",AUX_MAX]]),
    ("SRC-363", "REJECT", [["SOURCE_KIND","ASCII",ASCII_MAX],["SOURCE_ENTITY_TYPE","ASCII","b"*64],["SOURCE_ENTITY_ID","ASCII","c"*64],["SOURCE_AUX","UTF8_NULLABLE",AUX_MAX+"a"]]),
    ("SRC-KIND-MAX", "ACCEPT", [["SOURCE_KIND","ASCII",ASCII_MAX],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]]),
    ("SRC-KIND-MAX+1", "REJECT", [["SOURCE_KIND","ASCII",ASCII_MAX+"a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]]),
    ("SRC-TYPE-MAX", "ACCEPT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII",ASCII_MAX],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]]),
    ("SRC-TYPE-MAX+1", "REJECT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII",ASCII_MAX+"a"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]]),
    ("SRC-ID-MAX", "ACCEPT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII",ASCII_MAX],["SOURCE_AUX","UTF8_NULLABLE","d"]]),
    ("SRC-ID-MAX+1", "REJECT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII",ASCII_MAX+"a"],["SOURCE_AUX","UTF8_NULLABLE","d"]]),
    ("SRC-AUX-128", "ACCEPT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",AUX_MAX]]),
    ("SRC-AUX-129", "REJECT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",AUX_MAX+"a"]]),
    ("SRC-AUX-NFC", "ACCEPT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","café"]]),
    ("SRC-AUX-NFD", "ACCEPT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","cafe\u0301"]]),
    ("SRC-AUX-CONTROL", "REJECT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","a\u0001b"]]),
    ("SRC-AUX-INVALID-UTF8", "REJECT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","\ud800"]]),
    ("SRC-AUX-NULL", "ACCEPT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",None]]),
    ("SRC-AUX-EMPTY", "REJECT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE",""]]),
    ("SRC-MISSING", "REJECT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"]]),
    ("SRC-MIN-FRAMING", "ACCEPT", [["SOURCE_KIND","ASCII","a"],["SOURCE_ENTITY_TYPE","ASCII","b"],["SOURCE_ENTITY_ID","ASCII","c"],["SOURCE_AUX","UTF8_NULLABLE","d"]]),
]


def summary(components: object) -> str:
    if not isinstance(components, list):
        return "not-array"
    parts = []
    for item in components:
        if not isinstance(item, list) or len(item) != 3:
            parts.append("invalid")
        elif item[2] is None:
            parts.append(f"{item[1]}:NULL")
        else:
            try:
                length = len(str(item[2]).encode("utf-8"))
            except UnicodeEncodeError:
                parts.append(f"{item[1]}:INVALID_UTF8")
            else:
                parts.append(f"{item[1]}:{length}")
    return ",".join(parts)


results = []
for case_id, expected, components in CASES:
    observed = "REJECT"
    reason = "UNEXPECTED_ERROR"
    output_length = 0
    output_hex = ""
    try:
        output = source_key(components)
        observed = "ACCEPT"
        reason = "OK"
        output_length = len(output)
        output_hex = output.hex().upper()
    except R6Error as exc:
        reason = exc.code
    results.append({
        "id": case_id,
        "inputSummary": summary(components),
        "expected": expected,
        "observed": observed,
        "reason": reason,
        "outputLength": output_length,
        "outputHex": output_hex,
        "partialSourceKeyProduced": False,
        "result": "PASS" if observed == expected else "FAIL",
    })

print(json.dumps({
    "runtime": "python",
    "total": len(results),
    "accepted": sum(item["observed"] == "ACCEPT" for item in results),
    "rejected": sum(item["observed"] == "REJECT" for item in results),
    "failed": sum(item["result"] == "FAIL" for item in results),
    "results": results,
}, indent=2))

raise SystemExit(1 if any(item["result"] == "FAIL" for item in results) else 0)
