"""Independent static review for the R5 remediation design."""

from __future__ import annotations

import ast
import hashlib
import json
import re
import sys
from pathlib import Path

from review_guard import require_guard


R5_MANIFEST_SHA = "513F3CEAE561FD8FEB3A680B2853410BA6022675D24A4246C8C732833DA2239F"
R5_KEY_HASHES = {
    "P1_PRODUCT_REMEDIATION_DESIGN_R5.md":
        "766C9D706FCA869351C182606E944411DC1D58A36DB6D9269FE7A7B67FC0E7D9",
    "DATABASE_COMPLETE_DDL_DESIGN_R5.sql":
        "0B4ACA1AC260980741675D3FE87F62E520240263BDA78F20879E84A11C391D2A",
    "DATABASE_FINAL_STATE_OVERLAY_R5.sql":
        "9276ABE584F83E7016D57C4DB40887C5C5AC99ECFEFE9A7D9F941D2A03B5B81C",
    "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R5.json":
        "B523227232D869122D9E346D874755B477C5462954813B3D5D9D6CF33E555B6E",
    "VALIDATION_EVIDENCE_R5.json":
        "553992905A1A3BBF8465C9BF8D95A5D96790BFCDA3595F139E0966D14D40A97D",
}
R4_REVIEW_MANIFEST_SHA = (
    "9B6084121907475A29D5C1FC7C9B53FDBD52D908F547741FD2C6730A3428F62C"
)
R4_REVIEW_MAIN_SHA = (
    "0BB94BED7CC0C1EB55ECF7D856B1B34DF0BE06FE1AEFA900EC8E9823154E147B"
)
R4_REVIEW_EVIDENCE_SHA = (
    "5C7B393CBCCC90B70B8508F296DAF7ACA0F56C85D5CDBB1BADB4CBB2FFC88D6D"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def verify_manifest(path: Path, expected_sha: str, repo: Path) -> dict:
    records = 0
    unique = set()
    errors = []
    covered_bytes = 0
    covered_lines = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(
            r"^([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)$", line
        )
        if not match:
            errors.append("malformed-record")
            continue
        expected_hash, expected_bytes, expected_lines, raw_relative = match.groups()
        target = (
            repo / raw_relative
            if raw_relative.startswith("docs/")
            else path.parent / raw_relative
        )
        try:
            relative = str(target.relative_to(path.parent)).replace("\\", "/")
        except ValueError:
            relative = raw_relative
        records += 1
        if relative in unique:
            errors.append(f"duplicate:{relative}")
            continue
        unique.add(relative)
        if not target.is_file():
            errors.append(f"missing:{relative}")
            continue
        if sha256(target) != expected_hash.upper():
            errors.append(f"hash:{relative}")
        if target.stat().st_size != int(expected_bytes):
            errors.append(f"bytes:{relative}")
        lines = len(target.read_text(encoding="utf-8").splitlines())
        if lines != int(expected_lines):
            errors.append(f"lines:{relative}")
        covered_bytes += target.stat().st_size
        covered_lines += lines
    actual = {
        str(item.relative_to(path.parent)).replace("\\", "/")
        for item in path.parent.rglob("*")
        if item.is_file() and item != path
    }
    if unique != actual:
        errors.append("coverage")
    return {
        "path": str(path),
        "sha256": sha256(path),
        "expected_sha256": expected_sha,
        "records": records,
        "unique_paths": len(unique),
        "actual_files_excluding_manifest": len(actual),
        "covered_bytes": covered_bytes,
        "covered_lines": covered_lines,
        "errors": errors,
        "pass": not errors and sha256(path) == expected_sha,
    }


HEADER = re.compile(
    r"(?m)^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
    r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\("
)


def matching_paren(sql: str, opening: int) -> int:
    depth = 0
    quote = None
    index = opening
    while index < len(sql):
        char = sql[index]
        if quote:
            if char == quote:
                if index + 1 < len(sql) and sql[index + 1] == quote:
                    index += 2
                    continue
                quote = None
        elif char in {"'", '"'}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    raise ValueError("unbalanced function parameter list")


def signature(name: str, args: str) -> str:
    values = []
    for arg in args.split(","):
        value = norm(arg)
        if not value:
            continue
        words = value.split()
        modes = {"in", "out", "inout", "variadic"}
        if words[0] in modes and len(words) > 1:
            words = words[1:]
        values.append(" ".join(words[1:]) if len(words) > 1 else words[0])
    return f"{name.lower()}({', '.join(values)})"


def parse_functions(sql: str) -> dict[str, dict]:
    headers = list(HEADER.finditer(sql))
    functions = {}
    for index, header in enumerate(headers):
        start = header.start()
        end = headers[index + 1].start() if index + 1 < len(headers) else len(sql)
        segment = sql[start:end]
        opening = header.end() - 1
        closing = matching_paren(sql, opening)
        args = sql[opening + 1:closing]
        tail = sql[closing + 1:end]
        returns_match = re.search(
            r"\bRETURNS\s+(.*?)\s+LANGUAGE\s+([a-z_][a-z0-9_]*)",
            tail,
            re.I | re.S,
        )
        if not returns_match:
            raise ValueError(f"function return/language missing: {header.group('name')}")
        language_end = closing + 1 + returns_match.end()
        as_match = re.search(
            r"\bAS\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)(.*?)\1\s*;",
            sql[language_end:end],
            re.I | re.S,
        )
        if as_match:
            body = as_match.group(2)
            attrs = norm(sql[language_end:language_end + as_match.start()])
            body_end = language_end + as_match.end(2)
        else:
            return_match = re.search(r"\bRETURN\s+(.*?);", tail, re.I | re.S)
            body = return_match.group(1) if return_match else ""
            attrs = norm(tail[returns_match.end():])
            body_end = closing + 1 + (
                return_match.end(1) if return_match else returns_match.end()
            )
        search = re.search(r"set search_path\s*=\s*([^\n]+)", attrs, re.I)
        key = signature(header.group("name"), args)
        functions[key] = {
            "signature": key,
            "name": header.group("name").lower(),
            "arguments": norm(args),
            "returns": norm(returns_match.group(1)),
            "language": returns_match.group(2).lower(),
            "security": "DEFINER" if "security definer" in attrs else "INVOKER",
            "search_path": norm(search.group(1)) if search else None,
            "body": body,
            "line": sql.count("\n", 0, start) + 1,
            "argument_start": opening + 1,
            "argument_end": closing,
            "owner": None,
            "execute_roles": [],
        }
    for match in re.finditer(
        r"ALTER\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
        r"\((.*?)\)\s+OWNER\s+TO\s+([a-z_][a-z0-9_]*)",
        sql,
        re.I | re.S,
    ):
        key = signature(match.group(1), match.group(2))
        if key in functions:
            functions[key]["owner"] = match.group(3).lower()
    grants = {}
    for event in re.finditer(
        r"\b(GRANT|REVOKE)\s+EXECUTE\s+ON\s+FUNCTION\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+"
        r"(?:TO|FROM)\s+([^;]+);",
        sql,
        re.I | re.S,
    ):
        key = signature(event.group(2), event.group(3))
        roles = {
            norm(role) for role in event.group(4).split(",") if role.strip()
        }
        current = grants.setdefault(key, set())
        if event.group(1).upper() == "GRANT":
            current.update(role for role in roles if role != "public")
        else:
            current.difference_update(role for role in roles if role != "public")
    for key, function in functions.items():
        function["execute_roles"] = sorted(grants.get(key, set()))
        function["updates"] = sorted({
            match.group(2).lower()
            for match in re.finditer(
                r"\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+"
                r"(app(?:_private)?\.[a-z_][a-z0-9_]*)",
                function["body"],
                re.I,
            )
        })
    return functions


def _column_tuple(value: str) -> tuple[str, ...]:
    return tuple(
        part.strip().strip('"').lower()
        for part in value.split(",")
        if part.strip()
    )


def parse_schema(sql: str) -> tuple[dict[str, dict], list[dict]]:
    tables = {}
    blocks = []
    for match in re.finditer(
        r"(?m)^CREATE\s+TABLE\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(",
        sql,
        re.I,
    ):
        opening = match.end() - 1
        closing = matching_paren(sql, opening)
        block = sql[opening + 1:closing]
        columns = set()
        keys = set()
        for column in re.finditer(
            r"^\s*([a-z_][a-z0-9_]*)\s+[a-z]",
            block,
            re.I | re.M,
        ):
            name = column.group(1).lower()
            if name not in {"constraint","primary","foreign","unique","check"}:
                columns.add(name)
        for column in re.finditer(
            r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",
            block,
            re.I | re.M,
        ):
            keys.add((column.group(1).lower(),))
        for key_match in re.finditer(
            r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",
            block,
            re.I | re.S,
        ):
            keys.add(_column_tuple(key_match.group(1)))
        table_name = match.group(1).lower()
        tables[table_name] = {"columns": columns, "keys": keys}
        blocks.append((table_name, block))

    fks = []
    fk_re = re.compile(
        r"FOREIGN\s+KEY\s*\((.*?)\)\s*REFERENCES\s+"
        r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)",
        re.I | re.S,
    )
    for table_name, block in blocks:
        for fk_match in fk_re.finditer(block):
            fks.append({
                "source": table_name,
                "source_columns": _column_tuple(fk_match.group(1)),
                "target": fk_match.group(2).lower(),
                "target_columns": _column_tuple(fk_match.group(3)),
            })
    for match in re.finditer(
        r"ALTER\s+TABLE\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s+([\s\S]*?);",
        sql,
        re.I | re.S,
    ):
        source = match.group(1).lower()
        body = match.group(2)
        table = tables.setdefault(source, {"columns": set(), "keys": set()})
        for column in re.finditer(
            r"ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)",
            body,
            re.I,
        ):
            table["columns"].add(column.group(1).lower())
        for key_match in re.finditer(
            r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",
            body,
            re.I | re.S,
        ):
            table["keys"].add(_column_tuple(key_match.group(1)))
        for fk_match in fk_re.finditer(body):
            fks.append({
                "source": source,
                "source_columns": _column_tuple(fk_match.group(1)),
                "target": fk_match.group(2).lower(),
                "target_columns": _column_tuple(fk_match.group(3)),
            })
    return tables, fks


def parse_triggers(sql: str) -> list[dict]:
    starts = list(re.finditer(
        r"(?m)^CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+"
        r"(?P<name>[a-z_][a-z0-9_]*)\s+",
        sql,
        re.I,
    ))
    results = []
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(sql)
        segment = sql[match.end():end]
        timing = re.search(r"^\s*(BEFORE|AFTER|INSTEAD\s+OF)\s+", segment, re.I)
        on_match = re.search(
            r"\s+ON\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s+",
            segment,
            re.I | re.S,
        )
        level_match = re.search(r"\bFOR\s+EACH\s+(ROW|STATEMENT)\b", segment, re.I)
        function_match = re.search(
            r"\bEXECUTE\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)",
            segment,
            re.I,
        )
        if not (timing and on_match and level_match and function_match):
            continue
        events = norm(segment[timing.end():on_match.start()])
        results.append({
            "name": match.group("name").lower(),
            "timing": norm(timing.group(1)),
            "events": events,
            "table": on_match.group(1).lower(),
            "level": level_match.group(1).lower(),
            "function": function_match.group(1).lower(),
        })
    return results


def extract_literal_dict(path: Path, name: str) -> dict:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == name
                for target in node.targets
            )
            and isinstance(node.value, ast.Dict)
        ):
            return ast.literal_eval(node.value)
    return {}


def apply_mutation(sql: str, case: dict, functions: dict) -> str:
    function_key = case.get("function")
    if function_key:
        function = functions.get(str(function_key))
        if not function:
            return sql
        if case.get("part") == "header":
            old = str(case["old"])
            new = str(case["new"])
            raw_args = sql[
                int(function["argument_start"]):int(function["argument_end"])
            ]
            if old not in raw_args:
                return sql
            replacement = raw_args.replace(old, new, 1)
            return (
                sql[:int(function["argument_start"])]
                + replacement
                + sql[int(function["argument_end"]):]
            )
        old = str(case["old"])
        new = str(case["new"])
        if old not in function["body"]:
            return sql
        body = function["body"].replace(old, new, 1)
        return sql.replace(function["body"], body, 1)
    old = str(case["old"])
    new = str(case["new"])
    scope = case.get("scope", "sql-first")
    if scope == "append-final":
        return sql + "\n" + new + "\n"
    if scope == "sql-last":
        index = sql.rfind(old)
        return sql if index < 0 else sql[:index] + new + sql[index + len(old):]
    if scope == "sql-all":
        return sql.replace(old, new)
    return sql.replace(old, new, 1)


def r4_cases() -> list[dict]:
    path = (
        Path(__file__).resolve().parents[3]
        / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r4"
        / "tools/validate_r4.py"
    )
    tree = ast.parse(path.read_text(encoding="utf-8"))
    function_node = next(
        node for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef) and node.name == "mutation_cases"
    )
    source = ast.get_source_segment(path.read_text(encoding="utf-8"), function_node)
    namespace = {}
    exec(source, namespace)
    return namespace["mutation_cases"]({})


def main() -> int:
    root = Path(__file__).resolve().parent
    guard = require_guard(root)
    repo = root.parents[2]
    r5 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r5"
    r4_review = repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r4"
    r3 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r3"
    r2 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"

    r5_manifest = verify_manifest(r5 / "SHA256SUMS_R5.txt", R5_MANIFEST_SHA, repo)
    r4_manifest = verify_manifest(
        r4_review / "SHA256SUMS_R4_REVIEW.txt",
        R4_REVIEW_MANIFEST_SHA,
        repo,
    )
    historical_manifests = [
        verify_manifest(
            r3 / "SHA256SUMS_R3_C8_CORRECTIONS_R3.txt",
            "C5611B8807D50E3E02286A63B5C9E39F9F745684793C2FD5525DCA4537A71825",
            repo,
        ),
        verify_manifest(
            r2 / "SHA256SUMS_R3_C8_CORRECTIONS_R2.txt",
            "45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8",
            repo,
        ),
    ]
    key_hashes = {
        name: {
            "expected": expected,
            "actual": sha256(r5 / name),
            "match": sha256(r5 / name) == expected,
        }
        for name, expected in R5_KEY_HASHES.items()
    }

    ddl_path = r5 / "DATABASE_COMPLETE_DDL_DESIGN_R5.sql"
    sql = ddl_path.read_text(encoding="utf-8")
    functions = parse_functions(sql)
    tables, fks = parse_schema(sql)
    triggers = parse_triggers(sql)
    registry = json.loads(
        (r5 / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R5.json").read_text(
            encoding="utf-8"
        )
    )
    registry_functions = {
        item["signature"]: item for item in registry["functions"]
    }
    fk_errors = []
    for fk in fks:
        if len(fk["source_columns"]) != len(fk["target_columns"]):
            fk_errors.append({**fk, "reason": "arity"})
            continue
        source = tables.get(fk["source"])
        target = tables.get(fk["target"])
        if not source:
            fk_errors.append({**fk, "reason": "source-table"})
            continue
        if not target:
            fk_errors.append({**fk, "reason": "target-table"})
            continue
        if any(column not in source["columns"] for column in fk["source_columns"]):
            fk_errors.append({**fk, "reason": "source-columns"})
        if fk["target_columns"] not in target["keys"]:
            fk_errors.append({**fk, "reason": "target-key"})
    function_names = {
        function["name"] for function in functions.values()
    }
    relation_names = set(tables) | {
        match.group(1).lower()
        for match in re.finditer(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+"
            r"(app(?:_private)?\.[a-z_][a-z0-9_]*)",
            sql,
            re.I,
        )
    }
    trigger_errors = [
        trigger for trigger in triggers
        if trigger["function"] not in function_names
        or trigger["table"] not in tables
    ]
    unresolved_calls = set()
    for function in functions.values():
        for call in re.findall(
            r"\b(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(",
            function["body"],
            re.I,
        ):
            if call.lower() not in function_names and call.lower() not in relation_names:
                unresolved_calls.add(call.lower())
    missing_owners = [
        key for key, function in functions.items() if not function["owner"]
    ]
    registry_grants = registry.get("effective_capability_grants", {})
    ddl_grants = {
        key: function["execute_roles"]
        for key, function in functions.items()
        if function["execute_roles"]
    }
    security_mismatches = []
    search_path_mismatches = []
    return_mismatches = []
    owner_mismatches = []
    for key, actual in functions.items():
        recorded = registry_functions.get(key)
        if not recorded:
            continue
        if recorded.get("security") != actual["security"]:
            security_mismatches.append({
                "signature": key,
                "registry": recorded.get("security"),
                "ddl": actual["security"],
            })
        if recorded.get("search_path") != actual["search_path"]:
            search_path_mismatches.append({
                "signature": key,
                "registry": recorded.get("search_path"),
                "ddl": actual["search_path"],
            })
        if recorded.get("returns") != actual["returns"]:
            return_mismatches.append({"signature": key})
        if recorded.get("owner") != actual["owner"]:
            owner_mismatches.append({"signature": key})

    begin_key = (
        "app.bootstrap_begin_root_change_r4("
        "text, boolean, text, text, text, text, text, text, text)"
    )
    execute_key = "app.bootstrap_execute_root_change_r4(text, text, text)"
    terminal_key = (
        "app_private.terminalize_expired_root_change_r5("
        "text, text, timestamptz)"
    )
    candidate_key = (
        "app_private.execute_candidate_backfill_r5("
        "text, text, text, text, text, text, text, text, bigint)"
    )
    generation_guard_key = (
        "app_private.enforce_rotation_generation_revalidation_r5()"
    )
    begin = norm(functions[begin_key]["body"])
    execute = norm(functions[execute_key]["body"])
    terminal = norm(functions[terminal_key]["body"])
    candidate = norm(functions[candidate_key]["body"])
    generation_guard = norm(functions[generation_guard_key]["body"])

    r5_evidence = json.loads(
        (r5 / "VALIDATION_EVIDENCE_R5.json").read_text(encoding="utf-8")
    )
    r5_validator = (r5 / "tools/validate_r5.py").read_text(encoding="utf-8")
    traceability = (
        r5 / "FINDING_MUTATION_TRACEABILITY_R5.md"
    ).read_text(encoding="utf-8")
    open_decisions = (r5 / "OPEN_DECISIONS_DISPOSITION_R5.md").read_text(
        encoding="utf-8"
    )

    documented_vectors = sorted(set(re.findall(r"R5-STATE-[A-Z-]+", traceability)))
    evidence_vectors = sorted(
        str(item.get("id")) for item in r5_evidence.get("state_vectors", [])
    )
    vector_ids_match = set(documented_vectors) == {
        item.upper().replace("_", "-") for item in evidence_vectors
    }

    statement_mutex_triggers = {
        item["table"]: item for item in triggers
        if item["name"].startswith("r5_identity_mutex_")
    }
    mutex_tables = {
        "app.trusted_principal",
        "app.principal_epoch",
        "app.trusted_session",
        "app.authority_grant",
        "app.bootstrap_root_session_r2",
        "app.bootstrap_root_grant_r2",
        "app.bootstrap_operator_r3",
    }
    mutex_trigger_ok = (
        set(statement_mutex_triggers) == mutex_tables
        and all(
            item["timing"] == "before"
            and item["level"] == "statement"
            and "update" in item["events"]
            and "delete" in item["events"]
            for item in statement_mutex_triggers.values()
        )
    )

    execute_rotation_pos = execute.find("if rr.kind='rotation' then")
    execute_root_gate_pos = execute.find("assert_current_root_authority_r5(")
    execute_operator_pos = execute.find("update app.bootstrap_operator_r3")
    generation_gate_ok = (
        "assert_current_root_authority_r5(" in generation_guard
        and "if rr.kind='rotation' then" in generation_guard
        and "rr.kind not in ('recovery','rotation')" in generation_guard
        and "generation insert recovery attempt is stale" in generation_guard
    )
    rotation_ok = (
        -1 < execute_rotation_pos < execute_root_gate_pos < execute_operator_pos
        and generation_gate_ok
        and mutex_trigger_ok
    )

    begin_time_pos = begin.find("v_now:=clock_timestamp()")
    begin_active_lock_pos = begin.find(
        "from app.bootstrap_recovery_r2 where bootstrap_id=p_bootstrap_id"
    )
    begin_sweep_pos = begin.find("terminalize_expired_root_change_r5(")
    begin_new_attempt_pos = begin.find("next_bootstrap_recovery_sequence_r4(")
    begin_time_before_active_lock = (
        -1 < begin_time_pos < begin_active_lock_pos < begin_sweep_pos
        < begin_new_attempt_pos
    )
    expiry_ok = (
        begin_time_before_active_lock
        and "for update" in begin
        and "begin_expired_sweep" in begin
        and "insert into app.bootstrap_recovery_terminalization_r5" in terminal
        and "complete_bootstrap_request_r2" not in terminal
        and "bootstrap_recovery_one_active_attempt_r4" in norm(sql)
        and "where state in ('pending','approved')" in norm(sql)
    )

    candidate_audit_ok = all(
        token in norm(sql)
        for token in (
            "create table app.candidate_backfill_batch_r5",
            "create table app.candidate_backfill_row_audit_r5",
            "old_candidate_was_null",
            "old_candidate_id",
            "new_candidate_id",
            "provenance_type",
            "provenance_record_id",
            "provenance_version",
            "old_row_digest",
            "new_row_digest",
            "original_sealed_digest",
            "correction_digest",
            "audit_event_id",
        )
    )
    candidate_actor_bound_to_executor = (
        "session_user" in candidate
        or "lock_current_session" in candidate
        or "pg_backend_pid()" in candidate
    )
    candidate_audit_before_update = (
        candidate.find("insert into app.candidate_backfill_row_audit_r5")
        < candidate.find("update app.selection_professional_review_result")
    )

    hardcoded_replay = (
        'self.ledger[request_id] = "GENERATION:2"' in r5_validator
    )
    response_loss_ok = not hardcoded_replay
    independent_evidence_is_mutation_trace = all(
        all(key in item for key in ("target", "mutation", "mutated_result"))
        for item in r5_evidence.get("independent_negative_results", [])
    )
    open_decisions_validator_exact = (
        "len(open_ids) == 57" in r5_validator
        and "len(set(open_ids)) == 57" in r5_validator
        and "Approved by User: 0" in r5_validator
    )

    r3_mutations = extract_literal_dict(
        r3 / "tools/validate_r3.py", "mutations"
    )
    r2_mutations = extract_literal_dict(
        r3 / "tools/validate_r3.py", "r2_mutations"
    )
    r3_details = []
    for mutation_id, (old, new) in r3_mutations.items():
        mutated = sql.replace(old, new)
        r3_details.append({
            "id": mutation_id,
            "target_present": old in sql,
            "document_changed": mutated != sql,
        })
    r2_details = []
    for mutation_id, (check_name, pairs) in r2_mutations.items():
        mutated = sql
        for old, new in pairs:
            mutated = mutated.replace(old, new)
        r2_details.append({
            "id": mutation_id,
            "target_check": check_name,
            "targets_present": all(old in sql for old, _ in pairs),
            "document_changed": mutated != sql,
        })
    r3_targets = sum(bool(item["document_changed"]) for item in r3_details)
    r2_targets = sum(bool(item["document_changed"]) for item in r2_details)
    base_cases = r4_cases()
    cases = []
    for source in base_cases:
        case = dict(source)
        case_id = str(case.get("id"))
        if case_id in {
            "R4-TX-01","R4-TX-02","R4-TX-04","R4-TX-05",
            "R4-TX-07","R4-TX-08","R4-TX-09",
        }:
            case["function"] = terminal_key
            if case_id == "R4-TX-04":
                case["old"] = "app_private.append_bootstrap_event_r2("
                case["new"] = "false * ("
        elif case_id == "R4-TX-03":
            case["function"] = "app.bootstrap_approve_root_change_r4(text, text, text)"
            case["old"] = (
                "PERFORM app_private.terminalize_expired_root_change_r5(\n"
                "      p_recovery_id,'APPROVE_EXPIRY',v_now\n"
                "    );"
            )
            case["new"] = "RAISE EXCEPTION 'root change approval expired';"
        elif case_id == "R4-REC-01":
            case["function"] = begin_key
            case["old"] = "PERFORM app_private.assert_current_root_authority_r5("
            case["new"] = "PERFORM false * ("
        elif case_id == "R4-CAND-05":
            case["function"] = candidate_key
            case["old"] = "SET candidate_id=v_source_candidate_id"
            case["new"] = "SET candidate_id=coalesce(v_source_candidate_id,'UNKNOWN')"
        elif case_id == "R4-CAND-06":
            case["scope"] = "sql-last"
            case["old"] = (
                "RAISE EXCEPTION\n"
                "      'professional review candidate backfill batches are incomplete'\n"
                "      USING ERRCODE='23502';"
            )
            case["new"] = "NULL;"
        elif case_id == "R4-CAND-11":
            case["function"] = candidate_key
            case["old"] = (
                "LOCK TABLE\n"
                "    app.professional_review_event,\n"
                "    app.selection_professional_review_result,\n"
                "    app.sales_handoff_snapshot_r3,\n"
                "    app.sales_snapshot_professional_review_r3\n"
                "  IN SHARE ROW EXCLUSIVE MODE;"
            )
            case["new"] = "-- mutation removed source freeze"
        cases.append(case)
    r4_results = []
    for case in cases:
        mutated = apply_mutation(sql, case, functions)
        r4_results.append({
            "id": case.get("id"),
            "target_effective": mutated != sql,
            "target_function": case.get("function"),
        })

    independent_rules = [
        ("IND-MUT-01", "terminal helper has no update-then-raise",
         "raise exception 'root change approval expired'" not in terminal),
        ("IND-MUT-02", "terminal helper completes no caller ledger",
         "complete_bootstrap_request_r2" not in terminal),
        ("IND-MUT-03", "denied history can be followed by new attempt",
         "denied" in norm(sql) and "where state in ('pending','approved')" in norm(sql)),
        ("IND-MUT-04", "locked history can be followed by new attempt",
         "'locked'" in begin and "where state in ('pending','approved')" in norm(sql)),
        ("IND-MUT-05", "sequence allocator is atomic upsert",
         "on conflict (bootstrap_id,bootstrap_generation) do update" in norm(sql)),
        ("IND-MUT-06", "one active attempt partial unique",
         "create unique index bootstrap_recovery_one_active_attempt_r4" in norm(sql)
         and "where state in ('pending','approved')" in norm(sql)),
        ("IND-MUT-07", "approval scoped to exact attempt",
         execute.count("where recovery_id=p_recovery_id and operator_kind=") >= 2),
        ("IND-MUT-08", "execute requires approved state",
         "if rr.state<>'approved'" in execute),
        ("IND-MUT-09", "sequence owner DML",
         "grant select,insert,update on table app.bootstrap_recovery_sequence_r4"
         in norm(sql)),
        ("IND-MUT-10", "rotation execute and generation trigger recheck root",
         rotation_ok),
        ("IND-MUT-11", "begin initiator is active",
         "root change initiator principal is not active" in begin),
        ("IND-MUT-12", "approver principal is active",
         "root change approver principal is not active" in norm(sql)),
        ("IND-MUT-13", "execute creates no principal",
         "insert into app.trusted_principal" not in execute),
        ("IND-MUT-14", "execute creates no principal epoch",
         "insert into app.principal_epoch" not in execute),
        ("IND-MUT-15", "candidate columns not null",
         norm(sql).count("alter column candidate_id set not null") >= 2),
        ("IND-MUT-16", "candidate guard permits only candidate change",
         "(p_new-'candidate_id')=(p_old-'candidate_id')" in norm(sql)),
        ("IND-MUT-17", "candidate sources exact",
         "where e.id=v_row.professional_review_event_id" in candidate
         and "src.event_sequence=v_snapshot.event_sequence" in candidate
         and "limit 1" not in candidate),
        ("IND-MUT-18", "candidate sources frozen",
         "in share row exclusive mode" in candidate),
        ("IND-MUT-19", "sealed/correction digest proof",
         "original_sealed_digest" in norm(sql)
         and "correction_digest" in norm(sql)
         and "aiea-candidate-backfill-correction-v1" in candidate),
        ("IND-MUT-20", "expired attempt swept and replaced", expiry_ok),
        ("IND-MUT-21", "candidate audit row precedes update",
         candidate_audit_ok and candidate_audit_before_update),
        ("IND-MUT-22", "response-loss replay is non-hardcoded", response_loss_ok),
    ]

    open_ids = re.findall(r"`(OD-(?:R2|R3)[A-Z0-9-]*)`", open_decisions)
    open_unique = sorted(set(open_ids))
    open_ok = (
        len(open_ids) == 57
        and len(open_unique) == 57
        and "Approved by User: 0" in open_decisions
        and "Still OPEN: 57" in open_decisions
    )

    findings = []
    if security_mismatches or search_path_mismatches:
        findings.append({
            "id": "REV-R5-IND-P2-01",
            "severity": "P2",
            "title": "Function Registry records incorrect security/search_path metadata",
            "detail": (
                f"{len(security_mismatches)} security mismatches and "
                f"{len(search_path_mismatches)} search_path mismatches. "
                "Registry parser uses an absolute match offset against a sliced "
                "function segment, so attributes are not parsed."
            ),
            "status": "NOT RESOLVED",
        })
    if hardcoded_replay:
        findings.append({
            "id": "REV-R5-IND-P2-02",
            "severity": "P2",
            "title": "Response-loss replay vector remains hardcoded",
            "detail": (
                "validate_r5.py assigns 'GENERATION:2' directly and compares "
                "the same stored string. It does not derive a first-execution "
                "result from the final SQL state transition or Ledger contract."
            ),
            "status": "PARTIALLY RESOLVED",
            "original_finding": "REV-R3-R3-P2-03",
        })
    if candidate_audit_ok and not candidate_actor_bound_to_executor:
        findings.append({
            "id": "REV-R5-IND-P2-03",
            "severity": "P2",
            "title": "Candidate backfill actor fields are not bound to the executing session",
            "detail": (
                "The SECURITY DEFINER function accepts arbitrary Principal, "
                "Session and Authority Grant IDs and only checks that those rows "
                "are active. It does not compare them with session_user, a locked "
                "current session, or backend identity. PUBLIC EXECUTE is revoked, "
                "so the current state is fail-closed, but any future maintenance "
                "grant could attribute immutable-row changes to another valid actor."
            ),
            "status": "PARTIALLY RESOLVED",
            "original_finding": "REV-R4-IND-P2-03",
        })
    if (
        not independent_evidence_is_mutation_trace
        or not open_decisions_validator_exact
    ):
        findings.append({
            "id": "REV-R5-IND-P2-04",
            "severity": "P2",
            "title": "R5 Validator contains non-mutational negative checks and a non-exact Open Decision check",
            "detail": (
                "Most IND-MUT rows in VALIDATION_EVIDENCE_R5 contain only a "
                "boolean predicate and basis text, without a target mutation, "
                "expected mutation effect, or observed flipped result. The "
                "Open Decisions check accepts at least 57 regex matches and does "
                "not itself require exactly 57 unique OPEN IDs with zero approvals."
            ),
            "status": "PARTIALLY RESOLVED",
            "original_finding": "REV-R3-R3-P2-03",
        })
    if not vector_ids_match:
        findings.append({
            "id": "REV-R5-IND-P3-01",
            "severity": "P3",
            "title": "Documented R5 state-vector IDs do not resolve to evidence IDs",
            "detail": (
                f"Traceability IDs={documented_vectors}; "
                f"evidence IDs={evidence_vectors}."
            ),
            "status": "NOT RESOLVED",
            "original_finding": "REV-R4-IND-P3-01",
        })
    if begin_time_before_active_lock:
        findings.append({
            "id": "REV-R5-IND-P3-02",
            "severity": "P3",
            "title": "Begin samples authoritative time before the final active-Attempt lock",
            "detail": (
                "The R5 design document says locking precedes time evaluation. "
                "The final SQL samples clock_timestamp() before SELECT ... FOR "
                "UPDATE on the active Attempt. The shared identity mutex currently "
                "serializes public writers, so no confirmed exploitation path was "
                "found, but the claimed lock/time order is false and owner DML or a "
                "future lock-order change could preserve a stale time decision."
            ),
            "status": "PARTIALLY RESOLVED",
            "original_finding": "REV-R4-IND-P2-02",
        })

    manifest_end_hashes = {
        "manifest": sha256(r5 / "SHA256SUMS_R5.txt"),
        **{name: sha256(r5 / name) for name in R5_KEY_HASHES},
    }
    evidence = {
        "review": "R5 INDEPENDENT DESIGN REVIEW",
        "guard": guard,
        "input_integrity": {
            "r5_manifest": r5_manifest,
            "r4_review_manifest": r4_manifest,
            "historical_manifests": historical_manifests,
            "key_hashes": key_hashes,
            "r4_review_main_sha256": sha256(
                r4_review / "INDEPENDENT_REVIEW_R4.md"
            ),
            "r4_review_evidence_sha256": sha256(
                r4_review / "VALIDATION_EVIDENCE_REVIEW_R4.json"
            ),
            "historical_transcription_note": {
                "authorization_value": "5C7B393CBCCC90B70B8508F296DAF7ACA0F56C85D5CDBB1ADDB4CBB2FFC88D6D",
                "actual_and_manifest_value": R4_REVIEW_EVIDENCE_SHA,
                "handling": "Use the verified actual file and Manifest; no historical file changed.",
            },
        },
        "object_inventory": {
            "tables": len(tables),
            "functions": len(functions),
            "triggers": len(triggers),
            "roles": len(set(re.findall(
                r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", sql, re.I
            ))),
            "views": len(re.findall(
                r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+app\.", sql, re.I
            )),
            "foreign_key_declarations": len(fks),
            "missing_function_owners": len(missing_owners),
            "unresolved_app_calls": sorted(unresolved_calls),
            "trigger_target_errors": len(trigger_errors),
            "fk_structural_errors": len(fk_errors),
        },
        "registry_comparison": {
            "registry_signatures": len(registry_functions),
            "ddl_signatures": len(functions),
            "signature_sets_equal": set(registry_functions) == set(functions),
            "security_mismatch_count": len(security_mismatches),
            "search_path_mismatch_count": len(search_path_mismatches),
            "return_mismatch_count": len(return_mismatches),
            "owner_mismatch_count": len(owner_mismatches),
            "effective_grants_match": registry_grants == ddl_grants,
            "security_mismatches": security_mismatches,
            "search_path_mismatches": search_path_mismatches,
        },
        "fk_errors": fk_errors,
        "trigger_errors": trigger_errors,
        "core_checks": {
            "rotation_execute_gate": rotation_ok,
            "identity_mutex_statement_triggers": mutex_trigger_ok,
            "generation_insert_trigger": generation_gate_ok,
            "expired_attempt_sweep": expiry_ok,
            "begin_time_after_active_lock": not begin_time_before_active_lock,
            "candidate_durable_audit": candidate_audit_ok,
            "candidate_audit_before_update": candidate_audit_before_update,
            "candidate_actor_bound_to_executor": candidate_actor_bound_to_executor,
            "response_loss_vector_non_hardcoded": response_loss_ok,
            "independent_negative_rows_are_mutation_traceable": independent_evidence_is_mutation_trace,
            "open_decisions_validator_exact": open_decisions_validator_exact,
            "documented_vector_ids_resolve": vector_ids_match,
            "open_decisions_57_unique_open": open_ok,
        },
        "documented_state_vectors": documented_vectors,
        "evidence_state_vectors": evidence_vectors,
        "mutation_replay": {
            "r3_formal_total": len(r3_mutations),
            "r3_target_effective": r3_targets,
            "r3_details": r3_details,
            "r2_historical_total": len(r2_mutations),
            "r2_target_effective": r2_targets,
            "r2_details": r2_details,
            "r4_semantic_total": len(r4_results),
            "r4_target_effective": sum(
                bool(item["target_effective"]) for item in r4_results
            ),
            "r4_details": r4_results,
            "scope_note": (
                "Literal mutation target replay only. Independent semantic "
                "detection is reported separately below."
            ),
        },
        "independent_negative_rules": [
            {"id": item[0], "basis": item[1], "pass": bool(item[2])}
            for item in independent_rules
        ],
        "findings": findings,
        "end_hashes": manifest_end_hashes,
        "boundaries": {
            "postgresql_grammar": "NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
            "postgresql_compilation": "NOT VERIFIED — DATABASE NOT AUTHORIZED",
            "catalog_introspection": "NOT VERIFIED — DATABASE NOT AUTHORIZED",
            "migration_lock_behavior": "NOT VERIFIED — DATABASE NOT AUTHORIZED",
            "runtime_concurrency": "NOT VERIFIED — RUNTIME NOT AUTHORIZED",
        },
    }
    output = root / "VALIDATION_EVIDENCE_REVIEW_R5.json"
    output.write_text(
        json.dumps(evidence, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "tables": len(tables),
        "foreign_keys": len(fks),
        "fk_errors": len(fk_errors),
        "functions": len(functions),
        "triggers": len(triggers),
        "trigger_errors": len(trigger_errors),
        "security_mismatches": len(security_mismatches),
        "search_path_mismatches": len(search_path_mismatches),
        "r3_targets": f"{r3_targets}/{len(r3_mutations)}",
        "r2_targets": f"{r2_targets}/{len(r2_mutations)}",
        "r4_targets": f"{sum(bool(item['target_effective']) for item in r4_results)}/{len(r4_results)}",
        "independent_rules": f"{sum(bool(item[2]) for item in independent_rules)}/{len(independent_rules)}",
        "findings": [(item["id"], item["severity"]) for item in findings],
        "output": str(output),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

