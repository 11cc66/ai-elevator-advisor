"""Offline validator for the R3-C8 corrections design.

This is intentionally not a PostgreSQL parser or Catalog verifier. It checks
the design invariants and mutation fixtures without importing or executing any
C8 or review tool.
"""

from __future__ import annotations

import hashlib
import json
import re
import struct
import unicodedata
from pathlib import Path


def n(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def split_list(value: str) -> list[str]:
    return [n(item) for item in value.split(",") if item.strip()]


def signature(name: str, args: str) -> str:
    types = []
    for item in split_list(args):
        pieces = item.split()
        if pieces:
            types.append(" ".join(pieces[1:]) if len(pieces) > 1 else pieces[0])
    return f"{name.lower()}({', '.join(types)})"


def relation_keys(sql: str) -> tuple[dict[str, set[str]], dict[str, set[tuple[str, ...]]], list[dict]]:
    tables: dict[str, set[str]] = {}
    keys: dict[str, set[tuple[str, ...]]] = {}
    fks: list[dict] = []
    for match in re.finditer(
        r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*\((.*?)\n\);",
        sql,
        re.I | re.S,
    ):
        table = match.group(1).lower()
        body = match.group(2)
        columns = {
            item.group(1).lower()
            for item in re.finditer(r"^\s*([a-z_][a-z0-9_]*)\s+", body, re.I | re.M)
            if item.group(1).lower() not in {
                "constraint", "primary", "foreign", "unique", "check", "exclude"
            }
        }
        tables[table] = columns
        keys[table] = {
            tuple(split_list(item))
            for item in re.findall(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)", body, re.I)
        }
        for column in re.findall(
            r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",
            body,
            re.I | re.M,
        ):
            keys[table].add((column.lower(),))
    for match in re.finditer(
        r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*(.*?);",
        sql,
        re.I | re.S,
    ):
        table, body = match.group(1).lower(), match.group(2)
        tables.setdefault(table, set())
        for column in re.findall(r"ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)", body, re.I):
            tables[table].add(column.lower())
        keys.setdefault(table, set())
        keys[table] |= {
            tuple(split_list(item))
            for item in re.findall(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)", body, re.I)
        }
    for match in re.finditer(
        r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
        r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
        sql,
        re.I | re.S,
    ):
        fks.append({
            "source": tuple(split_list(match.group(1))),
            "target_table": match.group(2).lower(),
            "target": tuple(split_list(match.group(3))),
        })
    return tables, keys, fks


def check_invariants(sql: str) -> dict[str, bool]:
    checks = {
        "price_fact_canonical_v1": "price_fact_canonical_v1" in sql,
        "price_fact_full_row_payload": all(
            token in sql for token in (
                "priceFactDigest", "amountMinor", "currency", "priceBasis",
                "taxBasis", "applicability", "validFrom", "validUntil", "quotedAt"
            )
        ),
        "price_selection_fact_fk": "selection_candidate_price_fact_fk" in sql,
        "price_snapshot_fact_fk": "snapshot_price_selection_fact_fk" in sql,
        "requirement_assertion_fk": "selection_requirement_assertion_fk" in sql,
        "requirement_value_fk": "selection_requirement_value_fk" in sql,
        "catalog_event_fk": "selection_catalog_review_event_fk" in sql,
        "catalog_event_digest": "catalog_review_event_digest_v1" in sql,
        "professional_result_fk": "professional_review_result_fk" in sql,
        "professional_event_fk": "professional_event_review_result_fk" in sql,
        "professional_basis_computed": "professional_basis_digest_v1" in sql,
        "professional_decision_mapping": "professional_event_decision_r3" in sql,
        "role_attributes_checked": all(
            token in sql for token in (
                "NOT r.rolcreatedb", "NOT r.rolcreaterole",
                "NOT r.rolinherit", "NOT r.rolreplication", "NOT r.rolbypassrls"
            )
        ),
        "recursive_membership_closure": "WITH RECURSIVE reachable" in sql,
        "membership_options_checked": all(
            token in sql for token in (
                "inherit_option", "set_option", "admin_option"
            )
        ),
        "direct_connect_check": "direct database CONNECT" in sql,
        "bootstrap_flow": all(
            token in sql for token in (
                "bootstrap_prepare_r3", "bootstrap_record_approval_r3",
                "bootstrap_complete_root_r3", "bootstrap requires two distinct approvals"
            )
        ),
        "root_grant_one_shot": "bootstrap-grant:" in sql and "bootstrap_state_r3" in sql,
        "request_epoch": "command_request" in sql and "ADD COLUMN epoch bigint" in sql,
        "request_replay_audit": "command_request_replay_audit_r3" in sql,
        "request_session_semantics": "r.session_id<>p_session_id" in sql,
        "professional_truncate": (
            "deny_professional_review_truncate_r3" in sql
            and "BEFORE TRUNCATE ON app.professional_review" in sql
        ),
        "trusted_session_truncate": (
            "deny_trusted_session_truncate_r3" in sql
            and "BEFORE TRUNCATE ON app.trusted_session" in sql
        ),
        "source_aux_helper": "validate_source_aux_r3" in sql,
        "source_aux_pre_seal": "validate_selection_source_aux_r3" in sql,
        "source_aux_seal_call": "PERFORM app_private.validate_selection_source_aux_r3" in sql,
        "c6_compatibility_marker": "R3-BASIS-1-R6" in sql and "4036" in sql,
    }
    tables, keys, fks = relation_keys(sql)
    fk_errors = []
    for fk in fks:
        if fk["target_table"] not in tables or fk["target"] not in keys.get(fk["target_table"], set()):
            fk_errors.append(fk)
    checks["all_fk_targets_exact"] = not fk_errors
    return checks


def c6_result(c6_fixture: Path, c6_hex: Path) -> dict:
    fixture = json.loads(c6_fixture.read_text(encoding="utf-8"))

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
            raise ValueError
        payload = value.encode("ascii")
        if len(payload) > 64 or any(byte < 0x20 or byte > 0x7E for byte in payload):
            raise ValueError
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
            raise ValueError
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
                raise ValueError
            out += u16(index) + bytes((tag, 1)) + u32(len(payload)) + payload
        out += u16(0xFFFF)
        if len(out) > 158:
            raise ValueError
        return bytes(out)

    def scalar(field: dict) -> bytes:
        kind = field["type"]
        value = field.get("value")
        if kind == "NULL":
            tag, presence, payload = 0, 0, b""
        elif kind == "BOOLEAN":
            tag, presence, payload = 1, 1, bytes((1 if value else 0,))
        elif kind == "INTEGER":
            tag, presence, payload = 2, 1, i64(value)
        elif kind == "DECIMAL":
            tag, presence, payload = 3, 1, value.encode("ascii")
        elif kind == "TEXT":
            tag, presence, payload = 4, 1, value.encode("utf-8")
        elif kind == "ENUM":
            tag, presence, payload = 5, 1, ascii_bytes(value)
        elif kind == "CANONICAL_ID":
            tag, presence, payload = 6, 1, ascii_bytes(value)
        elif kind == "TIMESTAMP":
            tag, presence, payload = 7, 1, i64(value)
        elif kind == "BYTES":
            tag, presence, payload = 8, 1, source_key(field["sourceComponents"])
        else:
            raise ValueError
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
    basis = b"R3BASIS\0" + u16(6) + u16(1) + u32(28) + u32(len(encoded)) + u64(len(body)) + body
    documented = next(
        line.strip() for line in c6_hex.read_text(encoding="utf-8").splitlines()
        if len(line.strip()) > 100 and re.fullmatch(r"[0-9A-F]+", line.strip())
    )
    return {
        "records": len(encoded),
        "types": [item[0] for item in encoded],
        "bytes": len(basis),
        "sha256": hashlib.sha256(basis).hexdigest().upper(),
        "hex_match": basis.hex().upper() == documented,
    }


def main() -> int:
    corrections = Path(__file__).resolve().parents[1]
    design = corrections.parent / "full-mvp-remediation-design-r3-c8"
    ddl = (corrections / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS.sql").read_text(encoding="utf-8")
    checks = check_invariants(ddl)
    tables, keys, fks = relation_keys(ddl)
    fk_errors = [
        fk for fk in fks
        if fk["target_table"] not in tables
        or fk["target"] not in keys.get(fk["target_table"], set())
    ]
    function_count = len({
        signature(match.group(1), match.group(2))
        for match in re.finditer(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
            r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+RETURNS\b",
            ddl,
            re.I | re.S,
        )
    })
    trigger_count = len(re.findall(
        r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+", ddl, re.I
    ))
    roles = sorted(set(re.findall(
        r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", ddl, re.I
    )))

    mutations = {
        "price_digest_removed": ddl.replace("priceFactDigest", "REMOVED_PRICE_FACT"),
        "requirement_fk_removed": ddl.replace(
            "selection_requirement_assertion_fk", "REMOVED_REQUIREMENT_FK"
        ),
        "catalog_fk_removed": ddl.replace(
            "selection_catalog_review_event_fk", "REMOVED_CATALOG_FK"
        ),
        "professional_decision_mapping_removed": ddl.replace(
            "professional_event_decision_r3", "REMOVED_DECISION_MAPPING"
        ),
        "professional_event_fk_removed": ddl.replace(
            "professional_event_review_result_fk", "REMOVED_EVENT_FK"
        ),
        "professional_basis_removed": ddl.replace(
            "professional_basis_digest_v1", "REMOVED_BASIS_DIGEST"
        ),
        "role_attribute_removed": ddl.replace("NOT r.rolcreatedb", "TRUE"),
        "recursive_closure_removed": ddl.replace("WITH RECURSIVE reachable", "REMOVED_RECURSIVE"),
        "bootstrap_removed": ddl.replace("bootstrap_complete_root_r3", "REMOVED_BOOTSTRAP"),
        "connect_check_removed": ddl.replace("direct database CONNECT", "REMOVED_CONNECT_CHECK"),
        "request_epoch_removed": ddl.replace("ADD COLUMN epoch bigint", "REMOVED_EPOCH"),
        "professional_truncate_removed": ddl.replace(
            "deny_professional_review_truncate_r3", "REMOVED_TRUNCATE"
        ),
        "source_aux_removed": ddl.replace(
            "validate_selection_source_aux_r3", "REMOVED_SOURCE_AUX"
        ),
    }
    mutation_results = {}
    for name, mutated in mutations.items():
        mutation_checks = check_invariants(mutated)
        mutation_results[name] = {
            "detected": not all(mutation_checks.values()),
            "failed_checks": [key for key, value in mutation_checks.items() if not value],
        }
    c6 = c6_result(
        design.parent / "full-mvp-remediation-design-r3-c6" / "C6_SNAPSHOT_VECTOR_01.json",
        design.parent / "full-mvp-remediation-design-r3-c6" / "C6_SNAPSHOT_VECTOR_01_HEX.md",
    )
    result = {
        "review": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS",
        "scope": "OFFLINE STATIC VALIDATION; NOT POSTGRESQL PARSER OR EXECUTION",
        "invariants": checks,
        "fk_errors": fk_errors,
        "object_inventory": {
            "tables": len(tables),
            "foreign_keys": len(fks),
            "functions": function_count,
            "triggers": trigger_count,
            "roles": len(roles),
        },
        "invariants_passed": sum(checks.values()),
        "invariants_total": len(checks),
        "mutations": mutation_results,
        "mutations_detected": sum(item["detected"] for item in mutation_results.values()),
        "mutations_total": len(mutation_results),
        "c6_snap_01": c6,
        "result": "PASS" if all(checks.values()) and all(
            item["detected"] for item in mutation_results.values()
        ) and c6["records"] == 15 and c6["bytes"] == 4036 and c6["sha256"] == "7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB" else "FAIL",
    }
    out = corrections / "evidence" / "VALIDATION_R3_C8_CORRECTIONS.json"
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "invariants_passed": result["invariants_passed"],
        "invariants_total": result["invariants_total"],
        "mutations_detected": result["mutations_detected"],
        "mutations_total": result["mutations_total"],
        "c6": c6,
        "output": str(out),
        "result": result["result"],
    }, indent=2))
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
