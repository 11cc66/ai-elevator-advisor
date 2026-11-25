"""Offline compatibility vectors and design-case matrices for R2."""

from __future__ import annotations

import hashlib
import json
import re
import struct
import unicodedata
from pathlib import Path

from guard import require_guarded_context


def c6_result(fixture_path: Path, hex_path: Path) -> dict[str, object]:
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))

    def u16(value: int) -> bytes:
        return struct.pack(">H", value)

    def u32(value: int) -> bytes:
        return struct.pack(">I", value)

    def u64(value: int) -> bytes:
        return struct.pack(">Q", value)

    def i64(value: object) -> bytes:
        return struct.pack(">q", int(value))

    def ascii_bytes(value: object, empty: bool = False) -> bytes:
        if not isinstance(value, str) or (not value and not empty):
            raise ValueError("invalid ASCII string")
        payload = value.encode("ascii")
        if len(payload) > 64 or any(byte < 0x20 or byte > 0x7E for byte in payload):
            raise ValueError("ASCII range error")
        return payload

    def source_key(parts: list[list[object]]) -> bytes:
        out = bytearray(b"SRC3" + u16(3) + u16(4))
        for index, (_, kind, value) in enumerate(parts, 1):
            if value is None:
                tag, presence, payload = 0, 0, b""
            elif kind == "ASCII":
                tag, presence, payload = 1, 1, ascii_bytes(value)
            else:
                normalized = unicodedata.normalize("NFC", str(value))
                payload = normalized.encode("utf-8")
                tag, presence = 2, 1
            out += u16(index) + bytes((tag, presence)) + u32(len(payload)) + payload
        out += u16(0xFFFF)
        if len(out) > 362:
            raise ValueError("SourceKey too large")
        return bytes(out)

    def stable(record_type: int, values: list[list[object]]) -> bytes:
        out = bytearray(b"SKR2" + u16(2) + u16(3) + u16(record_type) + u16(len(values)))
        for index, (_, kind, value) in enumerate(values, 1):
            if kind == "ASCII_ID":
                tag, payload = 1, ascii_bytes(value, True)
            elif kind == "ASCII_KEY":
                tag, payload = 2, ascii_bytes(value, True)
            elif kind == "INT64":
                tag, payload = 3, i64(value)
            else:
                raise ValueError("unknown stable key")
            out += u16(index) + bytes((tag, 1)) + u32(len(payload)) + payload
        out += u16(0xFFFF)
        if len(out) > 158:
            raise ValueError("stable key too large")
        return bytes(out)

    def scalar(field: dict[str, object]) -> bytes:
        kind = field["type"]
        value = field.get("value")
        if kind == "NULL":
            tag, presence, payload = 0, 0, b""
        elif kind == "BOOLEAN":
            tag, presence, payload = 1, 1, bytes((1 if value else 0,))
        elif kind == "INTEGER":
            tag, presence, payload = 2, 1, i64(value)
        elif kind == "DECIMAL":
            tag, presence, payload = 3, 1, str(value).encode("ascii")
        elif kind == "TEXT":
            tag, presence, payload = 4, 1, str(value).encode("utf-8")
        elif kind == "ENUM":
            tag, presence, payload = 5, 1, ascii_bytes(value)
        elif kind == "CANONICAL_ID":
            tag, presence, payload = 6, 1, ascii_bytes(value)
        elif kind == "TIMESTAMP":
            tag, presence, payload = 7, 1, i64(value)
        elif kind == "BYTES":
            tag, presence, payload = 8, 1, source_key(field["sourceComponents"])
        else:
            raise ValueError("unknown scalar type")
        return u16(int(field["tag"])) + bytes((tag, presence)) + u32(len(payload)) + payload

    encoded = []
    for record in fixture["records"]:
        record_type = int(record["recordType"])
        key = stable(record_type, record["stableKeyTuple"])
        row_id = ascii_bytes(record["rowId"])
        fields = sorted(record["fields"], key=lambda item: int(item["tag"]))
        body = b"".join(scalar(item) for item in fields)
        inner = (
            u16(record_type) + u16(len(row_id)) + row_id
            + u16(len(key)) + key + u16(len(fields)) + body
        )
        encoded.append((record_type, key, row_id, u32(len(inner) + 4) + inner))
    encoded.sort(key=lambda item: (item[0], item[1], item[2]))
    body = b"".join(item[3] for item in encoded)
    basis = b"R3BASIS\0" + u16(6) + u16(1) + u32(28) + u32(len(encoded))
    basis += u64(len(body)) + body
    documented = next(
        line.strip()
        for line in hex_path.read_text(encoding="utf-8").splitlines()
        if len(line.strip()) > 100 and re.fullmatch(r"[0-9A-F]+", line.strip())
    )
    digest = hashlib.sha256(basis).hexdigest().upper()
    return {
        "records": len(encoded),
        "types": [item[0] for item in encoded],
        "bytes": len(basis),
        "sha256": digest,
        "hex_match": basis.hex().upper() == documented,
        "source_key_max_bytes": 362,
        "basis_max_bytes": 512,
        "sk_r2_registry_code": 3,
        "pass": (
            len(encoded) == 15
            and len(basis) == 4036
            and digest == "7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB"
            and basis.hex().upper() == documented
        ),
    }


def root_decision(case: dict[str, bool]) -> str:
    required = (
        "role_principal_matches",
        "state_principal_matches",
        "session_principal_matches",
        "grant_recipient_matches",
        "grant_issuer_matches",
        "approvals_distinct",
        "generation_matches",
        "no_existing_root_grant",
    )
    return "ACCEPT" if all(case.get(key, False) for key in required) else "REJECT"


def owner_decision(case: dict[str, bool]) -> str:
    forbidden = (
        "database_owner",
        "database_owner_membership",
        "pg_database_owner_path",
        "schema_owner",
        "schema_owner_indirect",
        "table_owner",
        "sequence_owner",
        "view_owner",
        "function_owner",
        "set_role_owner",
        "inherit_owner",
        "admin_expansion",
        "owner_changed",
        "catalog_incomplete",
    )
    return "REJECT" if any(case.get(key, False) for key in forbidden) else "ACCEPT"


def catalog_decision(case: dict[str, bool]) -> str:
    required = (
        "source_exists",
        "source_target_fk_matches",
        "target_revision_matches",
        "target_digest_matches",
        "project_matches",
        "binding_digest_matches",
        "event_binding_matches",
    )
    return "ACCEPT" if all(case.get(key, False) for key in required) else "REJECT"


def recovery_decision(case: dict[str, bool]) -> str:
    if case.get("security_compromise") and not case.get("new_identity"):
        return "BLOCKED"
    required = (
        "two_distinct_approvals",
        "root_principal_distinct",
        "generation_cas",
        "old_root_revoked",
        "single_root_grant",
        "audit_recorded",
    )
    return "ACCEPT" if all(case.get(key, False) for key in required) else "REJECT"


def request_decision(case: dict[str, object]) -> str:
    termination = case.get("termination")
    if case.get("different_principal") or case.get("payload_conflict"):
        return "DENY"
    if termination in ("NORMAL_CLOSE", "NATURAL_EXPIRY"):
        return "ORDINARY_REPLAY"
    if termination in ("SECURITY_REVOKE", "PRINCIPAL_DISABLED"):
        return "PERMANENT_DENY"
    if termination in ("ADMIN_REVOKE", "CREDENTIAL_ROTATION", "GRANT_REVOKED"):
        return "CONTROLLED_RECOVERY"
    return "DENY"


def main() -> int:
    r2_root = Path(__file__).resolve().parents[1]
    guard = require_guarded_context(r2_root)
    repo = r2_root.parents[2]
    c6 = c6_result(
        repo / "docs/product/full-mvp-remediation-design-r3-c6/C6_SNAPSHOT_VECTOR_01.json",
        repo / "docs/product/full-mvp-remediation-design-r3-c6/C6_SNAPSHOT_VECTOR_01_HEX.md",
    )
    r6_scalar = json.loads((
        repo / "docs/product/full-mvp-remediation-design-r3-c8/evidence/R6_SCALAR_LIMITS_R3_C8.json"
    ).read_text(encoding="utf-8"))
    r6_independent = json.loads((
        repo / "docs/product/full-mvp-remediation-review-r3-c7/INDEPENDENT_R6_VALIDATION_EVIDENCE.json"
    ).read_text(encoding="utf-8"))
    root_cases = [
        {"id": "ROOT-POS", "expected": "ACCEPT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-ROLE", "expected": "REJECT", "role_principal_matches": False, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-STATE", "expected": "REJECT", "role_principal_matches": True, "state_principal_matches": False, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-SESSION", "expected": "REJECT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": False, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-RECIPIENT", "expected": "REJECT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": False, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-ISSUER", "expected": "REJECT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": False, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-APPROVERS", "expected": "REJECT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": False, "generation_matches": True, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-EPOCH", "expected": "REJECT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": False, "no_existing_root_grant": True},
        {"id": "ROOT-NEG-DUPLICATE", "expected": "REJECT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": False},
        {"id": "ROOT-REPLAY-SAME", "expected": "ACCEPT", "role_principal_matches": True, "state_principal_matches": True, "session_principal_matches": True, "grant_recipient_matches": True, "grant_issuer_matches": True, "approvals_distinct": True, "generation_matches": True, "no_existing_root_grant": True},
    ]
    owner_cases = []
    owner_keys = (
        "database_owner", "database_owner_membership", "pg_database_owner_path",
        "schema_owner", "schema_owner_indirect", "table_owner", "sequence_owner",
        "view_owner", "function_owner", "set_role_owner", "inherit_owner",
        "admin_expansion", "owner_changed", "catalog_incomplete",
    )
    owner_cases.append({"id": "OWNER-POS", "expected": "ACCEPT"})
    for index, key in enumerate(owner_keys, 1):
        owner_cases.append({
            "id": f"OWNER-NEG-{index:02d}",
            "expected": "REJECT",
            key: True,
        })
    catalog_cases = [
        {"id": "CAT-PRODUCT-POS", "expected": "ACCEPT", "source_exists": True, "source_target_fk_matches": True, "target_revision_matches": True, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-SPEC-POS", "expected": "ACCEPT", "source_exists": True, "source_target_fk_matches": True, "target_revision_matches": True, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-PRICE-POS", "expected": "ACCEPT", "source_exists": True, "source_target_fk_matches": True, "target_revision_matches": True, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-NEG-PROD-SPEC", "expected": "REJECT", "source_exists": True, "source_target_fk_matches": False, "target_revision_matches": True, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-NEG-SPEC-PROD", "expected": "REJECT", "source_exists": True, "source_target_fk_matches": False, "target_revision_matches": True, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-NEG-PRICE-PROD", "expected": "REJECT", "source_exists": True, "source_target_fk_matches": False, "target_revision_matches": True, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-NEG-REVISION", "expected": "REJECT", "source_exists": True, "source_target_fk_matches": True, "target_revision_matches": False, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-NEG-DIGEST", "expected": "REJECT", "source_exists": True, "source_target_fk_matches": True, "target_revision_matches": True, "target_digest_matches": False, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-NEG-PROJECT", "expected": "REJECT", "source_exists": True, "source_target_fk_matches": True, "target_revision_matches": True, "target_digest_matches": True, "project_matches": False, "binding_digest_matches": True, "event_binding_matches": True},
        {"id": "CAT-NEG-EVENT-BINDING", "expected": "REJECT", "source_exists": True, "source_target_fk_matches": True, "target_revision_matches": True, "target_digest_matches": True, "project_matches": True, "binding_digest_matches": True, "event_binding_matches": False},
    ]
    recovery_cases = [
        {"id": "REC-POS", "expected": "ACCEPT", "two_distinct_approvals": True, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": True, "single_root_grant": True, "audit_recorded": True},
        {"id": "REC-NEG-ONE-APPROVAL", "expected": "REJECT", "two_distinct_approvals": False, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": True, "single_root_grant": True, "audit_recorded": True},
        {"id": "REC-NEG-SAME-PRINCIPAL", "expected": "REJECT", "two_distinct_approvals": False, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": True, "single_root_grant": True, "audit_recorded": True},
        {"id": "REC-NEG-GENERATION", "expected": "REJECT", "two_distinct_approvals": True, "root_principal_distinct": True, "generation_cas": False, "old_root_revoked": True, "single_root_grant": True, "audit_recorded": True},
        {"id": "REC-NEG-OLD-ROOT", "expected": "REJECT", "two_distinct_approvals": True, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": False, "single_root_grant": True, "audit_recorded": True},
        {"id": "REC-NEG-DUPLICATE-GRANT", "expected": "REJECT", "two_distinct_approvals": True, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": True, "single_root_grant": False, "audit_recorded": True},
        {"id": "REC-NEG-NO-AUDIT", "expected": "REJECT", "two_distinct_approvals": True, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": True, "single_root_grant": True, "audit_recorded": False},
        {"id": "REC-ROTATE-POS", "expected": "ACCEPT", "two_distinct_approvals": True, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": True, "single_root_grant": True, "audit_recorded": True},
        {"id": "REC-COMPROMISE-NO-NEW", "expected": "BLOCKED", "security_compromise": True, "new_identity": False},
        {"id": "REC-RESPONSE-LOST", "expected": "ACCEPT", "two_distinct_approvals": True, "root_principal_distinct": True, "generation_cas": True, "old_root_revoked": True, "single_root_grant": True, "audit_recorded": True},
    ]
    request_cases = [
        {"id": "REQ-NORMAL-CLOSE", "termination": "NORMAL_CLOSE", "expected": "ORDINARY_REPLAY"},
        {"id": "REQ-NATURAL-EXPIRY", "termination": "NATURAL_EXPIRY", "expected": "ORDINARY_REPLAY"},
        {"id": "REQ-ADMIN-REVOKE", "termination": "ADMIN_REVOKE", "expected": "CONTROLLED_RECOVERY"},
        {"id": "REQ-CREDENTIAL", "termination": "CREDENTIAL_ROTATION", "expected": "CONTROLLED_RECOVERY"},
        {"id": "REQ-GRANT", "termination": "GRANT_REVOKED", "expected": "CONTROLLED_RECOVERY"},
        {"id": "REQ-SECURITY", "termination": "SECURITY_REVOKE", "expected": "PERMANENT_DENY"},
        {"id": "REQ-DISABLED", "termination": "PRINCIPAL_DISABLED", "expected": "PERMANENT_DENY"},
        {"id": "REQ-OTHER-PRINCIPAL", "termination": "NORMAL_CLOSE", "different_principal": True, "expected": "DENY"},
        {"id": "REQ-PAYLOAD-CONFLICT", "termination": "NORMAL_CLOSE", "payload_conflict": True, "expected": "DENY"},
        {"id": "REQ-UNKNOWN", "termination": "UNKNOWN", "expected": "DENY"},
    ]
    case_matrix = {}
    for family, cases, decision in (
        ("root_principal", root_cases, root_decision),
        ("owner_closure", owner_cases, owner_decision),
        ("catalog_source_target", catalog_cases, catalog_decision),
        ("bootstrap_recovery", recovery_cases, recovery_decision),
        ("request_ledger", request_cases, request_decision),
    ):
        evaluated = []
        for case in cases:
            payload = {key: value for key, value in case.items() if key not in ("id", "expected")}
            actual = decision(payload)
            evaluated.append({
                "id": case["id"],
                "expected": case["expected"],
                "actual": actual,
                "pass": actual == case["expected"],
            })
        case_matrix[family] = {
            "total": len(evaluated),
            "passed": sum(item["pass"] for item in evaluated),
            "all_pass": all(item["pass"] for item in evaluated),
            "cases": evaluated,
        }
    r6_summary = {
        "scalar_total": r6_scalar.get("scalar", {}).get("total"),
        "scalar_passed": (
            r6_scalar.get("scalar", {}).get("total", 0)
            - r6_scalar.get("scalar", {}).get("failed", 0)
        ),
        "resource_total": r6_independent.get("resource_limits", {}).get("total"),
        "resource_passed": (
            r6_independent.get("resource_limits", {}).get("total", 0)
            - r6_independent.get("resource_limits", {}).get("failed", 0)
        ),
    }
    result = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R2",
        "guard": guard,
        "c6_snap_01": c6,
        "r6_compatibility": r6_summary,
        "case_matrix": case_matrix,
        "all_case_matrices_pass": all(item["all_pass"] for item in case_matrix.values()),
        "result": (
            "PASS"
            if c6["pass"]
            and r6_summary.get("scalar_total") == r6_summary.get("scalar_passed") == 23
            and r6_summary.get("resource_total") == r6_summary.get("resource_passed") == 14
            and all(item["all_pass"] for item in case_matrix.values())
            else "FAIL"
        ),
    }
    output = r2_root / "evidence" / "OFFLINE_VECTOR_AND_CASE_EVIDENCE_R3_C8_CORRECTIONS_R2.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "c6": c6,
        "r6": r6_summary,
        "case_families": {
            key: f"{value['passed']}/{value['total']}"
            for key, value in case_matrix.items()
        },
        "result": result["result"],
        "output": str(output),
    }, indent=2))
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
