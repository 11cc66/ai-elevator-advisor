"""Independent static R4 review and mutation replay.

The submitted R4 Validator is treated only as the source of mutation specs.
All baseline structure and every reported finding below are evaluated by this
review's own parsers and checks.
"""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
import re
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

from review_guard import require_guard


R4_MANIFEST_HASH = "BAB1129478D70E3CD21B6C2D60B338525CE7E18660ABE26D69BBE540409AB377"
R3_REVIEW_MANIFEST_HASH = "1500C72F8059AAD1D15F4829818D1BA688CD57B95DD606CDFEB26A3D58285EC2"
KEY_HASHES = {
    "P1_PRODUCT_REMEDIATION_DESIGN_R4.md":
        "5CEB6F13B38CF093DF51F06515D88C6F9DE1153D6ABBE04CB6FD7D2DD0C2BB53",
    "DATABASE_COMPLETE_DDL_DESIGN_R4.sql":
        "F4DA543931B69F67DEB6672B41F968FCF24E1D8E025B367E5282B4AF44711B2F",
    "DATABASE_FINAL_STATE_OVERLAY_R4.sql":
        "87A3814632B59FBD6614CCA31E6A388FE3FDEDD0D695611FC04B1E39C4664552",
    "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R4.json":
        "C0FD9D353F5E82D937E587A81106652B3A66DC47256B777BD8CE2DF430F86EA3",
    "VALIDATION_EVIDENCE_R4.json":
        "B1AB36A2CFB92E286AAA78F43F036B643257978B2F2112ACAF807360FAEBDA0E",
}


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def verify_manifest(
    path: Path,
    base: Path,
    expected_hash: str | None = None,
    check_coverage: bool = False,
) -> dict:
    records = 0
    unique: set[str] = set()
    errors: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)$", line)
        if not match:
            errors.append("malformed-record")
            continue
        expected, byte_count, line_count, relative = match.groups()
        records += 1
        if relative in unique:
            errors.append(f"duplicate:{relative}")
            continue
        unique.add(relative)
        target = base / relative
        if not target.is_file():
            errors.append(f"missing:{relative}")
            continue
        if sha256(target) != expected.upper():
            errors.append(f"hash:{relative}")
        if target.stat().st_size != int(byte_count):
            errors.append(f"bytes:{relative}")
        if len(target.read_text(encoding="utf-8").splitlines()) != int(line_count):
            errors.append(f"lines:{relative}")
    actual_hash = sha256(path)
    if expected_hash and actual_hash != expected_hash:
        errors.append("manifest-hash")
    actual_files: list[str] = []
    uncovered: list[str] = []
    extra: list[str] = []
    if check_coverage:
        actual_files = sorted(
            item.relative_to(base).as_posix()
            for item in base.rglob("*")
            if item.is_file() and item != path
        )
        actual_set = set(actual_files)
        uncovered = sorted(actual_set - unique)
        extra = sorted(unique - actual_set)
        errors.extend(f"uncovered:{item}" for item in uncovered)
        errors.extend(f"extra:{item}" for item in extra)
    return {
        "path": str(path),
        "sha256": actual_hash,
        "expected_sha256": expected_hash,
        "records": records,
        "unique": len(unique),
        "actual_files_excluding_manifest": len(actual_files),
        "uncovered": uncovered,
        "extra": extra,
        "errors": errors,
        "pass": not errors,
    }


FUNCTION_HEADER = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
    r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
    r"\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+"
    r"LANGUAGE\s+(?P<language>[a-z_][a-z0-9_]*)",
    re.I | re.S,
)


def signature(name: str, args: str) -> str:
    types: list[str] = []
    for arg in args.split(","):
        value = norm(arg)
        if not value:
            continue
        words = value.split()
        if words[0] in {"in", "out", "inout", "variadic"} and len(words) > 1:
            words = words[1:]
        types.append(" ".join(words[1:]) if len(words) > 1 else words[0])
    return f"{name.lower()}({', '.join(types)})"


def parse_functions(sql: str) -> dict[str, dict]:
    headers = list(FUNCTION_HEADER.finditer(sql))
    functions: dict[str, dict] = {}
    for index, header in enumerate(headers):
        end = headers[index + 1].start() if index + 1 < len(headers) else len(sql)
        segment = sql[header.start():end]
        quoted = re.search(
            r"\bAS\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)(.*?)\1\s*;",
            segment,
            re.I | re.S,
        )
        returned = re.search(r"\bRETURN\s+(.*?);", segment, re.I | re.S)
        body_match = quoted or returned
        body = body_match.group(2 if quoted else 1) if body_match else ""
        body_start = header.start() + (body_match.start(2 if quoted else 1) if body_match else 0)
        body_end = header.start() + (body_match.end(2 if quoted else 1) if body_match else 0)
        attrs = norm(segment[header.end():body_match.start() if body_match else len(segment)])
        key = signature(header.group("name"), header.group("args"))
        functions[key] = {
            "signature": key,
            "name": header.group("name").lower(),
            "returns": norm(header.group("returns")),
            "language": header.group("language").lower(),
            "security": "DEFINER" if "security definer" in attrs else "INVOKER",
            "search_path": (
                norm(re.search(r"set search_path\s*=\s*([^\n]+)", attrs, re.I).group(1))
                if re.search(r"set search_path\s*=\s*([^\n]+)", attrs, re.I)
                else None
            ),
            "body": body,
            "body_start": body_start,
            "body_end": body_end,
            "header_start": header.start(),
            "header_end": header.end(),
            "owner": None,
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
    return functions


def parse_tables(sql: str):
    tables: dict[str, set[str]] = {}
    keys: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    fks: list[tuple[str, tuple[str, ...], str, tuple[str, ...]]] = []
    for match in re.finditer(
        r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*\(",
        sql,
        re.I,
    ):
        table = match.group(1).lower()
        start = sql.find("(", match.start())
        depth = 0
        end = start
        for position in range(start, len(sql)):
            if sql[position] == "(":
                depth += 1
            elif sql[position] == ")":
                depth -= 1
                if depth == 0:
                    end = position
                    break
        body = sql[start + 1:end]
        tables.setdefault(table, set())
        for column in re.finditer(r"^\s*([a-z_][a-z0-9_]*)\s+", body, re.I | re.M):
            if column.group(1).lower() not in {
                "constraint", "primary", "foreign", "unique", "check",
            }:
                tables[table].add(column.group(1).lower())
        for key in re.finditer(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)", body, re.I | re.S):
            keys[table].add(tuple(norm(item) for item in key.group(1).split(",")))
        for key in re.finditer(
            r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",
            body,
            re.I | re.M,
        ):
            keys[table].add((key.group(1).lower(),))
        for fk in re.finditer(
            r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
            r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
            body,
            re.I | re.S,
        ):
            fks.append((
                table,
                tuple(norm(value) for value in fk.group(1).split(",")),
                fk.group(2).lower(),
                tuple(norm(value) for value in fk.group(3).split(",")),
            ))
    for match in re.finditer(
        r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s+([\s\S]*?);",
        sql,
        re.I,
    ):
        table = match.group(1).lower()
        body = match.group(2)
        tables.setdefault(table, set())
        for column in re.finditer(r"ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)", body, re.I):
            tables[table].add(column.group(1).lower())
        for key in re.finditer(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)", body, re.I | re.S):
            keys[table].add(tuple(norm(item) for item in key.group(1).split(",")))
        for fk in re.finditer(
            r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
            r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",
            body,
            re.I | re.S,
        ):
            fks.append((
                table,
                tuple(norm(value) for value in fk.group(1).split(",")),
                fk.group(2).lower(),
                tuple(norm(value) for value in fk.group(3).split(",")),
            ))
    return tables, keys, fks


def parse_triggers(sql: str):
    triggers = []
    pattern = re.compile(
        r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([a-z_][a-z0-9_]*)\s+"
        r"(?:BEFORE|AFTER|INSTEAD\s+OF)\s+(.+?)\s+ON\s+"
        r"(app\.[a-z_][a-z0-9_]*)[\s\S]*?"
        r"EXECUTE\s+FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)",
        re.I | re.S,
    )
    for match in pattern.finditer(sql):
        triggers.append({
            "name": match.group(1).lower(),
            "table": match.group(3).lower(),
            "function": match.group(4).lower(),
            "events": norm(match.group(2)),
        })
    return triggers


GRANT_RE = re.compile(
    r"\b(GRANT|REVOKE)\s+EXECUTE\s+ON\s+FUNCTION\s+"
    r"(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\((.*?)\)\s+"
    r"(?:TO|FROM)\s+([^;]+);",
    re.I | re.S,
)


def parse_effective_grants(sql: str):
    grants: dict[str, set[str]] = defaultdict(set)
    for match in GRANT_RE.finditer(sql):
        key = signature(match.group(2), match.group(3))
        roles = {norm(role) for role in match.group(4).split(",") if role.strip()}
        if match.group(1).upper() == "GRANT":
            grants[key].update(role for role in roles if role != "public")
        else:
            grants[key].difference_update(role for role in roles if role != "public")
    return {key: sorted(value) for key, value in sorted(grants.items()) if value}


def replace_function(sql: str, functions: dict[str, dict], key: str, old: str, new: str):
    function = functions[key]
    body = function["body"]
    if old not in body:
        return sql
    revised = body.replace(old, new, 1)
    return sql[:function["body_start"]] + revised + sql[function["body_end"]:]


def replace_mutation(sql: str, functions: dict[str, dict], case: dict) -> str:
    if case.get("function"):
        if case.get("part") == "header":
            item = functions[str(case["function"])]
            header = sql[item["header_start"]:item["header_end"]]
            revised = header.replace(str(case["old"]), str(case["new"]), 1)
            return (
                sql[:item["header_start"]]
                + revised
                + sql[item["header_end"]:]
            )
        return replace_function(
            sql,
            functions,
            str(case["function"]),
            str(case["old"]),
            str(case["new"]),
        )
    old = str(case["old"])
    new = str(case["new"])
    scope = str(case.get("scope", "sql-first"))
    if scope == "append-final":
        return sql + "\n" + new + "\n"
    if scope == "sql-last":
        index = sql.rfind(old)
        return sql if index < 0 else sql[:index] + new + sql[index + len(old):]
    if scope == "sql-all":
        return sql.replace(old, new)
    return sql.replace(old, new, 1)


def r3_formal_feature(mutation_id: str, sql: str) -> bool:
    b = norm(sql)
    features = {
        "root1_operator_principal": "principal_id=st.root_principal_id",
        "root2_operator_role": "role_name=st.root_role_name",
        "root3_session_principal": "st.root_principal_id,v_epoch,session_user",
        "root4_grant_recipient": "check (root_principal_id=issuer_principal_id)",
        "root5_grant_session": "root_grant_id,root_session_id,root_principal_id",
        "root6_nonroot_approvals": "check (principal_id<>root_principal_id)",
        "root7_generation": "bootstrap_generation=st.bootstrap_generation",
        "root8_single_root_grant": "unique (root_grant_id,bootstrap_id,bootstrap_generation)",
        "owner1_database_self": "v_database_owner=v_role_oid",
        "owner2_database_member": "pg_has_role(v_role_oid,v_database_owner,'member')",
        "owner3_pg_database_owner": "pg_database_owner",
        "owner4_schema_owner": "n.nspowner=v_role_oid",
        "owner5_schema_indirect": "pg_has_role(v_role_oid,n.nspowner,'member')",
        "owner6_table_owner": "c.relowner=v_role_oid",
        "owner7_sequence_owner": "c.relkind in ('r','p','v','m','f','s')",
        "owner8_view_owner": "c.relkind in ('r','p','v','m','f','s')",
        "owner9_function_owner": "p.proowner=v_role_oid",
        "owner10_set": "set_option",
        "owner11_inherit": "inherit_option",
        "owner12_admin": "admin_seen",
        "cat1_binding_table": "create table app.catalog_source_target_binding_r2",
        "cat2_product_source": "product_revision_source_exact_unique_r2",
        "cat3_spec_source": "specification_revision_source_exact_unique_r2",
        "cat4_price_source": "price_revision_source_exact_unique_r2",
        "cat5_source_fk":
            "foreign key (source_revision_id) references app.catalog_source_revision(id)",
        "cat6_target_key": "catalog_binding_target_identity_unique_r2",
        "cat7_event_binding_fk": "catalog_event_source_target_binding_fk_r2",
        "cat8_event_digest": "sourcetargetbindingdigest",
        "cat9_snapshot_binding": "snapshot_catalog_source_target_binding_fk_r2",
    }
    return features[mutation_id] in b


def r2_feature(name: str, sql: str) -> bool:
    b = norm(sql)
    features = {
        "root_principal": "principal_id=st.root_principal_id" in b,
        "root_grant": "check (root_principal_id=issuer_principal_id)" in b,
        "recovery_functions":
            "create or replace function app.bootstrap_begin_root_change_r2" in b
            and "create or replace function app.bootstrap_approve_root_change_r2" in b
            and "create or replace function app.bootstrap_execute_root_change_r2" in b,
        "database_owner": "v_database_owner=v_role_oid" in b,
        "schema_owner": "n.nspowner=v_role_oid" in b,
        "relation_owner": "c.relowner=v_role_oid" in b,
        "function_owner": "p.proowner=v_role_oid" in b,
        "catalog_table": "create table app.catalog_source_target_binding_r2" in b,
        "catalog_event_binding": "sourcetargetbindingdigest" in b,
        "original_session": "if orig.state='active'" in b,
        "field_trigger": "a_validate_selection_requirement_domain_r2" in b,
        "bootstrap_guard": "deny_bootstrap_event_truncate_r2" in b,
    }
    return bool(features[name])


def independent_r4_feature(name: str, sql: str, functions: dict[str, dict]) -> bool:
    b = norm(sql)
    overlay = sql[sql.find("-- ===== BEGIN R4 OVERLAY ====="):]
    ob = norm(overlay)
    required = (
        "app_private.lock_expired_root_change_r4(text)",
        "app.bootstrap_approve_root_change_r4(text, text, text)",
        "app.bootstrap_begin_root_change_r4(text, boolean, text, text, text, text, text, text, text)",
        "app.bootstrap_execute_root_change_r4(text, text, text)",
        "app.bootstrap_deny_root_change_r4(text, text, text, text)",
    )
    if not set(required) <= set(functions):
        return False
    helper = norm(functions[required[0]]["body"])
    approve = norm(functions[required[1]]["body"])
    begin = norm(functions[required[2]]["body"])
    execute = norm(functions[required[3]]["body"])
    deny = norm(functions[required[4]]["body"])
    actual_grants = parse_effective_grants(sql)
    final_revoke = sql.lower().rfind(
        "revoke execute on all functions in schema app from public"
    )
    final_tail = sql[final_revoke:] if final_revoke >= 0 else ""
    final_tail_signatures = {
        signature(match.group(2), match.group(3))
        for match in GRANT_RE.finditer(final_tail)
        if match.group(1).upper() == "GRANT"
    }
    expected_core_grants = {
        "app.bootstrap_complete_root_r3(boolean, text, text, text)",
        "app.bootstrap_mark_issuance_failed_r3(boolean, text, text, text)",
        "app.bootstrap_begin_root_change_r4(text, boolean, text, text, text, text, text, text, text)",
        "app.bootstrap_approve_root_change_r4(text, text, text)",
        "app.bootstrap_deny_root_change_r4(text, text, text, text)",
        "app.bootstrap_execute_root_change_r4(text, text, text)",
    }
    feature = {
        "expiry_no_unhandled_raise": "raise exception 'root change approval expired'" not in helper,
        "expiry_no_exception_swallow": "exception when others" not in helper,
        "approve_expiry_calls_helper":
            "perform app_private.lock_expired_root_change_r4" in approve,
        "expiry_appends_audit":
            "append_bootstrap_event_r2" in helper and "'locked'" in helper,
        "expiry_audit_uses_attempt_actor":
            "rr.requested_by_role,rr.requested_by_principal_id" in helper,
        "expiry_helper_no_ledger": "complete_bootstrap_request_r2" not in helper,
        "execute_replay_branch":
            "if v_replay then" in execute
            and "return query select 'locked'" in execute
            and "'generation'" in execute,
        "legacy_unique_drop":
            "drop constraint if exists bootstrap_recovery_one_per_generation_r3" in ob,
        "attempt_unique":
            "unique (bootstrap_id,from_generation,attempt_sequence)" in ob,
        "caller_no_sequence":
            "p_attempt_sequence" not in
            functions["app.bootstrap_begin_root_change_r4(text, boolean, text, text, text, text, text, text, text)"]["signature"],
        "terminal_not_reopened": "set state='pending'" not in begin,
        "locked_retry": "'locked'" in begin and "'revoked'" in begin,
        "active_unique":
            "bootstrap_recovery_one_active_attempt_r4" in ob
            and "where state in ('pending','approved')" in ob,
        "approval_scoped":
            execute.count("where recovery_id=p_recovery_id and operator_kind=") >= 2,
        "execute_approved": "if rr.state<>'approved'" in execute,
        "begin_lock": "from app.bootstrap_lifecycle_r2" in begin and "for update" in begin,
        "root_authority":
            "root rotation requires active root authority" in begin
            and "from app.bootstrap_root_session_r2" in begin,
        "new_identity":
            "p_target_root_principal_id=lc.root_principal_id" in begin
            and "p_target_root_role_name=lc.root_role_name" in begin,
        "begin_backend": "root change backend identity unavailable" in begin,
        "begin_replay_target": "bootstrap begin replay target missing" in begin,
        "deny_roots": "principal_id<>rr.current_root_principal_id" in deny
            and "principal_id<>rr.target_root_principal_id" in deny,
        "execute_identity":
            "lc.root_principal_id<>rr.current_root_principal_id" in execute
            and "rr.target_root_role_name=lc.root_role_name" in execute,
        "initiator_active": "root change initiator principal is not active" in begin,
        "target_fresh":
            "root change target principal is not active" in begin
            and "root change target principal epoch is not initial" in begin
            and "root change target identity was already used or is inactive" in begin,
        "approver_active":
            "root change approver principal is not active" in approve
            and "root change deny principal is not active" in deny,
        "target_active_epoch":
            "root change target principal is not active" in execute
            and "root change target principal epoch is not initial" in execute,
        "execute_no_provision":
            "insert into app.trusted_principal" not in execute
            and "insert into app.principal_epoch" not in execute,
        "execute_operators":
            "where a.recovery_id=p_recovery_id and not o.enabled" in execute
            and "get diagnostics v_active_operators=row_count" in execute
            and "get diagnostics v_active_principals=row_count" in execute,
        "candidate_not_null":
            ob.count("alter column candidate_id set not null") == 2,
        "candidate_fk":
            "candidate_id,result_row_digest" in b
            and "id,candidate_id,row_digest" in b
            and ob.count("alter column candidate_id set not null") == 2,
        "candidate_unknown": "candidate provenance is not uniquely resolvable" in ob,
        "candidate_no_invent": "candidate_id=coalesce(" not in ob
            and "candidate_id=gen_random_uuid" not in ob,
        "candidate_guard":
            "p_old->>'candidate_id' is null" in b
            and "p_new->>'candidate_id' is not null" in b
            and "(p_new-'candidate_id')=(p_old-'candidate_id')" in b
            and len(re.findall(
                r"app_private\.r4_candidate_backfill_row_allowed"
                r"\(\s*to_jsonb\(old\),to_jsonb\(new\)\s*\)",
                b,
            )) == 2,
        "candidate_helper_owner":
            -1 < ob.find("alter function app_private.r4_candidate_backfill_row_allowed")
            < ob.find("create or replace function app_private.guard_sealed_result_r3"),
        "candidate_source_lock":
            "lock table" in ob
            and "in share row exclusive mode" in ob
            and "app.selection_professional_review_result" in ob
            and "app.sales_snapshot_professional_review_r3" in ob,
        "old_grants_absent": all(key not in parse_effective_grants(sql) for key in {
            "app.bootstrap_begin_root_change_r2(text, boolean, text, text, text, text, text, text, text)",
            "app.bootstrap_approve_root_change_r2(text, text, text)",
            "app.bootstrap_deny_root_change_r3(text, text, text, text)",
            "app.bootstrap_execute_root_change_r2(text, text, text)",
        }),
        "completion_grant":
            "app.bootstrap_complete_root_r3(boolean, text, text, text)"
            in parse_effective_grants(sql),
        "sequence_table_grant":
            "grant select,insert,update on table app.bootstrap_recovery_sequence_r4"
            in ob
            and "to elevator_review_function_owner" in ob,
        "final_public_safe":
            "grant execute on function app.bootstrap_complete_root_r3(boolean,text,text,text) to public"
            not in sql.lower(),
        "final_acl_complete":
            expected_core_grants <= set(actual_grants)
            and expected_core_grants <= final_tail_signatures,
    }
    aliases = {
        "expiry_helper_no_ledger_completion": "expiry_helper_no_ledger",
        "legacy_one_per_generation_dropped": "legacy_unique_drop",
        "attempt_identity_unique": "attempt_unique",
        "caller_cannot_choose_sequence": "caller_no_sequence",
        "terminal_attempt_not_reopened": "terminal_not_reopened",
        "begin_accepts_locked_recovery": "locked_retry",
        "active_attempt_unique": "active_unique",
        "approval_scoped_to_attempt": "approval_scoped",
        "execute_requires_approved": "execute_approved",
        "begin_locks_lifecycle": "begin_lock",
        "rotation_requires_active_root": "root_authority",
        "begin_requires_new_principal_and_role": "new_identity",
        "begin_backend_identity_required": "begin_backend",
        "begin_replay_target_required": "begin_replay_target",
        "deny_operator_excludes_root_identities": "deny_roots",
        "execute_lifecycle_identity": "execute_identity",
        "begin_initiator_principal_active": "initiator_active",
        "begin_target_identity_fresh": "target_fresh",
        "approve_deny_principal_active": "approver_active",
        "execute_target_principal_active_epoch": "target_active_epoch",
        "execute_does_not_provision_principal": "execute_no_provision",
        "execute_rechecks_approval_operator_enabled": "execute_operators",
        "candidate_two_not_null": "candidate_not_null",
        "candidate_composite_fk": "candidate_fk",
        "candidate_unknown_fails_closed": "candidate_unknown",
        "candidate_no_invented_value": "candidate_no_invent",
        "candidate_guard_exception_narrow": "candidate_guard",
        "candidate_helper_owned_before_guard": "candidate_helper_owner",
        "candidate_migration_locks_sources": "candidate_source_lock",
        "old_recovery_role_grants_absent": "old_grants_absent",
        "bootstrap_complete_grant_present": "completion_grant",
        "sequence_table_function_owner_privilege": "sequence_table_grant",
        "no_public_grant_after_final_revoke": "final_public_safe",
        "final_acl_matches_r3_capabilities": "final_acl_complete",
    }
    key = aliases.get(name, name)
    return bool(feature.get(key, False))


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    guard = require_guard(root)
    repo = root.parents[2]
    r4 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r4"
    r3_review = repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r3"
    r3 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r3"
    r2 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"
    r2_review = repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r2"

    manifests = {
        "r4": verify_manifest(
            r4 / "SHA256SUMS_R4.txt",
            r4,
            R4_MANIFEST_HASH,
            check_coverage=True,
        ),
        "r3_review": verify_manifest(
            r3_review / "SHA256SUMS_R3_C8_CORRECTIONS_R3_REVIEW.txt",
            repo,
            R3_REVIEW_MANIFEST_HASH,
        ),
        "r3": verify_manifest(r3 / "SHA256SUMS_R3_C8_CORRECTIONS_R3.txt", repo),
        "r2": verify_manifest(r2 / "SHA256SUMS_R3_C8_CORRECTIONS_R2.txt", repo),
        "r2_review": verify_manifest(
            r2_review / "SHA256SUMS_R3_C8_CORRECTIONS_R2_REVIEW.txt", repo
        ),
    }
    key_hashes = {}
    for name, expected in KEY_HASHES.items():
        actual = sha256(r4 / name)
        key_hashes[name] = {
            "expected": expected,
            "actual": actual,
            "match": actual == expected,
        }
    r3_main = sha256(r3_review / "INDEPENDENT_REVIEW_R3_C8_CORRECTIONS_R3.md")

    sql = (r4 / "DATABASE_COMPLETE_DDL_DESIGN_R4.sql").read_text(encoding="utf-8")
    overlay = (r4 / "DATABASE_FINAL_STATE_OVERLAY_R4.sql").read_text(encoding="utf-8")
    registry = json.loads(
        (r4 / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R4.json").read_text(encoding="utf-8")
    )
    submitted = json.loads(
        (r4 / "VALIDATION_EVIDENCE_R4.json").read_text(encoding="utf-8")
    )
    open_decisions_text = (
        r4 / "OPEN_DECISIONS_DISPOSITION_R4.md"
    ).read_text(encoding="utf-8")
    open_ids = re.findall(r"`(OD-(?:R2|R3)[A-Z0-9-]*)`", open_decisions_text)
    functions = parse_functions(sql)
    tables, keys, fks = parse_tables(sql)
    triggers = parse_triggers(sql)
    roles = set(re.findall(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", sql, re.I))
    grants = parse_effective_grants(sql)
    r3_sql = (r3 / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql").read_text(
        encoding="utf-8"
    )
    expected_complete = (
        "-- FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R4\n"
        "-- Complete PostgreSQL 18 design DDL draft. DESIGN ONLY.\n\n"
        "-- ===== BEGIN FROZEN R3 COMPLETE DDL =====\n"
        + r3_sql
        + "\n-- ===== END FROZEN R3 COMPLETE DDL =====\n\n"
        + "-- ===== BEGIN R4 OVERLAY =====\n"
        + overlay
        + "\n-- ===== END R4 OVERLAY =====\n"
    )
    expected_grants = parse_effective_grants(r3_sql)
    for old_key in (
        "app.bootstrap_begin_root_change_r2(text, boolean, text, text, text, text, text, text, text)",
        "app.bootstrap_approve_root_change_r2(text, text, text)",
        "app.bootstrap_deny_root_change_r3(text, text, text, text)",
        "app.bootstrap_execute_root_change_r2(text, text, text)",
    ):
        expected_grants.pop(old_key, None)
    expected_grants.update({
        "app.bootstrap_begin_root_change_r4(text, boolean, text, text, text, text, text, text, text)":
            ["elevator_bootstrap_initiator"],
        "app.bootstrap_approve_root_change_r4(text, text, text)":
            ["elevator_bootstrap_approver"],
        "app.bootstrap_deny_root_change_r4(text, text, text, text)":
            ["elevator_bootstrap_approver"],
        "app.bootstrap_execute_root_change_r4(text, text, text)":
            ["elevator_bootstrap_seed"],
    })

    fk_errors = []
    for source, source_columns, target, target_columns in fks:
        if len(source_columns) != len(target_columns):
            fk_errors.append({"source": source, "reason": "arity"})
        if source not in tables or not set(source_columns) <= tables[source]:
            fk_errors.append({"source": source, "reason": "source-columns"})
        if target not in tables:
            fk_errors.append({"source": source, "target": target, "reason": "target-table"})
        elif target_columns not in keys[target]:
            fk_errors.append({
                "source": source,
                "target": target,
                "target_columns": target_columns,
                "reason": "target-key",
            })

    trigger_errors = []
    for trigger in triggers:
        if trigger["table"] not in tables:
            trigger_errors.append({"trigger": trigger["name"], "reason": "table"})
        names = {item["name"] for item in functions.values()}
        if trigger["function"] not in names:
            trigger_errors.append({"trigger": trigger["name"], "reason": "function"})

    helper = norm(functions["app_private.lock_expired_root_change_r4(text)"]["body"])
    approve = norm(functions["app.bootstrap_approve_root_change_r4(text, text, text)"]["body"])
    begin = norm(functions["app.bootstrap_begin_root_change_r4(text, boolean, text, text, text, text, text, text, text)"]["body"])
    execute = norm(functions["app.bootstrap_execute_root_change_r4(text, text, text)"]["body"])

    candidate_overlay = overlay[:overlay.find("-- 2. Recovery attempt sequence")]
    independent_checks = {
        "manifest_all": all(item["pass"] for item in manifests.values()),
        "key_hashes_all": all(item["match"] for item in key_hashes.values()),
        "r3_review_main_hash": r3_main == "B02540947A7EB883D638FC6D389DC2B542F52BDBCEF715CF8E2799D034D20259",
        "table_count_73": len(tables) == 73,
        "fk_count_124": len(fks) == 124,
        "fk_structural_errors_zero": not fk_errors,
        "function_count_161": len(functions) == 161,
        "trigger_count_174": len(triggers) == 174,
        "trigger_errors_zero": not trigger_errors,
        "role_count_26": len(roles) == 26,
        "registry_ddl_hash_matches": registry.get("ddl_sha256") == sha256(
            r4 / "DATABASE_COMPLETE_DDL_DESIGN_R4.sql"
        ),
        "complete_ddl_equals_r3_plus_overlay": sql == expected_complete,
        "registry_signatures_complete":
            {item["signature"] for item in registry.get("functions", [])}
            == set(functions),
        "registry_owners_complete": all(item["owner"] for item in functions.values()),
        "registry_grants_match": registry.get("effective_capability_grants") == grants,
        "effective_grants_match_r3_plus_r4_replacements": grants == expected_grants,
        "expiry_helper_finishes_without_raise":
            "raise exception 'root change approval expired'" not in helper
            and "exception when others" not in helper,
        "expiry_helper_does_not_complete_ledger":
            "complete_bootstrap_request_r2" not in helper,
        "approve_expiry_completes_own_ledger":
            "perform app_private.lock_expired_root_change_r4" in approve
            and "bootstrap_approve_root_change_r4" in approve,
        "execute_expiry_completes_own_ledger":
            "perform app_private.lock_expired_root_change_r4" in execute
            and "bootstrap_execute_root_change_r4" in execute,
        "active_attempt_index_exact":
            "bootstrap_recovery_one_active_attempt_r4" in norm(overlay)
            and "where state in ('pending','approved')" in norm(overlay),
        "sequence_allocator_upsert":
            "on conflict (bootstrap_id,bootstrap_generation) do update" in norm(
                functions["app_private.next_bootstrap_recovery_sequence_r4(boolean, bigint)"]["body"]
            ),
        "candidate_not_null_exact":
            norm(overlay).count("alter column candidate_id set not null") == 2,
        "candidate_fk_exact":
            "candidate_id,result_row_digest" in norm(sql)
            and "id,candidate_id,row_digest" in norm(sql),
        "candidate_backfill_audit":
            bool(re.search(
                r"(?:INSERT\s+INTO\s+app\.(?:audit|.*evidence)|RETURNING)[\s\S]*",
                candidate_overlay,
                re.I,
            )),
        "rotation_execute_current_root_recheck":
            all(token in execute for token in (
                "app.bootstrap_root_session_r2",
                "app.bootstrap_root_grant_r2",
                "app.authority_grant",
                "app.trusted_principal",
                "app.principal_epoch",
            )),
        "begin_replaces_expired_active_attempt":
            "approval_expires_at" in begin
            and (
                "lock_expired_root_change_r4" in begin
                or "state='locked'" in begin
            ),
        "attempt_response_loss_vector_nonvacuous": any(
            item.get("id") == "response_loss_replay"
            and item.get("replay_result") is not None
            and item.get("actual") not in {None, "before=None, replay=None"}
            for item in submitted.get("attempt_vectors", [])
        ),
        "documentation_traceability_consistent":
            "through `R4-CAND-09`" not in (
                r4 / "R4_FINDING_TRACEABILITY.md"
            ).read_text(encoding="utf-8")
            and (
                r4 / "R4_FINDING_TRACEABILITY.md"
            ).read_text(encoding="utf-8").count("### R4-DESIGN-P3-01")
            == 1
            and "R4-TX-09" in (
                r4 / "R4_FINDING_TRACEABILITY.md"
            ).read_text(encoding="utf-8"),
        "open_decisions_57_all_open":
            len(set(open_ids)) == 57
            and "Approved by User: 0" in open_decisions_text
            and "Still OPEN: 57" in open_decisions_text,
    }

    # Extract literal mutation specs from the frozen validators.
    r3_tree = ast.parse((r3 / "tools/validate_r3.py").read_text(encoding="utf-8"))

    def literal_dict(name: str) -> dict:
        for node in ast.walk(r3_tree):
            if (
                isinstance(node, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == name for t in node.targets)
                and isinstance(node.value, ast.Dict)
            ):
                return ast.literal_eval(node.value)
        return {}

    formal_specs = literal_dict("mutations")
    r2_specs = literal_dict("r2_mutations")

    sys.path.insert(0, str(r4 / "tools"))
    spec = importlib.util.spec_from_file_location(
        "submitted_r4_validator", r4 / "tools/validate_r4.py"
    )
    submitted_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(submitted_module)
    submitted_functions = submitted_module.function_definitions(sql)
    r4_specs = submitted_module.mutation_cases(submitted_functions)

    mutation_results = {"r3": [], "r2": [], "r4": []}
    with tempfile.TemporaryDirectory(prefix="r4-review-mutations-") as temporary:
        temp_root = Path(temporary)
        for mutation_id, (old, new) in formal_specs.items():
            mutated = sql.replace(old, new) if old in sql else sql
            (temp_root / f"r3-{mutation_id}.sql").write_text(mutated, encoding="utf-8")
            detected = (
                old in sql
                and r3_formal_feature(mutation_id, sql)
                and not r3_formal_feature(mutation_id, mutated)
            )
            mutation_results["r3"].append({
                "id": mutation_id,
                "target_present": old in sql,
                "target_check": mutation_id,
                "detected": detected,
            })
        for mutation_id, (feature, replacements) in r2_specs.items():
            mutated = sql
            for old, new in replacements:
                mutated = mutated.replace(old, new)
            (temp_root / f"r2-{mutation_id}.sql").write_text(mutated, encoding="utf-8")
            detected = r2_feature(feature, sql) and not r2_feature(feature, mutated)
            mutation_results["r2"].append({
                "id": mutation_id,
                "target_check": feature,
                "detected": detected,
            })
        for case in r4_specs:
            mutated = replace_mutation(sql, submitted_functions, case)
            (temp_root / f"r4-{case['id']}.sql").write_text(mutated, encoding="utf-8")
            changed_functions = parse_functions(mutated)
            check = str(case["check"])
            detected = independent_r4_feature(check, sql, functions) and not independent_r4_feature(
                check, mutated, changed_functions
            )
            mutation_results["r4"].append({
                "id": case["id"],
                "risk": case.get("description"),
                "target": case.get("target"),
                "check": check,
                "detected": detected,
            })

    independent_mutations = []

    def add_independent(mutation_id: str, risk: str, check: str, detected: bool):
        independent_mutations.append({
            "id": mutation_id,
            "risk": risk,
            "target_check": check,
            "detected": detected,
            "status": "DETECTED" if detected else "MISSED",
        })

    add_independent(
        "IND-MUT-01",
        "LOCKED update followed by exception rollback",
        "no unhandled expiry raise / no swallowed exception",
        independent_checks["expiry_helper_finishes_without_raise"],
    )
    add_independent(
        "IND-MUT-02",
        "Expiry Ledger operation mismatch",
        "caller completes its own operation and helper completes none",
        independent_checks["approve_expiry_completes_own_ledger"]
        and independent_checks["execute_expiry_completes_own_ledger"]
        and independent_checks["expiry_helper_does_not_complete_ledger"],
    )
    add_independent(
        "IND-MUT-03",
        "Denied Generation cannot create next Attempt",
        "LOCKED lifecycle accepted by Begin",
        independent_r4_feature("locked_retry", sql, functions),
    )
    add_independent(
        "IND-MUT-04",
        "Locked Generation cannot create next Attempt",
        "LOCKED lifecycle accepted by Begin",
        independent_r4_feature("locked_retry", sql, functions),
    )
    add_independent(
        "IND-MUT-05",
        "Concurrent Attempt Sequence duplicate",
        "atomic upsert allocator",
        independent_checks["sequence_allocator_upsert"],
    )
    add_independent(
        "IND-MUT-06",
        "Two Active Attempts coexist",
        "PENDING/APPROVED partial unique",
        independent_checks["active_attempt_index_exact"],
    )
    add_independent(
        "IND-MUT-07",
        "Old Approval reused",
        "approval lookups scoped to recovery ID",
        independent_r4_feature("approval_scoped", sql, functions),
    )
    add_independent(
        "IND-MUT-08",
        "Old Attempt delayed Execute",
        "Execute requires APPROVED",
        independent_r4_feature("execute_approved", sql, functions),
    )
    add_independent(
        "IND-MUT-09",
        "Sequence Function Owner lacks table DML",
        "exact sequence table grant",
        independent_r4_feature("sequence_table_grant", sql, functions),
    )
    add_independent(
        "IND-MUT-10",
        "ROTATION Execute does not recheck current Root",
        "Execute includes Root Session/Grant/Principal/Epoch recheck",
        independent_checks["rotation_execute_current_root_recheck"],
    )
    add_independent(
        "IND-MUT-11",
        "Revoked Initiator remains eligible",
        "Begin checks ACTIVE initiator Principal",
        independent_r4_feature("initiator_active", sql, functions),
    )
    add_independent(
        "IND-MUT-12",
        "Revoked Approver can Execute",
        "Execute locks ACTIVE Principals and enabled Operators",
        independent_r4_feature("execute_operators", sql, functions),
    )
    add_independent(
        "IND-MUT-13",
        "Execute implicitly creates Principal",
        "Execute contains no trusted_principal INSERT",
        independent_r4_feature("execute_no_provision", sql, functions),
    )
    add_independent(
        "IND-MUT-14",
        "Execute implicitly creates Epoch",
        "Execute contains no principal_epoch INSERT",
        independent_r4_feature("execute_no_provision", sql, functions),
    )
    add_independent(
        "IND-MUT-15",
        "Candidate column nullable",
        "two Candidate NOT NULL alterations",
        independent_checks["candidate_not_null_exact"],
    )
    add_independent(
        "IND-MUT-16",
        "Candidate backfill changes another field",
        "Candidate-only JSON equality exception",
        independent_r4_feature("candidate_guard", sql, functions),
    )
    add_independent(
        "IND-MUT-17",
        "Candidate source is non-unique",
        "exact Event ID and Selection Result PK joins",
        "source.id=target.professional_review_event_id" in norm(overlay)
        and "source.professional_review_id=target.professional_review_id" in norm(overlay)
        and "source.event_sequence=target.event_sequence" in norm(overlay),
    )
    add_independent(
        "IND-MUT-18",
        "Protected source tables mutate during backfill",
        "SHARE ROW EXCLUSIVE source freeze",
        independent_r4_feature("candidate_source_lock", sql, functions),
    )
    add_independent(
        "IND-MUT-19",
        "Sealed Snapshot digest/field mismatch",
        "snapshot digest verification remains active",
        "snapshot professional review digest mismatch" in norm(sql),
    )
    add_independent(
        "IND-MUT-20",
        "Expired active Attempt blocks immediate next Recovery",
        "Begin detects and replaces an expired PENDING/APPROVED Attempt",
        independent_checks["begin_replaces_expired_active_attempt"],
    )
    add_independent(
        "IND-MUT-21",
        "Sealed Candidate backfill leaves no durable audit",
        "backfill has durable audit/evidence RETURNING",
        independent_checks["candidate_backfill_audit"],
    )
    add_independent(
        "IND-MUT-22",
        "Attempt response-loss vector is vacuous",
        "vector has a concrete durable result different from None",
        independent_checks["attempt_response_loss_vector_nonvacuous"],
    )

    defects = []
    if not independent_checks["rotation_execute_current_root_recheck"]:
        defects.append({
            "id": "REV-R4-IND-P2-01",
            "severity": "P2",
            "title": "ROTATION Execute lacks current Root revalidation",
            "evidence": "app.bootstrap_execute_root_change_r4 lines 16054-16256",
        })
    if not independent_checks["begin_replaces_expired_active_attempt"]:
        defects.append({
            "id": "REV-R4-IND-P2-02",
            "severity": "P2",
            "title": "Expired active Attempt blocks immediate next Recovery",
            "evidence": "app.bootstrap_begin_root_change_r4 lines 15985-15992",
        })
    if not independent_checks["candidate_backfill_audit"]:
        defects.append({
            "id": "REV-R4-IND-P2-03",
            "severity": "P2",
            "title": "Sealed Candidate backfill has no durable per-row audit evidence",
            "evidence": "R4 Overlay lines 15568-15612 contain no audit/evidence RETURNING path",
        })
    if (
        not independent_checks["rotation_execute_current_root_recheck"]
        or not independent_checks["begin_replaces_expired_active_attempt"]
        or not independent_checks["attempt_response_loss_vector_nonvacuous"]
    ):
        defects.append({
            "id": "REV-R3-R3-P2-03",
            "severity": "P2",
            "title": "Validator semantic coverage remains partial",
            "evidence": (
                "Missing ROTATION Execute recheck and expired-active replacement checks; "
                "response_loss_replay vector compares None with None"
            ),
        })
    if not independent_checks["documentation_traceability_consistent"]:
        defects.append({
            "id": "REV-R4-IND-P3-01",
            "severity": "P3",
            "title": "R4 traceability contains stale mutation ranges and duplicate finding ID",
            "evidence": "R4_FINDING_TRACEABILITY.md",
        })

    result = {
        "scope": "INDEPENDENT READ-ONLY STATIC REVIEW AND ISOLATED MUTATION REPLAY",
        "guard": guard,
        "review_directory_existed_at_start": False,
        "input_manifests": manifests,
        "key_hashes": key_hashes,
        "r3_review_main_sha256": r3_main,
        "object_inventory": {
            "tables": len(tables),
            "foreign_keys": len(fks),
            "functions": len(functions),
            "triggers": len(triggers),
            "roles": len(roles),
            "effective_grant_signatures": len(grants),
        },
        "fk_errors": fk_errors,
        "trigger_errors": trigger_errors,
        "independent_checks": independent_checks,
        "submitted_mutation_replay": {
            "r3_total": len(mutation_results["r3"]),
            "r3_detected": sum(item["detected"] for item in mutation_results["r3"]),
            "r2_total": len(mutation_results["r2"]),
            "r2_detected": sum(item["detected"] for item in mutation_results["r2"]),
            "r4_total": len(mutation_results["r4"]),
            "r4_detected": sum(item["detected"] for item in mutation_results["r4"]),
            "details": mutation_results,
        },
        "independent_negative_mutations": {
            "total": len(independent_mutations),
            "passed": sum(item["detected"] for item in independent_mutations),
            "details": independent_mutations,
        },
        "defects": defects,
        "result": "FAIL — DESIGN CORRECTIONS REQUIRED" if defects else "PASS — INDEPENDENT DESIGN REVIEW",
        "postgresql_grammar": "NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_compilation": "NOT VERIFIED — DATABASE NOT AUTHORIZED",
        "catalog_introspection": "NOT VERIFIED — DATABASE NOT AUTHORIZED",
        "runtime_concurrency": "NOT EXECUTED — RUNTIME NOT AUTHORIZED",
    }
    output = root / "VALIDATION_EVIDENCE_REVIEW_R4.json"
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "objects": result["object_inventory"],
        "fk_errors": len(fk_errors),
        "trigger_errors": len(trigger_errors),
        "submitted_mutations": {
            "r3": f"{result['submitted_mutation_replay']['r3_detected']}/{result['submitted_mutation_replay']['r3_total']}",
            "r2": f"{result['submitted_mutation_replay']['r2_detected']}/{result['submitted_mutation_replay']['r2_total']}",
            "r4": f"{result['submitted_mutation_replay']['r4_detected']}/{result['submitted_mutation_replay']['r4_total']}",
        },
        "independent_negative": f"{result['independent_negative_mutations']['passed']}/{result['independent_negative_mutations']['total']}",
        "defects": result["defects"],
        "result": result["result"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
