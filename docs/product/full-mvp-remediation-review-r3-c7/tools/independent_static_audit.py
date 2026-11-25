"""Independent static audit of the R3-C7 DDL and manifest."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def split_columns(value: str) -> list[str]:
    return [normalize(item) for item in value.split(",")]


def parse_args(value: str) -> list[str]:
    result = []
    for argument in value.split(","):
        parts = normalize(argument).split()
        if not parts:
            continue
        result.append(" ".join(parts[1:]) if len(parts) > 1 else parts[0])
    return result


def signature(name: str, args: str) -> str:
    return f"{name.lower()}({', '.join(parse_args(args))})"


def main() -> int:
    if len(sys.argv) not in (4, 5):
        raise SystemExit("usage: independent_static_audit.py <design-dir> <ddl> <registry-json> [output.json]")
    design_dir = Path(sys.argv[1])
    ddl_path = Path(sys.argv[2])
    registry_path = Path(sys.argv[3])
    manifest_path = design_dir / "SHA256SUMS_R3_C7.txt"
    sql = ddl_path.read_text(encoding="utf-8")
    registry = json.loads(registry_path.read_text(encoding="utf-8"))

    findings: list[dict[str, object]] = []
    manifest_rows = []
    for line in manifest_path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^([0-9A-F]{64})\s+(\d+)\s+(\d+)\s+(.+)$", line)
        if not match:
            findings.append({"type": "MALFORMED_MANIFEST_LINE", "line": line})
            continue
        item = Path(match.group(4))
        expected_hash, expected_bytes, expected_lines = match.group(1), int(match.group(2)), int(match.group(3))
        actual_bytes = item.stat().st_size if item.exists() else -1
        actual_lines = len(item.read_text(encoding="utf-8").splitlines()) if item.exists() else -1
        actual_hash = sha256(item) if item.exists() else None
        if (actual_hash, actual_bytes, actual_lines) != (expected_hash, expected_bytes, expected_lines):
            findings.append({"type": "MANIFEST_MISMATCH", "path": str(item)})
        manifest_rows.append(str(item).replace("\\", "/"))
    actual_files = [
        str(path).replace("\\", "/")
        for path in design_dir.rglob("*")
        if path.is_file() and path != manifest_path
    ]
    if sorted(manifest_rows) != sorted(actual_files):
        findings.append({"type": "MANIFEST_COVERAGE_MISMATCH"})

    create_pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+RETURNS\b",
        re.IGNORECASE | re.DOTALL,
    )
    ddl_functions = {signature(match.group(1), match.group(2)) for match in create_pattern.finditer(sql)}
    registry_functions = {item["signature"] for item in registry["functions"]}
    if ddl_functions != registry_functions:
        findings.append({
            "type": "FUNCTION_REGISTRY_MISMATCH",
            "missing_in_registry": sorted(ddl_functions - registry_functions),
            "missing_in_ddl": sorted(registry_functions - ddl_functions),
        })

    owner_pattern = re.compile(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        re.IGNORECASE | re.DOTALL,
    )
    function_owners = {
        signature(match.group(1), match.group(2)): match.group(3).lower()
        for match in owner_pattern.finditer(sql)
    }
    registry_owner_mismatches = []
    for item in registry["functions"]:
        if function_owners.get(item["signature"]) != item["owner"]:
            registry_owner_mismatches.append(item["signature"])
    if registry_owner_mismatches:
        findings.append({"type": "FUNCTION_OWNER_REGISTRY_MISMATCH", "functions": registry_owner_mismatches})

    grant_pattern = re.compile(
        r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+TO\s+(.+?);",
        re.IGNORECASE | re.DOTALL,
    )
    ddl_grants: dict[str, set[str]] = {}
    for match in grant_pattern.finditer(sql):
        key = signature(match.group(1), match.group(2))
        ddl_grants[key] = {
            normalize(role) for role in match.group(3).split(",")
        }
    registry_grants = {
        item["signature"]: set(item["execute_roles"])
        for item in registry["functions"]
    }
    grant_mismatches = []
    for key in sorted(set(ddl_grants) | {key for key, roles in registry_grants.items() if roles}):
        if ddl_grants.get(key, set()) != registry_grants.get(key, set()):
            grant_mismatches.append({
                "signature": key,
                "ddl_roles": sorted(ddl_grants.get(key, set())),
                "registry_roles": sorted(registry_grants.get(key, set())),
            })
    if grant_mismatches:
        findings.append({"type": "FUNCTION_GRANT_REGISTRY_MISMATCH", "grants": grant_mismatches})

    schema_usage_match = re.search(
        r"GRANT\s+USAGE\s+ON\s+SCHEMA\s+app\s+TO\s+(.+?);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    schema_usage_roles = set()
    if schema_usage_match:
        schema_usage_roles = {
            normalize(item)
            for item in schema_usage_match.group(1).split(",")
        }
    required_owner_usage = {"elevator_review_function_owner", "elevator_table_owner"}
    missing_owner_usage = sorted(required_owner_usage - schema_usage_roles)
    if missing_owner_usage:
        findings.append({"type": "OWNER_ROLE_MISSING_SCHEMA_USAGE", "roles": missing_owner_usage})

    direct_owner_table_grants = re.findall(
        r"GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)"
        r".*?\bON\b.*?\bTO\s+(elevator_review_function_owner)\b",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if not direct_owner_table_grants:
        findings.append({
            "type": "SECURITY_DEFINER_OWNER_LACKS_EXPLICIT_TABLE_PRIVILEGE_GRANTS",
            "role": "elevator_review_function_owner",
        })

    if "GRANT USAGE ON SCHEMA app TO" in sql and "elevator_identity_broker" not in schema_usage_roles:
        findings.append({"type": "BROKER_MISSING_SCHEMA_USAGE", "role": "elevator_identity_broker"})

    open_session_match = re.search(
        r"CREATE FUNCTION app\.open_trusted_session(.*?)\n\$\$;",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if open_session_match:
        body = open_session_match.group(1)
        if not re.search(r"rolname\s+LIKE\s+'elevator_session", body, re.IGNORECASE):
            findings.append({
                "type": "SHARED_LOGIN_ROLE_ACCEPTED_AS_TRUSTED_SESSION_ROLE",
                "detail": "Only rolcanlogin, not superuser, and not bypassrls are checked.",
            })

    candidate_table = re.search(
        r"CREATE TABLE app\.sales_snapshot_candidate_r3\s*\((.*?)\n\);",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if candidate_table:
        block = candidate_table.group(1)
        candidate_result_fk = re.search(
            r"FOREIGN KEY\s*\((.*?)\)\s*REFERENCES\s+app\.selection_candidate_result\((.*?)\)",
            block,
            re.IGNORECASE | re.DOTALL,
        )
        if not candidate_result_fk:
            findings.append({"type": "SNAPSHOT_CANDIDATE_RESULT_FK_MISSING"})
        else:
            local = set(split_columns(candidate_result_fk.group(1)))
            needed = {
                "product_id", "product_revision_id", "product_revision_digest",
                "specification_revision_id", "specification_revision_digest",
                "rule_set_revision_id", "rule_set_content_digest",
            }
            missing = sorted(needed - local)
            if missing:
                findings.append({
                    "type": "SNAPSHOT_CANDIDATE_PROVENANCE_FK_IS_PARTIAL",
                    "missing_columns": missing,
                })

    create_paths = {
        "selection_run_insert": bool(re.search(r"INSERT\s+INTO\s+app\.selection_run\b", sql, re.IGNORECASE)),
        "selection_candidate_insert": bool(re.search(r"INSERT\s+INTO\s+app\.selection_candidate\b", sql, re.IGNORECASE)),
        "selection_result_insert": bool(re.search(r"INSERT\s+INTO\s+app\.selection_candidate_result\b", sql, re.IGNORECASE)),
        "professional_review_insert": bool(re.search(r"INSERT\s+INTO\s+app\.professional_review\b", sql, re.IGNORECASE)),
        "professional_initial_event_insert": bool(re.search(
            r"INSERT\s+INTO\s+app\.professional_review_event\b.*?'CREATED'",
            sql,
            re.IGNORECASE | re.DOTALL,
        )),
    }
    if not any(create_paths[key] for key in (
        "selection_run_insert", "selection_candidate_insert", "selection_result_insert"
    )):
        findings.append({"type": "NO_CONTROLLED_SELECTION_CREATION_PATH", "detail": create_paths})
    if not create_paths["professional_review_insert"] or not create_paths["professional_initial_event_insert"]:
        findings.append({"type": "NO_CONTROLLED_PROFESSIONAL_REVIEW_CREATION_PATH", "detail": create_paths})

    forbidden_create_grants = re.findall(
        r"GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|ALL)\s+ON\s+"
        r"(?:app\.|ALL TABLES IN SCHEMA app).*?TO\s+"
        r"(elevator_runtime_web|elevator_runtime_worker|elevator_policy_author|elevator_policy_reviewer|elevator_professional_reviewer)",
        sql,
        re.IGNORECASE | re.DOTALL,
    )
    if forbidden_create_grants:
        findings.append({"type": "BUSINESS_ROLE_DIRECT_DML_GRANT", "roles": forbidden_create_grants})

    trigger_tables = {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+\w+.*?\bON\s+(app\.[a-z_][a-z0-9_]*)",
            sql,
            re.IGNORECASE | re.DOTALL,
        )
    }
    required_snapshot_tables = {
        "app.sales_handoff_snapshot_r3",
        "app.snapshot_basis_metadata_r3",
        "app.sales_snapshot_requirement_field_r3",
        "app.sales_snapshot_candidate_r3",
        "app.sales_snapshot_parameter_r3",
        "app.sales_snapshot_price_r3",
        "app.sales_snapshot_source_r3",
        "app.sales_snapshot_catalog_review_r3",
        "app.sales_snapshot_professional_review_r3",
        "app.sales_snapshot_warning_r3",
        "app.sales_snapshot_missing_field_r3",
        "app.sales_snapshot_basis_record_r3",
    }
    if not required_snapshot_tables.issubset(trigger_tables):
        findings.append({
            "type": "MISSING_SNAPSHOT_TRIGGER_TABLE",
            "tables": sorted(required_snapshot_tables - trigger_tables),
        })

    output = {
        "manifest": {
            "sha256": sha256(manifest_path),
            "bytes": manifest_path.stat().st_size,
            "lines": len(manifest_path.read_text(encoding="utf-8").splitlines()),
            "records": len(manifest_rows),
            "unique_paths": len(set(manifest_rows)),
            "coverage_matches": sorted(manifest_rows) == sorted(actual_files),
        },
        "ddl_sha256": sha256(ddl_path),
        "ddl_bytes": ddl_path.stat().st_size,
        "functions_in_ddl": len(ddl_functions),
        "functions_in_registry": len(registry_functions),
        "schema_usage_roles": sorted(schema_usage_roles),
        "trigger_tables": sorted(trigger_tables),
        "create_paths": create_paths,
        "findings": findings,
        "result": "PASS" if not findings else "FAIL",
        "scope": "INDEPENDENT STATIC ANALYSIS ONLY; NO POSTGRESQL EXECUTION OR INTROSPECTION",
    }
    rendered = json.dumps(output, indent=2)
    if len(sys.argv) == 5:
        Path(sys.argv[4]).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0 if not findings else 1


if __name__ == "__main__":
    raise SystemExit(main())
