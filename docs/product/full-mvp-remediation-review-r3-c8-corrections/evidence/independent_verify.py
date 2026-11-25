"""Independent review checks for R3-C8 Corrections.

This script does not import or execute any Corrections tool. It is a
text-level design checker, not a PostgreSQL parser or Catalog verifier.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


EXPECTED_CORRECTIONS_MANIFEST = "0ACBBB3A4CB5F0439302E7F7109F0ECFDCFDE50843D74941E232F830ECE552A2"


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def function_body(sql: str, name: str) -> str:
    starts = list(re.finditer(
        rf"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+{re.escape(name)}\s*\(",
        sql,
        re.I,
    ))
    if not starts:
        return ""
    start = starts[-1].end()
    next_start = sql.find("\nCREATE ", start)
    end = len(sql) if next_start < 0 else next_start
    dollar = sql.find("$$;", start, end)
    return sql[start:dollar + 3 if dollar >= 0 else end]


def parse_fks(sql: str):
    fks = []
    for match in re.finditer(
        r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
        r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
        sql,
        re.I | re.S,
    ):
        fks.append({
            "source": tuple(compact(item) for item in match.group(1).split(",") if item.strip()),
            "target": match.group(2).lower(),
            "target_columns": tuple(compact(item) for item in match.group(3).split(",") if item.strip()),
        })
    return fks


def evaluate(sql: str) -> dict[str, bool]:
    checks = {
        "price_canonical_complete": all(
            token in function_body(sql, "app_private.price_fact_canonical_v1")
            for token in (
                "amountMinor", "currency", "priceBasis", "taxBasis",
                "applicability", "validFromUtc", "validUntilUtc",
                "quotedAtUtc", "priceUnitCode", "quantityMin", "quantityMax"
            )
        ),
        "price_row_payload_complete": all(
            token in function_body(sql, "app_private.price_row_payload_v1")
            for token in (
                "amountMinor", "currency", "priceBasis", "taxBasis",
                "applicability", "validFrom", "validUntil", "quotedAt"
            )
        ),
        "price_fact_fk": "selection_candidate_price_fact_fk" in sql,
        "snapshot_price_fact_fk": "snapshot_price_selection_fact_fk" in sql,
        "requirement_assertion_fk": "selection_requirement_assertion_fk" in sql,
        "requirement_value_fk": "selection_requirement_value_fk" in sql,
        "catalog_event_fk": "selection_catalog_review_event_fk" in sql,
        "catalog_source_target_binding": (
            "source_revision_id,product_id," in compact(sql)
            and "REFERENCES app.catalog_source_revision" in sql
            and "source_target_digest" in sql
        ),
        "professional_result_fk": "professional_review_result_fk" in sql,
        "professional_event_fk": "professional_event_review_result_fk" in sql,
        "professional_decision_mapping": "professional_event_decision_r3" in sql,
        "professional_basis_digest": "professional_basis_digest_v1" in sql,
        "role_attributes": all(
            token in sql for token in (
                "NOT r.rolcreatedb", "NOT r.rolcreaterole",
                "NOT r.rolbypassrls", "NOT r.rolinherit", "NOT r.rolreplication"
            )
        ),
        "recursive_role_closure": "WITH RECURSIVE reachable" in sql,
        "membership_options": all(
            token in sql for token in ("inherit_option", "set_option", "admin_option")
        ),
        "direct_connect": "direct database CONNECT" in sql,
        "database_owner_rejected": (
            "datdba<>v_role" in compact(sql)
            or "datdba is distinct from v_role" in compact(sql)
        ),
        "protected_owner_closure_rejected": (
            "nspowner=v_role" in compact(sql)
            and "relowner=v_role" in compact(sql)
            and "proowner=v_role" in compact(sql)
        ),
        "bootstrap_markers": all(
            token in sql for token in (
                "bootstrap_prepare_r3", "bootstrap_record_approval_r3",
                "bootstrap_complete_root_r3", "bootstrap requires two distinct approvals"
            )
        ),
        "bootstrap_root_principal_binding": (
            "rootop.principal_id=st.root_principal_id" in compact(sql)
        ),
        "bootstrap_recovery": (
            "bootstrap_recover_root_r3" in sql
            and "bootstrap_rotate_root_r3" in sql
        ),
        "request_epoch": "ADD COLUMN epoch bigint" in sql,
        "request_replay_audit": "command_request_replay_audit_r3" in sql,
        "request_session_branch": "r.session_id<>p_session_id" in sql,
        "request_original_session_state_checked": (
            "original_session_id" in function_body(sql, "app_private.claim_command_request")
            and "trusted_session" in function_body(sql, "app_private.claim_command_request")
        ),
        "professional_review_truncate": "deny_professional_review_truncate_r3" in sql,
        "trusted_session_truncate": "deny_trusted_session_truncate_r3" in sql,
        "source_aux_pre_seal": "validate_selection_source_aux_r3" in sql,
        "source_aux_seal_call": "PERFORM app_private.validate_selection_source_aux_r3" in sql,
        "grant_revoke_found_check": (
            "authority grant missing" in sql
            and "authority grant already revoked" in sql
        ),
        "grant_active_scope_unique": "authority_grant_active_scope_unique_r3c8c" in sql,
        "c6_marker": (
            "4036" in sql
            and "7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB"
            in sql
        ),
    }
    return checks


def inventory(sql: str) -> dict[str, int]:
    table_names = {
        item.group(1).lower()
        for item in re.finditer(
            r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)", sql, re.I
        )
    }
    function_names = {
        item.group(1).lower()
        for item in re.finditer(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
            r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(",
            sql,
            re.I,
        )
    }
    trigger_names = {
        item.group(1).lower()
        for item in re.finditer(
            r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)",
            sql,
            re.I,
        )
    }
    role_names = {
        item.group(1).lower()
        for item in re.finditer(
            r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", sql, re.I
        )
    }
    return {
        "tables": len(table_names),
        "foreign_keys": len(parse_fks(sql)),
        "functions": len(function_names),
        "triggers": len(trigger_names),
        "roles": len(role_names),
    }


def main() -> int:
    here = Path(__file__).resolve()
    repo = here.parents[4]
    corrections = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections"
    manifest = corrections / "SHA256SUMS_R3_C8_CORRECTIONS.txt"
    ddl_path = corrections / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS.sql"
    sql = ddl_path.read_text(encoding="utf-8")
    manifest_lines = manifest.read_text(encoding="utf-8").splitlines()
    listed = []
    manifest_errors = []
    for line in manifest_lines:
        match = re.fullmatch(r"([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)", line)
        if not match:
            manifest_errors.append("format")
            continue
        relative = match.group(4).replace("\\", "/")
        listed.append(relative)
        path = repo / relative
        if not path.is_file():
            manifest_errors.append(f"missing:{relative}")
            continue
        payload = path.read_bytes()
        text = payload.decode("utf-8")
        if hashlib.sha256(payload).hexdigest().upper() != match.group(1).upper():
            manifest_errors.append(f"sha256:{relative}")
        if len(payload) != int(match.group(2)):
            manifest_errors.append(f"bytes:{relative}")
        if len(text.splitlines()) != int(match.group(3)):
            manifest_errors.append(f"lines:{relative}")
    actual = sorted(
        path.relative_to(repo).as_posix()
        for path in corrections.rglob("*")
        if path.is_file() and path != manifest
    )
    coverage = sorted(set(listed) ^ set(actual))
    checks = {
        "manifest_hash": hashlib.sha256(manifest.read_bytes()).hexdigest().upper() == EXPECTED_CORRECTIONS_MANIFEST,
        "manifest_records_24": len(manifest_lines) == 24,
        "manifest_unique_paths_24": len(set(listed)) == 24,
        "manifest_no_mismatch": not manifest_errors,
        "manifest_coverage": not coverage,
        **evaluate(sql),
    }
    fks = parse_fks(sql)
    # Full FK target verification requires table/key parsing; this arity check
    # is a regression signal, not a PostgreSQL Catalog claim.
    bad_fks = [fk for fk in fks if len(fk["source"]) != len(fk["target_columns"])]
    baseline_failures = {key for key, value in checks.items() if not value}
    mutations = {
        "price_canonical_amount_removed": (
            sql.replace("'amountMinor',p_amount_minor::text", "'removedAmount',p_amount_minor::text"),
            "price_canonical_complete",
        ),
        "price_row_amount_removed": (
            sql.replace("'amountMinor',p_row->>'amount_minor'", "'removedAmount',p_row->>'amount_minor'"),
            "price_row_payload_complete",
        ),
        "requirement_assertion_fk_removed": (
            sql.replace("selection_requirement_assertion_fk", "removed_requirement_assertion_fk"),
            "requirement_assertion_fk",
        ),
        "requirement_value_fk_removed": (
            sql.replace("selection_requirement_value_fk", "removed_requirement_value_fk"),
            "requirement_value_fk",
        ),
        "catalog_event_fk_removed": (
            sql.replace("selection_catalog_review_event_fk", "removed_catalog_event_fk"),
            "catalog_event_fk",
        ),
        "professional_event_fk_removed": (
            sql.replace("professional_event_review_result_fk", "removed_professional_event_fk"),
            "professional_event_fk",
        ),
        "role_recursion_removed": (
            sql.replace("WITH RECURSIVE reachable", "WITH removed_recursion"),
            "recursive_role_closure",
        ),
        "direct_connect_check_removed": (
            sql.replace("direct database CONNECT", "removed_connect_check"),
            "direct_connect",
        ),
        "request_epoch_removed": (
            sql.replace("ADD COLUMN epoch bigint", "ADD COLUMN removed_epoch bigint"),
            "request_epoch",
        ),
        "professional_truncate_removed": (
            sql.replace("deny_professional_review_truncate_r3", "removed_review_truncate"),
            "professional_review_truncate",
        ),
        "trusted_session_truncate_removed": (
            sql.replace("deny_trusted_session_truncate_r3", "removed_session_truncate"),
            "trusted_session_truncate",
        ),
        "source_aux_call_removed": (
            sql.replace(
                "PERFORM app_private.validate_selection_source_aux_r3",
                "PERFORM removed_source_aux"
            ),
            "source_aux_seal_call",
        ),
        "grant_missing_check_removed": (
            sql.replace("authority grant missing", "removed_grant_missing_check"),
            "grant_revoke_found_check",
        ),
    }
    mutation_results = {}
    for name, (value, target_check) in mutations.items():
        value_checks = evaluate(value)
        new_failures = sorted(baseline_failures.symmetric_difference(
            {key for key, ok in value_checks.items() if not ok}
        ))
        mutation_results[name] = {
            "target_check": target_check,
            "detected": target_check in new_failures,
            "new_failures": new_failures,
        }
    object_inventory = inventory(sql)
    result = {
        "review": "FULL-MVP-REMEDIATION-REVIEW-R3-C8-CORRECTIONS",
        "scope": "INDEPENDENT STATIC REVIEW; CORRECTIONS TOOL NOT EXECUTED",
        "manifest": {
            "sha256": hashlib.sha256(manifest.read_bytes()).hexdigest().upper(),
            "records": len(manifest_lines),
            "unique_paths": len(set(listed)),
            "mismatches": len(manifest_errors),
            "coverage_differences": len(coverage),
        },
        "checks": checks,
        "failed_checks": [key for key, value in checks.items() if not value],
        "foreign_key_count": len(fks),
        "fk_arity_errors": bad_fks,
        "object_inventory": object_inventory,
        "mutations": mutation_results,
        "all_mutations_detected": all(item["detected"] for item in mutation_results.values()),
        "postgresql_grammar": "NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_execution": "NOT EXECUTED — DATABASE NOT AUTHORIZED",
    }
    output = here.parent / "INDEPENDENT_REVIEW_EVIDENCE_R3_C8_CORRECTIONS.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "manifest": result["manifest"],
        "failed_checks": result["failed_checks"],
        "foreign_keys": len(fks),
        "fk_arity_errors": len(bad_fks),
        "object_inventory": object_inventory,
        "mutations_detected": sum(item["detected"] for item in mutation_results.values()),
        "mutations_total": len(mutation_results),
        "output": str(output),
        "result": "PASS" if not result["failed_checks"] and not bad_fks and result["all_mutations_detected"] else "FAIL",
    }, indent=2))
    return 0 if not result["failed_checks"] and not bad_fks and result["all_mutations_detected"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
