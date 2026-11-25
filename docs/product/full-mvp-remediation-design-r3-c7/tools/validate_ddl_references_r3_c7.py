"""Static lexical validation for the R3-C7 PostgreSQL design DDL."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def split_args(value: str) -> list[str]:
    if not value.strip():
        return []
    depth = 0
    current: list[str] = []
    parts: list[str] = []
    for character in value:
        if character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
        if character == "," and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(character)
    parts.append("".join(current))
    return [normalize(part) for part in parts]


def split_typed_args(args: list[str]) -> list[str]:
    types = []
    for argument in args:
        pieces = argument.split()
        if len(pieces) < 2:
            types.append(argument)
            continue
        typed = " ".join(pieces[1:])
        typed = re.sub(r"\s+default\s+.+$", "", typed)
        types.append(typed)
    return types


def signature_key(name: str, args: list[str]) -> str:
    return f"{name.lower()}({', '.join(split_typed_args(args))})"


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: validate_ddl_references_r3_c7.py <ddl.sql>")
    path = Path(sys.argv[1])
    sql = path.read_text(encoding="utf-8")
    findings: list[dict[str, str]] = []

    function_pattern = re.compile(
        r"CREATE\s+FUNCTION\s+(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)"
        r"\s*\((?P<args>.*?)\)\s*RETURNS\b",
        re.IGNORECASE | re.DOTALL,
    )
    functions: dict[str, dict[str, str]] = {}
    function_body: dict[str, str] = {}
    for match in function_pattern.finditer(sql):
        name = match.group("name").lower()
        args = split_args(match.group("args"))
        key = signature_key(name, args)
        if key in functions:
            findings.append({"type": "DUPLICATE_FUNCTION", "object": key})
        functions[key] = {"name": name, "args": args}
        body_start = match.end()
        next_create = sql.find("\nCREATE ", body_start)
        body_end = len(sql) if next_create < 0 else next_create
        function_body[key] = sql[body_start:body_end]

    role_pattern = re.compile(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", re.IGNORECASE)
    roles = {match.group(1).lower() for match in role_pattern.finditer(sql)}

    table_pattern = re.compile(
        r"CREATE\s+TABLE\s+(?P<name>app\.[a-z_][a-z0-9_]*)\s*\((?P<body>.*?)\n\);",
        re.IGNORECASE | re.DOTALL,
    )
    view_pattern = re.compile(r"CREATE\s+VIEW\s+(app\.[a-z_][a-z0-9_]*)", re.IGNORECASE)
    table_blocks: dict[str, str] = {}
    table_columns: dict[str, set[str]] = {}
    for match in table_pattern.finditer(sql):
        table_name = match.group("name").lower()
        table_blocks[table_name] = match.group("body")
        columns = set()
        for line in match.group("body").splitlines():
            stripped = line.strip()
            column_match = re.match(r"([a-z_][a-z0-9_]*)\s+", stripped, re.IGNORECASE)
            if not column_match:
                continue
            candidate = column_match.group(1).lower()
            if candidate in {
                "constraint", "primary", "foreign", "unique", "check", "exclude",
            }:
                continue
            columns.add(candidate)
        table_columns[table_name] = columns
    relations = {
        match.group("name").lower() for match in table_pattern.finditer(sql)
    } | {
        match.group(1).lower() for match in view_pattern.finditer(sql)
    }

    alteration_pattern = re.compile(
        r"ALTER\s+FUNCTION\s+(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)"
        r"\s*\((?P<args>.*?)\)\s+OWNER\s+TO\s+(?P<owner>[a-z_][a-z0-9_]*)",
        re.IGNORECASE | re.DOTALL,
    )
    owners: dict[str, list[str]] = {}
    for match in alteration_pattern.finditer(sql):
        key = signature_key(match.group("name"), split_args(match.group("args")))
        owners.setdefault(key, []).append(match.group("owner").lower())

    table_owner_pattern = re.compile(
        r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        re.IGNORECASE,
    )
    table_owners: dict[str, list[str]] = {}
    for match in table_owner_pattern.finditer(sql):
        table_owners.setdefault(match.group(1).lower(), []).append(match.group(2).lower())

    view_owner_pattern = re.compile(
        r"ALTER\s+VIEW\s+(app\.[a-z_][a-z0-9_]*)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        re.IGNORECASE,
    )
    view_owners: dict[str, list[str]] = {}
    for match in view_owner_pattern.finditer(sql):
        view_owners.setdefault(match.group(1).lower(), []).append(match.group(2).lower())

    grant_pattern = re.compile(
        r"(?:GRANT\s+EXECUTE|REVOKE\s+EXECUTE)\s+ON\s+FUNCTION\s+"
        r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)"
        r"\s*\((?P<args>.*?)\)",
        re.IGNORECASE | re.DOTALL,
    )
    grants: list[str] = []
    for match in grant_pattern.finditer(sql):
        grants.append(signature_key(match.group("name"), split_args(match.group("args"))))

    for key in functions:
        if key not in owners:
            findings.append({"type": "MISSING_OWNER", "object": key})
        elif len(owners[key]) != 1:
            findings.append({"type": "AMBIGUOUS_OWNER", "object": key})
        elif owners[key][0] not in roles:
            findings.append({"type": "UNKNOWN_OWNER_ROLE", "object": f"{key} -> {owners[key][0]}"})

    for table_name in table_columns:
        table_owner_list = table_owners.get(table_name, [])
        if len(table_owner_list) != 1:
            findings.append({"type": "MISSING_OR_AMBIGUOUS_TABLE_OWNER", "object": table_name})
        elif table_owner_list[0] not in roles:
            findings.append({"type": "UNKNOWN_TABLE_OWNER_ROLE", "object": table_name})

    view_names = {match.group(1).lower() for match in view_pattern.finditer(sql)}
    for view_name in view_names:
        view_owner_list = view_owners.get(view_name, [])
        if len(view_owner_list) != 1:
            findings.append({"type": "MISSING_OR_AMBIGUOUS_VIEW_OWNER", "object": view_name})
        elif view_owner_list[0] not in roles:
            findings.append({"type": "UNKNOWN_VIEW_OWNER_ROLE", "object": view_name})

    for key in grants:
        if key not in functions:
            findings.append({"type": "UNKNOWN_GRANT_SIGNATURE", "object": key})

    function_names = {details["name"] for details in functions.values()}
    call_pattern = re.compile(r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(", re.IGNORECASE)
    calls = Counter(match.group(1).lower() for match in call_pattern.finditer(sql))
    for name, count in calls.items():
        if name not in function_names and name not in relations:
            findings.append({"type": "UNDEFINED_FUNCTION_REFERENCE", "object": f"{name} ({count})"})

    relation_pattern = re.compile(
        r"\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+"
        r"(app\.[a-z_][a-z0-9_]*)",
        re.IGNORECASE,
    )
    for match in relation_pattern.finditer(sql):
        relation = match.group(1).lower()
        if relation not in relations:
            findings.append({"type": "UNDEFINED_RELATION_REFERENCE", "object": relation})

    fk_count = 0
    key_column_checks = 0
    fk_pattern = re.compile(
        r"FOREIGN\s+KEY\s*\((?P<local>[^)]*)\)\s*REFERENCES\s+"
        r"(?P<remote>app\.[a-z_][a-z0-9_]*)\s*\((?P<target>[^)]*)\)",
        re.IGNORECASE | re.DOTALL,
    )
    for table_name, block in table_blocks.items():
        for match in fk_pattern.finditer(block):
            fk_count += 1
            local_columns = [normalize(item) for item in match.group("local").split(",")]
            target_columns = [normalize(item) for item in match.group("target").split(",")]
            remote = match.group("remote").lower()
            if len(local_columns) != len(target_columns):
                findings.append({
                    "type": "FK_COLUMN_COUNT_MISMATCH",
                    "object": f"{table_name} -> {remote}",
                })
            for column in local_columns:
                if column not in table_columns.get(table_name, set()):
                    findings.append({
                        "type": "UNDEFINED_LOCAL_FK_COLUMN",
                        "object": f"{table_name}.{column}",
                    })
            for column in target_columns:
                if column not in table_columns.get(remote, set()):
                    findings.append({
                        "type": "UNDEFINED_REMOTE_FK_COLUMN",
                        "object": f"{remote}.{column}",
                    })

    alter_fk_pattern = re.compile(
        r"ALTER\s+TABLE\s+(?P<local_table>app\.[a-z_][a-z0-9_]*)\s+"
        r"ADD\s+CONSTRAINT\s+[a-z_][a-z0-9_]*\s+FOREIGN\s+KEY\s*"
        r"\((?P<local>[^)]*)\)\s+REFERENCES\s+"
        r"(?P<remote>app\.[a-z_][a-z0-9_]*)\s*\((?P<target>[^)]*)\)",
        re.IGNORECASE | re.DOTALL,
    )
    for match in alter_fk_pattern.finditer(sql):
        fk_count += 1
        local_table = match.group("local_table").lower()
        remote = match.group("remote").lower()
        local_columns = [normalize(item) for item in match.group("local").split(",")]
        target_columns = [normalize(item) for item in match.group("target").split(",")]
        if len(local_columns) != len(target_columns):
            findings.append({
                "type": "FK_COLUMN_COUNT_MISMATCH",
                "object": f"{local_table} -> {remote}",
            })
        for column in local_columns:
            if column not in table_columns.get(local_table, set()):
                findings.append({
                    "type": "UNDEFINED_LOCAL_FK_COLUMN",
                    "object": f"{local_table}.{column}",
                })
        for column in target_columns:
            if column not in table_columns.get(remote, set()):
                findings.append({
                    "type": "UNDEFINED_REMOTE_FK_COLUMN",
                    "object": f"{remote}.{column}",
                })
        key_pattern = re.compile(
            r"(?:UNIQUE|PRIMARY\s+KEY)\s*\((?P<columns>[^)]*)\)",
            re.IGNORECASE,
        )
        for key_match in key_pattern.finditer(block):
            for column in [normalize(item) for item in key_match.group("columns").split(",")]:
                key_column_checks += 1
                if column not in table_columns.get(table_name, set()):
                    findings.append({
                        "type": "UNDEFINED_KEY_COLUMN",
                        "object": f"{table_name}.{column}",
                    })

    view_column_checks = 0
    view_blocks = list(view_pattern.finditer(sql))
    view_alias_pattern = re.compile(
        r"\b(?:FROM|JOIN)\s+(app\.[a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)",
        re.IGNORECASE,
    )
    qualified_column_pattern = re.compile(
        r"\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)",
        re.IGNORECASE,
    )
    for index, view_match in enumerate(view_blocks):
        start = view_match.end()
        end = view_blocks[index + 1].start() if index + 1 < len(view_blocks) else len(sql)
        block = sql[start:end]
        alias_map = {
            alias.lower(): relation.lower()
            for relation, alias in view_alias_pattern.findall(block)
        }
        for alias, column in qualified_column_pattern.findall(block):
            alias = alias.lower()
            column = column.lower()
            if column == "*" or alias not in alias_map:
                continue
            view_column_checks += 1
            relation = alias_map[alias]
            if column not in table_columns.get(relation, set()):
                findings.append({
                    "type": "UNDEFINED_VIEW_COLUMN",
                    "object": f"{relation} alias {alias}.{column}",
                })

    security_definer = 0
    call_graph: dict[str, list[str]] = {}
    function_column_checks = 0
    for key, body in function_body.items():
        call_graph[key] = sorted({
            match.group(1).lower()
            for match in call_pattern.finditer(body)
            if match.group(1).lower() in function_names
        })
        if "SECURITY DEFINER" in body.upper():
            security_definer += 1
            if "SET search_path=pg_catalog" not in body:
                findings.append({"type": "MISSING_FIXED_SEARCH_PATH", "object": key})
            if re.search(r"\bEXECUTE\s+(?:FORMAT\s*\(|[a-z_\"'])", body, re.IGNORECASE):
                findings.append({"type": "DYNAMIC_SQL", "object": key})
        alias_candidates: dict[str, set[str]] = {}
        for relation, alias in view_alias_pattern.findall(body):
            alias_candidates.setdefault(alias.lower(), set()).add(relation.lower())
        for alias, column in qualified_column_pattern.findall(body):
            alias = alias.lower()
            column = column.lower()
            relation_set = alias_candidates.get(alias)
            if not relation_set or len(relation_set) != 1 or column == "*":
                continue
            function_column_checks += 1
            relation = next(iter(relation_set))
            if column not in table_columns.get(relation, set()):
                findings.append({
                    "type": "UNDEFINED_FUNCTION_COLUMN",
                    "object": f"{key} {alias}.{column} -> {relation}",
                })

    if "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC" not in sql:
        findings.append({"type": "MISSING_PUBLIC_EXECUTE_REVOKE", "object": "app"})
    if "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC" not in sql:
        findings.append({"type": "MISSING_PRIVATE_PUBLIC_REVOKE", "object": "app_private"})
    if re.search(r"app\.<|app_private\.<|BEGIN\s*\.\.\.\s*END", sql, re.IGNORECASE):
        findings.append({"type": "PLACEHOLDER_OBJECT", "object": "DDL"})

    required_fk_fragments = {
        "selection_run_context_fk": "REFERENCES app.sales_case(",
        "selection_run_ruleset_fk": "REFERENCES app.rule_set_revision(id, content_digest)",
        "selection_candidate_run_fk": "REFERENCES app.selection_run(",
        "selection_candidate_product_fk": "REFERENCES app.product_revision(product_id, id, content_digest)",
        "selection_candidate_spec_fk": "REFERENCES app.specification_revision(",
        "selection_candidate_result_fk": "REFERENCES app.selection_candidate(",
        "selection_run_seal_fk": "REFERENCES app.selection_run(",
        "snapshot_run_fk": "REFERENCES app.selection_run_seal(",
        "snapshot_candidate_result_fk": "REFERENCES app.selection_candidate_result(id, candidate_id, selection_run_id)",
        "snapshot_parameter_catalog_fk": "REFERENCES app.catalog_parameter_revision(",
        "snapshot_price_revision_fk": "REFERENCES app.price_revision(",
    }
    for name, fragment in required_fk_fragments.items():
        if fragment not in sql:
            findings.append({"type": "MISSING_REQUIRED_FK_FRAGMENT", "object": name})

    output = {
        "file": str(path),
        "functions_defined": len(functions),
        "views_defined": len({match.group(1).lower() for match in view_pattern.finditer(sql)}),
        "tables_defined": len({match.group(1).lower() for match in table_pattern.finditer(sql)}),
        "roles_defined": len(roles),
        "function_grants_or_revokes": len(grants),
        "security_definer_functions": security_definer,
        "fk_column_pairs_checked": fk_count,
        "key_columns_checked": key_column_checks,
        "view_qualified_columns_checked": view_column_checks,
        "function_qualified_columns_checked": function_column_checks,
        "defined_function_names": sorted(function_names),
        "call_graph": call_graph,
        "findings": findings,
        "result": "PASS" if not findings else "FAIL",
        "scope": "STATIC LEXICAL DESIGN CHECK ONLY; NO POSTGRESQL EXECUTION OR CATALOG INTROSPECTION",
    }
    print(json.dumps(output, indent=2))
    return 0 if not findings else 1


if __name__ == "__main__":
    raise SystemExit(main())
