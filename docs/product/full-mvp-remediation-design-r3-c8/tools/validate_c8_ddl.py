"""Independent static consistency check for the R3-C8 design DDL."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def n(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def split_args(value: str) -> list[str]:
    return [n(item) for item in value.split(",") if item.strip()]


def sig(name: str, args: str) -> str:
    types = []
    for item in split_args(args):
        parts = item.split()
        types.append(" ".join(parts[1:]) if len(parts) > 1 else item)
    return f"{name.lower()}({', '.join(types)})"


def main() -> int:
    if len(sys.argv) != 4:
        raise SystemExit("usage: validate_c8_ddl.py <ddl> <registry.json> <output.json>")
    ddl_path, registry_path, output_path = map(Path, sys.argv[1:])
    sql = ddl_path.read_text(encoding="utf-8")
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    findings: list[dict[str, object]] = []

    role_pattern = re.compile(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", re.I)
    roles = {m.group(1).lower() for m in role_pattern.finditer(sql)}

    table_pattern = re.compile(
        r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*\((.*?)\n\);",
        re.I | re.S,
    )
    tables: dict[str, set[str]] = {}
    table_keys: dict[str, set[tuple[str, ...]]] = {}
    for match in table_pattern.finditer(sql):
        table = match.group(1).lower()
        columns: set[str] = set()
        for line in match.group(2).splitlines():
            m = re.match(r"\s*([a-z_][a-z0-9_]*)\s+", line, re.I)
            if m and m.group(1).lower() not in {
                "constraint", "primary", "foreign", "unique", "check", "exclude"
            }:
                columns.add(m.group(1).lower())
        tables[table] = columns
        keys = {
            tuple(item.strip().lower() for item in key.split(",") if item.strip())
            for key in re.findall(
                r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",
                match.group(2),
                re.I,
            )
        }
        for column in re.findall(
            r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",
            match.group(2),
            re.I | re.M,
        ):
            keys.add((column.lower(),))
        table_keys[table] = keys

    alter_table_pattern = re.compile(
        r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*(.*?);",
        re.I | re.S,
    )
    for match in alter_table_pattern.finditer(sql):
        table = match.group(1).lower()
        body = match.group(2)
        for column in re.findall(r"ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)", body, re.I):
            tables.setdefault(table, set()).add(column.lower())
        table_keys.setdefault(table, set())
        table_keys[table] |= {
            tuple(item.strip().lower() for item in key.split(",") if item.strip())
            for key in re.findall(
                r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",
                body,
                re.I,
            )
        }

    foreign_keys: list[dict[str, object]] = []
    for match in re.finditer(
        r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
        r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
        sql,
        re.I | re.S,
    ):
        source = tuple(
            item.strip().lower() for item in match.group(1).split(",") if item.strip()
        )
        target_table = match.group(2).lower()
        target = tuple(
            item.strip().lower() for item in match.group(3).split(",") if item.strip()
        )
        foreign_keys.append({
            "source": source,
            "target_table": target_table,
            "target": target,
        })
        if len(source) != len(target):
            findings.append({
                "type": "FK_COLUMN_COUNT_MISMATCH",
                "source_columns": list(source),
                "target_table": target_table,
                "target_columns": list(target),
            })
        if target_table not in tables:
            findings.append({
                "type": "FK_TARGET_TABLE_MISSING",
                "target_table": target_table,
            })
        elif target not in table_keys.get(target_table, set()):
            findings.append({
                "type": "FK_TARGET_KEY_MISSING",
                "target_table": target_table,
                "target_columns": list(target),
            })

    function_pattern = re.compile(
        r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+RETURNS\b",
        re.I | re.S,
    )
    ddl_functions = {
        sig(m.group(1), m.group(2)) for m in function_pattern.finditer(sql)
    }
    registry_functions = {item["signature"] for item in registry["functions"]}
    if ddl_functions != registry_functions:
        findings.append({
            "type": "FUNCTION_REGISTRY_MISMATCH",
            "missing_in_registry": sorted(ddl_functions - registry_functions),
            "missing_in_ddl": sorted(registry_functions - ddl_functions),
        })
    if registry.get("call_graph_status") != "PASS":
        findings.append({
            "type": "FUNCTION_CALL_GRAPH_NOT_PASS",
            "status": registry.get("call_graph_status"),
            "unresolved": registry.get("unresolved_call_targets", []),
        })

    owner_pattern = re.compile(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        re.I | re.S,
    )
    owner_by_sig: dict[str, str] = {}
    for match in owner_pattern.finditer(sql):
        owner_by_sig[sig(match.group(1), match.group(2))] = match.group(3).lower()
    for item in registry["functions"]:
        key = item["signature"]
        if owner_by_sig.get(key) != item["owner"]:
            findings.append({"type": "FUNCTION_OWNER_MISMATCH", "object": key})
        if item["security"] == "DEFINER" and (
            not item["search_path"] or "pg_catalog" not in item["search_path"].split(",")[0]
        ):
            findings.append({"type": "UNSAFE_SEARCH_PATH", "object": key})

    usage_roles: set[str] = set()
    for usage_match in re.finditer(
        r"GRANT\s+USAGE\s+ON\s+SCHEMA\s+app\s+TO\s+(.*?);",
        sql,
        re.I | re.S,
    ):
        usage_roles |= {n(item) for item in usage_match.group(1).split(",")}
    required_usage = {
        "elevator_table_owner",
        "elevator_review_function_owner",
        "elevator_identity_broker",
    }
    if not required_usage.issubset(usage_roles):
        findings.append({
            "type": "MISSING_OWNER_BROKER_SCHEMA_USAGE",
            "missing": sorted(required_usage - usage_roles),
        })

    owned_tables = {
        item.group(1).lower()
        for item in re.finditer(
            r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s+OWNER\s+TO\s+elevator_table_owner",
            sql,
            re.I,
        )
    }
    missing_table_owners = sorted(set(tables) - owned_tables)
    if missing_table_owners:
        findings.append({
            "type": "MISSING_TABLE_OWNER",
            "tables": missing_table_owners,
        })

    review_dml_pattern = re.compile(
        r"GRANT\s+SELECT\s*,\s*INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+"
        r"ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+app\s+TO\s+"
        r"elevator_review_function_owner\s*;",
        re.I,
    )
    sequence_pattern = re.compile(
        r"GRANT\s+USAGE\s*,\s*SELECT\s*,\s*UPDATE\s+"
        r"ON\s+ALL\s+SEQUENCES\s+IN\s+SCHEMA\s+app\s+TO\s+"
        r"elevator_review_function_owner\s*;",
        re.I,
    )
    if not review_dml_pattern.search(sql):
        findings.append({"type": "MISSING_REVIEW_OWNER_TABLE_DML"})
    if not sequence_pattern.search(sql):
        findings.append({"type": "MISSING_REVIEW_OWNER_SEQUENCE_RIGHTS"})

    if "target.principal_id IS DISTINCT FROM p_subject_principal_id" in sql:
        findings.append({"type": "GRANT_RECIPIENT_SUBJECT_CONFLATION"})
    if "non-audit grant cannot carry subject scope" not in sql:
        findings.append({"type": "MISSING_NON_AUDIT_SUBJECT_SCOPE_CHECK"})
    if sql.count("g.object_scope='GLOBAL'") < 2:
        findings.append({"type": "GRANT_SCOPE_MATCHING_INCOMPLETE"})
    for scope in ("GLOBAL", "PROJECT", "POLICY", "PRINCIPAL"):
        if f"object_scope='{scope}'" not in sql:
            findings.append({
                "type": "MISSING_GRANT_OBJECT_SCOPE",
                "scope": scope,
            })

    prohibited_roles = {
        "elevator_identity_broker",
        "elevator_runtime_web",
        "elevator_runtime_worker",
        "elevator_professional_reviewer",
        "elevator_policy_author",
        "elevator_policy_reviewer",
        "elevator_security_admin",
        "elevator_readonly_auditor",
        "elevator_reporting_readonly",
        "elevator_session_bootstrap",
    }
    for match in re.finditer(
        r"GRANT\s+[^;]*?\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+app\s+TO\s+([^;]+);",
        sql,
        re.I | re.S,
    ):
        granted_roles = {
            n(item) for item in match.group(1).split(",") if item.strip()
        }
        if granted_roles & prohibited_roles:
            findings.append({
                "type": "RUNTIME_ALL_TABLE_GRANT",
                "roles": sorted(granted_roles & prohibited_roles),
            })

    direct_table_grants: list[tuple[str, set[str]]] = []
    table_names = set(tables)
    for match in re.finditer(
        r"GRANT\s+[^;]*?\s+ON\s+([^;]+?)\s+TO\s+([^;]+);",
        sql,
        re.I | re.S,
    ):
        objects = {
            n(item) for item in match.group(1).split(",") if item.strip()
        }
        if objects & table_names:
            direct_table_grants.append((match.group(0), objects & table_names))
    for statement, granted_tables in direct_table_grants:
        granted_roles = {
            role for role in prohibited_roles if re.search(
                rf"\b{re.escape(role)}\b", statement, re.I
            )
        }
        if granted_roles:
            findings.append({
                "type": "RUNTIME_BASE_TABLE_GRANT",
                "tables": sorted(granted_tables),
                "roles": sorted(granted_roles),
            })

    required_functions = {
        "app.register_session_role(text, text, text, text)",
        "app.activate_trusted_session(text, text)",
        "app.create_selection_run(text, text, text, bigint, text, text)",
        "app.add_selection_candidate(text, text, text, text, text, text)",
        "app.set_selection_candidate_price(text, text, text, text)",
        "app.set_selection_candidate_parameter(text, text, text, text)",
        "app.complete_selection_candidate_result(text, text, text, text, text, text, text, text, text)",
        "app.record_selection_requirement_field(text, text, text, jsonb, text, text, text, text, text, text, boolean, text, text, text, text, text)",
        "app.record_selection_source_result(text, text, text, text)",
        "app.record_selection_catalog_review_result(text, text, text, text, text, text, timestamptz, text, text)",
        "app.record_selection_professional_review_result(text, text, text, bigint, text, text, text, text, timestamptz, text, text)",
        "app.record_selection_warning_result(text, text, bigint, text, text, text, text, text, text)",
        "app.record_selection_missing_field_result(text, text, text, text, text, text, text)",
        "app.create_professional_review(text, text, text, text, text, text, text, text, text, text, text)",
    }
    missing_functions = sorted(required_functions - ddl_functions)
    if missing_functions:
        findings.append({"type": "MISSING_C8_BUSINESS_FUNCTIONS", "functions": missing_functions})

    required_columns = {
        "app.trusted_session": {"binding_state", "backend_pid", "backend_started_at"},
        "app.sales_snapshot_candidate_r3": {
            "result_row_digest", "project_id", "conversation_id",
            "requirement_id", "requirement_version_id", "installation_scenario",
        },
        "app.sales_snapshot_requirement_field_r3": {"source_row_digest"},
        "app.sales_snapshot_source_r3": {"source_row_digest"},
        "app.sales_snapshot_warning_r3": {"source_row_digest"},
        "app.sales_snapshot_missing_field_r3": {"source_row_digest"},
    }
    for table, expected in required_columns.items():
        missing = expected - tables.get(table, set())
        if missing:
            findings.append({
                "type": "MISSING_C8_COLUMNS",
                "table": table,
                "columns": sorted(missing),
            })

    required_digest_fks = {
        (
            ("selection_result_item_id", "candidate_id", "selection_run_id", "result_row_digest"),
            "app.selection_candidate_result",
            ("id", "candidate_id", "selection_run_id", "row_digest"),
        ),
        (
            ("selection_run_id", "requirement_version_id", "field_key", "source_row_digest"),
            "app.selection_requirement_field",
            ("selection_run_id", "requirement_version_id", "field_key", "row_digest"),
        ),
        (
            ("selection_run_id", "source_revision_id", "source_row_digest"),
            "app.selection_source_result",
            ("selection_run_id", "source_revision_id", "row_digest"),
        ),
        (
            ("selection_run_id", "catalog_review_id", "source_row_digest"),
            "app.selection_catalog_review_result",
            ("selection_run_id", "catalog_review_id", "row_digest"),
        ),
        (
            (
                "selection_run_id", "professional_review_id",
                "event_sequence", "source_row_digest",
            ),
            "app.selection_professional_review_result",
            (
                "selection_run_id", "professional_review_id",
                "event_sequence", "row_digest",
            ),
        ),
        (
            ("selection_run_id", "candidate_id", "warning_sequence", "source_row_digest"),
            "app.selection_warning_result",
            ("selection_run_id", "candidate_id", "warning_sequence", "row_digest"),
        ),
        (
            ("selection_run_id", "candidate_id", "field_key", "source_row_digest"),
            "app.selection_missing_field_result",
            ("selection_run_id", "candidate_id", "field_key", "row_digest"),
        ),
        (
            ("candidate_id", "parameter_key", "source_row_digest"),
            "app.selection_candidate_parameter",
            ("candidate_id", "parameter_key", "row_digest"),
        ),
        (
            ("candidate_id", "price_revision_id", "source_row_digest"),
            "app.selection_candidate_price",
            ("candidate_id", "price_revision_id", "row_digest"),
        ),
    }
    actual_fks = {
        (tuple(item["source"]), item["target_table"], tuple(item["target"]))
        for item in foreign_keys
    }
    missing_digest_fks = [
        {
            "source_columns": list(source),
            "target_table": target_table,
            "target_columns": list(target),
        }
        for source, target_table, target in sorted(required_digest_fks)
        if (source, target_table, target) not in actual_fks
    ]
    if missing_digest_fks:
        findings.append({
            "type": "MISSING_EXACT_DIGEST_FKS",
            "foreign_keys": missing_digest_fks,
        })

    required_triggers = {
        "a_compute_selection_requirement_digest",
        "a_compute_selection_source_digest",
        "a_compute_selection_catalog_review_digest",
        "a_compute_selection_professional_review_digest",
        "a_compute_selection_warning_digest",
        "a_compute_selection_missing_digest",
        "a_compute_selection_price_digest",
        "a_compute_selection_parameter_digest",
        "a_compute_selection_result_digest",
        "a_verify_snapshot_candidate_digest",
        "a_verify_snapshot_requirement_digest",
        "a_verify_snapshot_source_digest",
        "a_verify_snapshot_catalog_review_digest",
        "a_verify_snapshot_professional_review_digest",
        "a_verify_snapshot_warning_digest",
        "a_verify_snapshot_missing_digest",
        "a_verify_snapshot_parameter_digest",
        "a_verify_snapshot_price_digest",
    }
    trigger_names = set(re.findall(r"CREATE\s+TRIGGER\s+([a-z_][a-z0-9_]*)", sql, re.I))
    missing_triggers = sorted(required_triggers - {item.lower() for item in trigger_names})
    if missing_triggers:
        findings.append({"type": "MISSING_C8_DIGEST_TRIGGERS", "triggers": missing_triggers})

    truncate_tables = {
        item.group(1).lower()
        for item in re.finditer(
            r"BEFORE\s+TRUNCATE\s+ON\s+(app\.[a-z_][a-z0-9_]*)",
            sql,
            re.I,
        )
    }
    required_truncate_tables = {
        "app.selection_run",
        "app.selection_candidate",
        "app.selection_candidate_result",
        "app.selection_candidate_price",
        "app.selection_candidate_parameter",
        "app.selection_run_seal",
        "app.selection_requirement_field",
        "app.selection_source_result",
        "app.selection_catalog_review_result",
        "app.selection_professional_review_result",
        "app.selection_warning_result",
        "app.selection_missing_field_result",
        "app.policy_current",
        "app.authority_grant",
        "app.session_role_registry",
        "app.command_request",
    }
    missing_truncate_guards = sorted(required_truncate_tables - truncate_tables)
    if missing_truncate_guards:
        findings.append({
            "type": "MISSING_TRUNCATE_GUARDS",
            "tables": missing_truncate_guards,
        })

    decimal_fragment = (
        "char_length(regexp_replace(v_field->>'value','[-.]','','g')) > 18"
    )
    if n(decimal_fragment) not in n(sql):
        findings.append({"type": "MISSING_SQL_DECIMAL_PRECISION_CHECK"})
    if "NOT app_private.r6_field_allowed" not in sql:
        findings.append({"type": "MISSING_EXACT_HEADER_TYPE_CHECK"})

    stable_key_match = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.stable_key_r3"
        r".*?(?=\nCREATE\s)",
        sql,
        re.I | re.S,
    )
    if not stable_key_match:
        findings.append({"type": "MISSING_STABLE_KEY_FUNCTION"})
    else:
        stable_body = stable_key_match.group(0)
        expected_arity = (
            "WHEN 0 THEN 1 WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 2 "
            "WHEN 4 THEN 2 WHEN 5 THEN 1 WHEN 6 THEN 1 WHEN 7 THEN 2 "
            "WHEN 8 THEN 2 WHEN 9 THEN 2"
        )
        if n(expected_arity) not in n(stable_body):
            findings.append({"type": "STABLE_KEY_ARITY_MISMATCH"})

    field_allowed_match = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app_private\.r6_field_allowed"
        r".*?(?=\nCREATE\s)",
        sql,
        re.I | re.S,
    )
    if not field_allowed_match:
        findings.append({"type": "MISSING_HEADER_TYPE_FUNCTION"})
    else:
        field_allowed_body = field_allowed_match.group(0)
        record_cases = {
            int(value)
            for value in re.findall(r"\bWHEN\s+([0-9]+)\s+THEN", field_allowed_body)
        }
        if record_cases != set(range(10)):
            findings.append({
                "type": "HEADER_TYPE_RECORD_COVERAGE",
                "record_types": sorted(record_cases),
            })

    source_key_match = re.search(
        r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+app\.source_key_r3"
        r".*?(?=\nCREATE\s)",
        sql,
        re.I | re.S,
    )
    if not source_key_match or "normalize(p_source_aux_text,NFC)" not in source_key_match.group(0):
        findings.append({"type": "MISSING_SOURCE_KEY_NFC_NORMALIZATION"})

    if re.search(r"app\.<|app_private\.<|BEGIN\s*\.\.\.\s*END", sql, re.I):
        findings.append({"type": "PLACEHOLDER_DETECTED"})

    output = {
        "tables": len(tables),
        "functions": len(ddl_functions),
        "roles": len(roles),
        "foreign_keys": len(foreign_keys),
        "required_digest_foreign_keys": len(required_digest_fks),
        "table_owner_assignments": len(owned_tables),
        "truncate_guarded_tables": len(truncate_tables),
        "function_call_targets": len({
            called
            for item in registry["functions"]
            for called in item.get("calls", [])
        }),
        "missing_business_functions": missing_functions,
        "missing_digest_triggers": missing_triggers,
        "findings": findings,
        "result": "PASS" if not findings else "FAIL",
        "scope": "STATIC TEXT CONSISTENCY ONLY; NO SQL PARSER OR DATABASE EXECUTION",
    }
    output_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))
    return 0 if not findings else 1


if __name__ == "__main__":
    raise SystemExit(main())
