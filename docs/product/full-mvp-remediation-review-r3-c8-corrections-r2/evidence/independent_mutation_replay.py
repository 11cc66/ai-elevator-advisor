"""Independent replay of the 12 submitted R2 DDL mutations."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from review_guard import require_guard


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def checks(sql: str) -> dict[str, bool]:
    body = compact(sql)
    return {
        "root_operator_state_principal_equality":
            "principal_id=st.root_principal_id" in body,
        "root_grant_recipient_binding":
            "check (root_principal_id=issuer_principal_id)" in body,
        "bootstrap_recovery_functions": all(
            token in body for token in (
                "create or replace function app.bootstrap_begin_root_change_r2",
                "create or replace function app.bootstrap_approve_root_change_r2",
                "create or replace function app.bootstrap_execute_root_change_r2",
            )
        ),
        "database_owner_rejected": "v_database_owner=v_role_oid" in body,
        "schema_owner_rejected": "n.nspowner=v_role_oid" in body,
        "relation_owner_rejected": "c.relowner=v_role_oid" in body,
        "function_owner_rejected": "p.proowner=v_role_oid" in body,
        "catalog_binding_table":
            "create table app.catalog_source_target_binding_r2" in body,
        "catalog_event_digest_v2":
            "catalog_review_event_payload_v2" in body
            and "sourcetargetbindingdigest" in body,
        "original_session_state_checked":
            "if orig.state='active'" in body
            and "or orig.termination_class not in" in body,
        "field_domain_selection_trigger":
            "create trigger a_validate_selection_requirement_domain_r2" in body,
        "bootstrap_audit_truncate_guard":
            "create trigger deny_bootstrap_event_truncate_r2" in body,
    }


def main() -> int:
    guard = require_guard()
    review_root = Path(__file__).resolve().parents[1]
    repo = review_root.parents[2]
    ddl_path = (
        repo
        / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"
        / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R2.sql"
    )
    sql = ddl_path.read_text(encoding="utf-8")
    baseline = checks(sql)
    mutations = {
        "root_principal_binding_removed": (
            sql.replace("principal_id=st.root_principal_id", "principal_id=rootop.principal_id"),
            "root_operator_state_principal_equality",
        ),
        "root_grant_recipient_binding_removed": (
            sql.replace(
                "CHECK (root_principal_id=issuer_principal_id)",
                "CHECK (true)",
            ),
            "root_grant_recipient_binding",
        ),
        "bootstrap_recovery_removed": (
            sql
            .replace(
                "CREATE OR REPLACE FUNCTION app.bootstrap_begin_root_change_r2",
                "CREATE OR REPLACE FUNCTION app.removed_begin_root_change_r2",
            )
            .replace(
                "CREATE OR REPLACE FUNCTION app.bootstrap_approve_root_change_r2",
                "CREATE OR REPLACE FUNCTION app.removed_approve_root_change_r2",
            )
            .replace(
                "CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r2",
                "CREATE OR REPLACE FUNCTION app.removed_execute_root_change_r2",
            ),
            "bootstrap_recovery_functions",
        ),
        "database_owner_check_removed": (
            sql.replace("IF v_database_owner=v_role_oid", "IF false"),
            "database_owner_rejected",
        ),
        "schema_owner_check_removed": (
            sql.replace("AND (n.nspowner=v_role_oid", "AND (false"),
            "schema_owner_rejected",
        ),
        "relation_owner_check_removed": (
            sql.replace("AND (c.relowner=v_role_oid", "AND (false"),
            "relation_owner_rejected",
        ),
        "function_owner_check_removed": (
            sql.replace("AND (p.proowner=v_role_oid", "AND (false"),
            "function_owner_rejected",
        ),
        "catalog_source_target_table_removed": (
            sql.replace(
                "CREATE TABLE app.catalog_source_target_binding_r2",
                "CREATE TABLE app.removed_catalog_source_target_binding_r2",
            ),
            "catalog_binding_table",
        ),
        "catalog_event_digest_target_removed": (
            sql.replace(
                "'sourceTargetBindingDigest',p_row->>'source_target_binding_digest'",
                "'removedBindingDigest',''",
            ),
            "catalog_event_digest_v2",
        ),
        "original_session_check_removed": (
            sql.replace("IF orig.state='ACTIVE'", "IF false"),
            "original_session_state_checked",
        ),
        "field_domain_trigger_removed": (
            sql.replace(
                "CREATE TRIGGER a_validate_selection_requirement_domain_r2",
                "CREATE TRIGGER removed_selection_domain_r2",
            ),
            "field_domain_selection_trigger",
        ),
        "bootstrap_audit_guard_removed": (
            sql.replace(
                "CREATE TRIGGER deny_bootstrap_event_truncate_r2",
                "CREATE TRIGGER removed_bootstrap_truncate_r2",
            ),
            "bootstrap_audit_truncate_guard",
        ),
    }
    evidence = []
    for mutation_id, (mutated_sql, target) in mutations.items():
        mutated = checks(mutated_sql)
        changed = {
            key for key in baseline
            if baseline[key] != mutated[key]
        }
        evidence.append({
            "id": mutation_id,
            "target_check": target,
            "original_input_sha256": hashlib.sha256(ddl_path.read_bytes()).hexdigest().upper(),
            "target_was_true": baseline[target],
            "target_now_false": not mutated[target],
            "changed_checks": sorted(changed),
            "detected": baseline[target] and not mutated[target],
        })
    result = {
        "scope": "INDEPENDENT REPLAY OF SUBMITTED 12 TEXT MUTATIONS",
        "guard": guard,
        "mutations_total": len(evidence),
        "mutations_detected": sum(item["detected"] for item in evidence),
        "all_detected": all(item["detected"] for item in evidence),
        "coverage_note": (
            "These mutations only validate the submitted marker checks. "
            "They do not prove FK target-key validity, default ACLs, "
            "transaction ordering or Runtime behavior."
        ),
        "evidence": evidence,
    }
    out = review_root / "evidence" / "MUTATION_REPLAY_EVIDENCE_R3_C8_CORRECTIONS_R2_REVIEW.json"
    out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "mutations_detected": result["mutations_detected"],
        "mutations_total": result["mutations_total"],
        "all_detected": result["all_detected"],
        "output": str(out),
    }, indent=2))
    return 0 if result["all_detected"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
