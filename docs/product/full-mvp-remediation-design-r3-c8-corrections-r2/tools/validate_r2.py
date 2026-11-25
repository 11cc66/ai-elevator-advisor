"""Fail-closed static validation and targeted mutation testing for R2."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from guard import require_guarded_context


EXPECTED = {
    "corrections_manifest": "0ACBBB3A4CB5F0439302E7F7109F0ECFDCFDE50843D74941E232F830ECE552A2",
    "review_manifest": "E71FA990581B70357F3D4103C1BF29E442665DD695459C524CC723D41DA63465",
    "review_report": "05883B182F46F4E3BEC0A1C3AD7B95AE008A6D2CA0C7381120A8C5A8CD83C7CB",
}


DOC_NAMES = [
    "P1_PRODUCT_REMEDIATION_DESIGN_R3_C8_CORRECTIONS_R2.md",
    "DATABASE_ROLE_PRIVILEGE_MATRIX_R3_C8_CORRECTIONS_R2.md",
    "ROOT_PRINCIPAL_BINDING_R3_C8_R2.md",
    "OWNER_PRIVILEGE_CLOSURE_R3_C8_R2.md",
    "BOOTSTRAP_RECOVERY_AND_ROTATION_R3_C8_R2.md",
    "CATALOG_SOURCE_TARGET_BINDING_R3_C8_R2.md",
    "REQUEST_LEDGER_REVOCATION_AND_RECOVERY_R3_C8_R2.md",
    "REQUIREMENT_FIELDVALUE_DOMAIN_ALIGNMENT_R3_C8_R2.md",
    "EXECUTION_IDENTITY_GUARD_R3_C8_CORRECTIONS_R2.md",
    "P1_P2_P3_ACCEPTANCE_TEST_MATRIX_R3_C8_CORRECTIONS_R2.md",
    "R3_C8_FINDING_TRACEABILITY_CORRECTIONS_R2.md",
    "HISTORICAL_FINDING_CLOSURE_MATRIX_R3_C8_CORRECTIONS_R2.md",
    "OPEN_DECISIONS_DISPOSITION_R3_C8_CORRECTIONS_R2.md",
    "DESIGN_CHANGELOG_R3_C8_CORRECTIONS_R2.md",
]


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def parse_fks(sql: str) -> list[dict[str, object]]:
    result = []
    for match in re.finditer(
        r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
        r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
        sql,
        re.I | re.S,
    ):
        result.append({
            "source": tuple(
                compact(item) for item in match.group(1).split(",") if item.strip()
            ),
            "target": match.group(2).lower(),
            "target_columns": tuple(
                compact(item) for item in match.group(3).split(",") if item.strip()
            ),
        })
    return result


def evaluate(sql: str) -> dict[str, bool]:
    body = compact(sql)
    return {
        "root_operator_state_principal_equality": (
            "principal_id=st.root_principal_id" in body
        ),
        "root_operator_state_role_equality": (
            "role_name=st.root_role_name" in body
        ),
        "root_grant_recipient_binding": (
            "bootstrap_root_grant_r2" in body
            and "issuer_principal_id" in body
            and "root_principal_id" in body
            and "check (root_principal_id=issuer_principal_id)" in body
        ),
        "bootstrap_generation_fk": (
            "bootstrap_generation_r2" in body
            and "bootstrap_generation" in body
        ),
        "bootstrap_request_ledger": "bootstrap_request_ledger_r2" in body,
        "bootstrap_recovery_state_machine": all(
            token in body for token in (
                "seed_ready", "approval_pending", "root_issuance_pending",
                "bootstrap_completed", "recovery_pending", "recovery_approved",
                "root_rotation_pending", "root_rotated", "revoked", "locked"
            )
        ),
        "bootstrap_recovery_functions": all(
            token in body for token in (
                "create or replace function app.bootstrap_begin_root_change_r2",
                "create or replace function app.bootstrap_approve_root_change_r2",
                "create or replace function app.bootstrap_execute_root_change_r2"
            )
        ),
        "bootstrap_duplicate_approval_prevention": (
            "bootstrap_approval_r2" in body
            and "unique (bootstrap_id,bootstrap_generation,principal_id)" in body
        ),
        "database_owner_rejected": "v_database_owner=v_role_oid" in body,
        "pg_database_owner_semantics": "pg_database_owner" in body,
        "schema_owner_rejected": "n.nspowner=v_role_oid" in body,
        "relation_owner_rejected": "c.relowner=v_role_oid" in body,
        "function_owner_rejected": "p.proowner=v_role_oid" in body,
        "type_owner_rejected": "t.typowner=v_role_oid" in body,
        "recursive_membership": "with recursive reachable" in body,
        "membership_options": all(
            token in body
            for token in ("inherit_option", "set_option", "admin_option")
        ),
        "owner_catalog_completeness": (
            "protected owner catalog incomplete" in body
        ),
        "owner_closure_stability": (
            "owner closure changed during transaction" in body
        ),
        "catalog_binding_table": (
            "create table app.catalog_source_target_binding_r2" in body
        ),
        "catalog_product_source_fk": "product_revision_source_exact_unique_r2" in body,
        "catalog_spec_source_fk": "specification_revision_source_exact_unique_r2" in body,
        "catalog_price_source_fk": "price_revision_source_exact_unique_r2" in body,
        "catalog_binding_exact_fk": "catalog_binding_target_identity_unique_r2" in body,
        "catalog_event_binding_fk": "catalog_event_source_target_binding_fk_r2" in body,
        "catalog_event_digest_v2": (
            "catalog_review_event_payload_v2" in body
            and "sourcetargetbindingdigest" in body
        ),
        "catalog_selection_binding_fk": (
            "selection_catalog_source_target_binding_fk_r2" in body
        ),
        "catalog_snapshot_binding_fk": (
            "snapshot_catalog_source_target_binding_fk_r2" in body
        ),
        "session_termination_classes": all(
            token in body for token in (
                "normal_close", "natural_expiry", "credential_rotation",
                "epoch_advance", "admin_revoke", "security_revoke",
                "principal_disabled", "grant_revoked"
            )
        ),
        "original_session_state_checked": (
            "if orig.state='active'" in body
            and "or orig.termination_class not in" in body
        ),
        "ordinary_replay_fail_closed": (
            "ordinary cross-session replay denied" in body
        ),
        "controlled_result_recovery": (
            "command_result_recovery_r2" in body
            and "command_result_recovery_approval_r2" in body
        ),
        "recovery_two_approvals": "v_approvals>=2" in body,
        "recovery_execute_once": "state='consumed'" in body,
        "field_domain_function": "requirement_field_domain_valid_r2" in body,
        "field_domain_requirement_trigger": (
            "a_validate_requirement_field_domain_r2" in body
        ),
        "field_domain_selection_trigger": (
            "a_validate_selection_requirement_domain_r2" in body
        ),
        "field_domain_snapshot_trigger": (
            "a_validate_snapshot_requirement_domain_r2" in body
        ),
        "field_unit_shared_shape": "requirement_unit_shape_check_r2" in body,
        "trusted_session_truncate_guard": (
            "deny_trusted_session_truncate_r3" in body
        ),
        "review_truncate_guard": "deny_professional_review_truncate_r3" in body,
        "bootstrap_audit_truncate_guard": (
            "deny_bootstrap_event_truncate_r2" in body
        ),
        "catalog_binding_truncate_guard": (
            "deny_catalog_source_target_binding_truncate_r2" in body
        ),
        "c6_marker": (
            "4036" in body
            and "7d3cac885f839594006650cc500fef8a59d22ad151e6cb21567008d0d19519eb"
            in body
        ),
    }


def required_files_complete(paths: list[Path], exists=lambda path: path.is_file()) -> bool:
    return bool(paths) and all(exists(path) for path in paths)


def main() -> int:
    r2_root = Path(__file__).resolve().parents[1]
    guard = require_guarded_context(r2_root)
    repo = r2_root.parents[2]
    corrections = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections"
    review = repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections"
    ddl_path = r2_root / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql"
    registry_path = r2_root / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R2.json"
    required = [
        corrections / "SHA256SUMS_R3_C8_CORRECTIONS.txt",
        review / "SHA256SUMS_R3_C8_CORRECTIONS_REVIEW.txt",
        review / "INDEPENDENT_DESIGN_REVIEW_R3_C8_CORRECTIONS_REPORT.md",
        ddl_path,
        registry_path,
        *[r2_root / name for name in DOC_NAMES],
        r2_root / "tools" / "Invoke-R2GuardedTool.ps1",
        r2_root / "tools" / "guard.py",
    ]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise SystemExit(f"missing required R2 files: {missing}")
    input_hashes = {
        "corrections_manifest": sha256(required[0]),
        "review_manifest": sha256(required[1]),
        "review_report": sha256(required[2]),
    }
    input_ok = input_hashes == EXPECTED
    sql = ddl_path.read_text(encoding="utf-8")
    checks = evaluate(sql)
    checks["required_files_complete"] = required_files_complete(required)
    checks["missing_file_fails_closed"] = not required_files_complete(
        [r2_root / "DOES_NOT_EXIST.md"]
    )
    checks["input_hashes_match"] = input_ok
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    checks["registry_valid"] = (
        registry.get("function_count") == len(registry.get("functions", []))
        and not registry.get("missing_owners")
        and not registry.get("unresolved_call_targets")
    )
    fks = parse_fks(sql)
    checks["fk_arity_equal"] = all(
        len(item["source"]) == len(item["target_columns"]) for item in fks
    )
    tables = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)", sql, re.I
        )
    }
    triggers = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)", sql, re.I
        )
    }
    roles = {
        match.group(1).lower()
        for match in re.finditer(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", sql, re.I)
    }
    baseline_failures = {name for name, ok in checks.items() if not ok}
    mutations = {
        "root_principal_binding_removed": (
            sql.replace(
                "principal_id=st.root_principal_id",
                "principal_id=rootop.principal_id"
            ),
            "root_operator_state_principal_equality",
        ),
        "root_grant_recipient_binding_removed": (
            sql.replace(
                "CHECK (root_principal_id=issuer_principal_id)",
                "CHECK (true)"
            ),
            "root_grant_recipient_binding",
        ),
        "bootstrap_recovery_removed": (
            sql
            .replace(
                "CREATE OR REPLACE FUNCTION app.bootstrap_begin_root_change_r2",
                "CREATE OR REPLACE FUNCTION app.removed_bootstrap_begin_r2"
            )
            .replace(
                "CREATE OR REPLACE FUNCTION app.bootstrap_approve_root_change_r2",
                "CREATE OR REPLACE FUNCTION app.removed_bootstrap_approve_r2"
            )
            .replace(
                "CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r2",
                "CREATE OR REPLACE FUNCTION app.removed_bootstrap_execute_r2"
            ),
            "bootstrap_recovery_functions",
        ),
        "database_owner_check_removed": (
            sql.replace(
                "IF v_database_owner=v_role_oid",
                "IF false"
            ),
            "database_owner_rejected",
        ),
        "schema_owner_check_removed": (
            sql.replace(
                "AND (n.nspowner=v_role_oid",
                "AND (false"
            ),
            "schema_owner_rejected",
        ),
        "relation_owner_check_removed": (
            sql.replace(
                "AND (c.relowner=v_role_oid",
                "AND (false"
            ),
            "relation_owner_rejected",
        ),
        "function_owner_check_removed": (
            sql.replace(
                "AND (p.proowner=v_role_oid",
                "AND (false"
            ),
            "function_owner_rejected",
        ),
        "catalog_source_target_table_removed": (
            sql.replace(
                "CREATE TABLE app.catalog_source_target_binding_r2",
                "CREATE TABLE app.removed_catalog_source_target_binding_r2"
            ),
            "catalog_binding_table",
        ),
        "catalog_event_digest_target_removed": (
            sql.replace(
                "'sourceTargetBindingDigest',p_row->>'source_target_binding_digest'",
                "'removedBindingDigest',''"
            ),
            "catalog_event_digest_v2",
        ),
        "original_session_check_removed": (
            sql.replace(
                "IF orig.state='ACTIVE'",
                "IF false"
            ),
            "original_session_state_checked",
        ),
        "field_domain_trigger_removed": (
            sql.replace(
                "CREATE TRIGGER a_validate_selection_requirement_domain_r2",
                "CREATE TRIGGER removed_selection_domain_r2"
            ),
            "field_domain_selection_trigger",
        ),
        "bootstrap_audit_guard_removed": (
            sql.replace(
                "CREATE TRIGGER deny_bootstrap_event_truncate_r2",
                "CREATE TRIGGER removed_bootstrap_truncate_r2"
            ),
            "bootstrap_audit_truncate_guard",
        ),
    }
    mutation_evidence = []
    for mutation_id, (mutated, target_check) in mutations.items():
        mutated_checks = evaluate(mutated)
        new_failures = sorted(
            baseline_failures.symmetric_difference(
                {name for name, ok in mutated_checks.items() if not ok}
            )
        )
        mutation_evidence.append({
            "id": mutation_id,
            "original_input_sha256": sha256(ddl_path),
            "description": mutation_id.replace("_", " "),
            "location": "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql",
            "expected_check": target_check,
            "actual_detected": target_check in new_failures,
            "new_failures": new_failures,
            "false_positive": False,
            "missed": target_check not in new_failures,
        })
    failed = sorted(name for name, ok in checks.items() if not ok)
    mutation_failed = [
        item["id"] for item in mutation_evidence if not item["actual_detected"]
    ]
    result = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R2",
        "scope": "STATIC OFFLINE DESIGN VALIDATION; NOT POSTGRESQL PARSER/EXECUTION",
        "guard": guard,
        "input_hashes": input_hashes,
        "input_hashes_match": input_ok,
        "checks_total": len(checks),
        "checks_passed": sum(checks.values()),
        "checks": checks,
        "failed_checks": failed,
        "object_inventory": {
            "tables": len(tables),
            "foreign_keys": len(fks),
            "functions": registry.get("function_count"),
            "triggers": len(triggers),
            "roles": len(roles),
        },
        "fk_arity_errors": [
            item for item in fks
            if len(item["source"]) != len(item["target_columns"])
        ],
        "mutations_total": len(mutation_evidence),
        "mutations_detected": sum(
            item["actual_detected"] for item in mutation_evidence
        ),
        "mutation_evidence": mutation_evidence,
        "missing_file_negative_fixture": checks["missing_file_fails_closed"],
        "postgresql_grammar": "NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_execution": "NOT EXECUTED — DATABASE NOT AUTHORIZED",
        "result": "PASS" if not failed and not mutation_failed else "FAIL",
    }
    output = r2_root / "evidence" / "VALIDATION_R3_C8_CORRECTIONS_R2.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "checks_passed": result["checks_passed"],
        "checks_total": result["checks_total"],
        "failed_checks": failed,
        "object_inventory": result["object_inventory"],
        "mutations_detected": result["mutations_detected"],
        "mutations_total": result["mutations_total"],
        "result": result["result"],
        "output": str(output),
    }, indent=2))
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
