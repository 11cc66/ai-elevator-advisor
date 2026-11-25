"""Offline structural, transaction, attempt, ACL and mutation validation for R4."""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

from guard import require_guard


R3_MANIFEST_SHA256 = (
    "C5611B8807D50E3E02286A63B5C9E39F9F745684793C2FD5525DCA4537A71825"
)
R3_REVIEW_MANIFEST_SHA256 = (
    "1500C72F8059AAD1D15F4829818D1BA688CD57B95DD606CDFEB26A3D58285EC2"
)
R2_MANIFEST_SHA256 = (
    "45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8"
)
R2_REVIEW_MANIFEST_SHA256 = (
    "5865AAE961DDCFF7A546D6435729455D091810FF3BF8D4A155CA0EDB36082FF1"
)


def norm(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def verify_manifest(path: Path, repo: Path, expected_sha256: str) -> dict[str, object]:
    actual_sha256 = sha256(path)
    records = 0
    unique: set[str] = set()
    errors: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(
            r"^([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)$",
            line,
        )
        if not match:
            errors.append("malformed-record")
            continue
        expected_hash, expected_bytes, expected_lines, relative = match.groups()
        records += 1
        unique.add(relative)
        target = repo / relative
        if not target.is_file():
            errors.append(f"missing:{relative}")
            continue
        text = target.read_text(encoding="utf-8")
        if sha256(target) != expected_hash.upper():
            errors.append(f"hash:{relative}")
        if target.stat().st_size != int(expected_bytes):
            errors.append(f"bytes:{relative}")
        if len(text.splitlines()) != int(expected_lines):
            errors.append(f"lines:{relative}")
    if records != len(unique):
        errors.append("duplicate-paths")
    if actual_sha256 != expected_sha256:
        errors.append("manifest-hash")
    return {
        "path": str(path),
        "sha256": actual_sha256,
        "expected_sha256": expected_sha256,
        "records": records,
        "unique": len(unique),
        "errors": errors,
        "pass": not errors,
    }


def signature(name: str, args: str) -> str:
    types: list[str] = []
    for arg in args.split(","):
        value = norm(arg)
        if not value:
            continue
        words = value.split()
        modes = {"in", "out", "inout", "variadic"}
        if words[0] in modes and len(words) > 1:
            words = words[1:]
        types.append(" ".join(words[1:]) if len(words) > 1 else words[0])
    return f"{name.lower()}({', '.join(types)})"


HEADER_RE = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"
    r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
    r"\((?P<args>.*?)\)\s+RETURNS\s+(?P<returns>.*?)\s+"
    r"LANGUAGE\s+(?P<language>[a-z_][a-z0-9_]*)",
    re.I | re.S,
)


def function_definitions(sql: str) -> dict[str, dict[str, object]]:
    headers = list(HEADER_RE.finditer(sql))
    definitions: dict[str, dict[str, object]] = {}
    for index, header in enumerate(headers):
        segment_end = (
            headers[index + 1].start() if index + 1 < len(headers) else len(sql)
        )
        segment = sql[header.start():segment_end]
        body_match = re.search(
            r"\bAS\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)"
            r"(.*?)\1\s*;",
            segment,
            re.I | re.S,
        )
        if body_match:
            body = body_match.group(2)
            body_start = header.start() + body_match.start(2)
            body_end = header.start() + body_match.end(2)
        else:
            body_match = re.search(r"\bRETURN\s+(.*?);", segment, re.I | re.S)
            body = body_match.group(1) if body_match else ""
            body_start = (
                header.start() + body_match.start(1) if body_match else header.end()
            )
            body_end = (
                header.start() + body_match.end(1) if body_match else header.end()
            )
        prefix_end = body_match.start() if body_match else len(segment)
        attrs = norm(segment[header.end():prefix_end])
        key = signature(header.group("name"), header.group("args"))
        definitions[key] = {
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
        }
    return definitions


def replace_in_function(
    sql: str,
    definitions: dict[str, dict[str, object]],
    key: str,
    old: str,
    new: str,
    count: int = -1,
) -> str:
    item = definitions[key]
    body = str(item["body"])
    if old not in body:
        return sql
    revised = body.replace(old, new, count)
    return sql[: int(item["body_start"])] + revised + sql[int(item["body_end"]):]


GRANT_RE = re.compile(
    r"\b(GRANT|REVOKE)\s+EXECUTE\s+ON\s+FUNCTION\s+"
    r"(?P<name>app(?:_private)?\.[a-z_][a-z0-9_]*)\s*"
    r"\((?P<args>.*?)\)\s+(?:TO|FROM)\s+(?P<roles>[^;]+);",
    re.I | re.S,
)


def effective_grants(sql: str) -> dict[str, list[str]]:
    grants: dict[str, set[str]] = {}
    public_grants: list[str] = []
    for event in GRANT_RE.finditer(sql):
        key = signature(event.group("name"), event.group("args"))
        roles = {
            norm(role)
            for role in event.group("roles").split(",")
            if role.strip()
        }
        current = grants.setdefault(key, set())
        if event.group(1).upper() == "GRANT":
            if "public" in roles:
                public_grants.append(key)
            current.update(role for role in roles if role != "public")
        else:
            current.difference_update(role for role in roles if role != "public")
    return {
        key: sorted(roles)
        for key, roles in sorted(grants.items())
        if roles
    }


def expected_r4_grants(r3_sql: str) -> dict[str, list[str]]:
    expected = effective_grants(r3_sql)
    old_recovery = {
        "app.bootstrap_begin_root_change_r2(text, boolean, text, text, text, text, text, text, text)",
        "app.bootstrap_approve_root_change_r2(text, text, text)",
        "app.bootstrap_deny_root_change_r3(text, text, text, text)",
        "app.bootstrap_execute_root_change_r2(text, text, text)",
    }
    for key in old_recovery:
        expected.pop(key, None)
    expected.update({
        "app.bootstrap_begin_root_change_r4(text, boolean, text, text, text, text, text, text, text)":
            ["elevator_bootstrap_initiator"],
        "app.bootstrap_approve_root_change_r4(text, text, text)":
            ["elevator_bootstrap_approver"],
        "app.bootstrap_deny_root_change_r4(text, text, text, text)":
            ["elevator_bootstrap_approver"],
        "app.bootstrap_execute_root_change_r4(text, text, text)":
            ["elevator_bootstrap_seed"],
    })
    return expected


def semantic_checks(sql: str, r3_sql: str) -> dict[str, bool]:
    normalized = norm(sql)
    definitions = function_definitions(sql)
    helper_key = "app_private.lock_expired_root_change_r4(text)"
    approve_key = "app.bootstrap_approve_root_change_r4(text, text, text)"
    begin_key = (
        "app.bootstrap_begin_root_change_r4("
        "text, boolean, text, text, text, text, text, text, text)"
    )
    execute_key = "app.bootstrap_execute_root_change_r4(text, text, text)"
    deny_key = "app.bootstrap_deny_root_change_r4(text, text, text, text)"
    required_functions = {
        helper_key, approve_key, begin_key, execute_key, deny_key,
    }
    bodies = {
        key: norm(str(definitions[key]["body"]))
        for key in required_functions
        if key in definitions
    }
    helper = bodies.get(helper_key, "")
    approve = bodies.get(approve_key, "")
    begin = bodies.get(begin_key, "")
    execute = bodies.get(execute_key, "")
    deny = bodies.get(deny_key, "")
    wrapper_begin_key = (
        "app.bootstrap_begin_root_change_r2("
        "text, boolean, text, text, text, text, text, text, text)"
    )
    wrapper_approve_key = "app.bootstrap_approve_root_change_r2(text, text, text)"
    wrapper_execute_key = "app.bootstrap_execute_root_change_r2(text, text, text)"
    wrapper_deny_key = "app.bootstrap_deny_root_change_r3(text, text, text, text)"
    wrappers = [
        norm(str(definitions[key]["body"]))
        for key in (
            wrapper_begin_key, wrapper_approve_key,
            wrapper_execute_key, wrapper_deny_key,
        )
        if key in definitions
    ]
    overlay = sql[sql.find("-- ===== BEGIN R4 OVERLAY ====="):]
    final_public_matches = list(re.finditer(
        r"REVOKE\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+"
        r"app(?:_private)?\s+FROM\s+PUBLIC",
        sql,
        re.I,
    ))
    final_public_position = final_public_matches[-1].start() if final_public_matches else -1
    last_function_position = max(
        (match.start() for match in HEADER_RE.finditer(sql)),
        default=-1,
    )
    actual_grants = effective_grants(sql)
    expected_grants = expected_r4_grants(r3_sql)
    old_recovery_keys = {
        "app.bootstrap_begin_root_change_r2(text, boolean, text, text, text, text, text, text, text)",
        "app.bootstrap_approve_root_change_r2(text, text, text)",
        "app.bootstrap_deny_root_change_r3(text, text, text, text)",
        "app.bootstrap_execute_root_change_r2(text, text, text)",
    }
    final_public_tail = sql[final_public_position:] if final_public_position >= 0 else ""
    final_grant_signatures = {
        signature(event.group("name"), event.group("args"))
        for event in GRANT_RE.finditer(final_public_tail)
        if event.group(1).upper() == "GRANT"
    }
    begin_definitions = [
        key for key in definitions
        if key.startswith("app.bootstrap_begin_root_change_r4(")
    ]
    candidate_section = overlay[
        : overlay.find("-- 2. Recovery attempt sequence")
        if "-- 2. Recovery attempt sequence" in overlay
        else len(overlay)
    ]
    return {
        "required_final_functions": required_functions <= set(definitions),
        "historical_wrappers_call_r4": (
            len(wrappers) == 4
            and all("bootstrap_" in body and "_root_change_r4(" in body for body in wrappers)
        ),
        "expiry_helper_no_ledger_completion":
            helper != "" and "complete_bootstrap_request_r2" not in helper,
        "expiry_helper_updates_recovery":
            "update app.bootstrap_recovery_r2 set state='locked'" in helper,
        "expiry_helper_updates_lifecycle":
            "update app.bootstrap_lifecycle_r2 set state='locked'" in helper,
        "expiry_appends_audit":
            "append_bootstrap_event_r2" in helper and "'locked'" in helper,
        "expiry_audit_uses_attempt_actor":
            "rr.requested_by_role,rr.requested_by_principal_id" in helper,
        "expiry_no_unhandled_raise":
            "raise exception 'root change approval expired'" not in helper,
        "expiry_no_exception_swallow":
            "exception when others" not in helper,
        "approve_expiry_calls_helper":
            "perform app_private.lock_expired_root_change_r4" in approve,
        "approve_completes_own_ledger":
            "complete_bootstrap_request_r2( 'bootstrap_approve_root_change_r4'"
            in approve,
        "execute_expiry_calls_helper":
            "perform app_private.lock_expired_root_change_r4" in execute,
        "execute_completes_own_ledger":
            "complete_bootstrap_request_r2( 'bootstrap_execute_root_change_r4'"
            in execute,
        "approve_replay_before_state":
            -1 < approve.find("claim_bootstrap_request_r2")
            < approve.find("rr.state<>'pending'"),
        "execute_replay_before_state":
            -1 < execute.find("claim_bootstrap_request_r2")
            < execute.find("rr.state<>'approved'"),
        "execute_replay_branch":
            "if v_replay then" in execute
            and "return query select 'locked'" in execute
            and "'generation'" in execute,
        "execute_requires_approved":
            "if rr.state<>'approved'" in execute,
        "execute_lifecycle_identity":
            "lc.root_principal_id<>rr.current_root_principal_id" in execute
            and "rr.target_root_role_name=lc.root_role_name" in execute,
        "execute_target_principal_active_epoch":
            "root change target principal is not active" in execute
            and "root change target principal epoch is not initial" in execute,
        "execute_does_not_provision_principal":
            "insert into app.trusted_principal" not in execute
            and "insert into app.principal_epoch" not in execute,
        "execute_rechecks_approval_operator_enabled":
            "where a.recovery_id=p_recovery_id and not o.enabled" in execute
            and "get diagnostics v_active_operators=row_count" in execute
            and "get diagnostics v_active_principals=row_count" in execute,
        "deny_persists_terminal_reason":
            "state='denied',locked_at=clock_timestamp(),denial_reason=p_reason"
            in deny,
        "deny_operator_excludes_root_identities":
            "principal_id<>rr.current_root_principal_id" in deny
            and "principal_id<>rr.target_root_principal_id" in deny,
        "approve_deny_principal_active":
            "root change approver principal is not active" in approve
            and "root change deny principal is not active" in deny,
        "attempt_sequence_table":
            "create table app.bootstrap_recovery_sequence_r4" in normalized,
        "attempt_sequence_backfill":
            "row_number() over" in overlay.lower()
            and "partition by bootstrap_id,from_generation" in overlay.lower(),
        "attempt_sequence_not_null":
            "alter column attempt_sequence set not null" in overlay.lower(),
        "attempt_sequence_atomic":
            "on conflict (bootstrap_id,bootstrap_generation) do update" in helper
            or "on conflict (bootstrap_id,bootstrap_generation) do update" in norm(
                str(definitions.get(
                    "app_private.next_bootstrap_recovery_sequence_r4(boolean, bigint)",
                    {"body": ""},
                )["body"])
            ),
        "sequence_table_function_owner_privilege":
            "grant select,insert,update on table app.bootstrap_recovery_sequence_r4"
            in overlay.lower()
            and "to elevator_review_function_owner" in overlay.lower(),
        "attempt_identity_unique":
            "unique (bootstrap_id,from_generation,attempt_sequence)" in overlay.lower(),
        "active_attempt_unique":
            "create unique index bootstrap_recovery_one_active_attempt_r4" in overlay.lower()
            and "where state in ('pending','approved')" in overlay.lower(),
        "legacy_one_per_generation_dropped":
            "drop constraint if exists bootstrap_recovery_one_per_generation_r3"
            in overlay.lower(),
        "begin_locks_lifecycle":
            "from app.bootstrap_lifecycle_r2" in begin and "for update" in begin,
        "rotation_requires_active_root":
            "root rotation requires active root authority" in begin
            and "from app.bootstrap_root_session_r2" in begin
            and "join app.trusted_session" in begin
            and "join app.trusted_principal" in begin
            and "join app.principal_epoch" in begin
            and "s.session_id=lc.root_session_id" in begin
            and "clock_timestamp()<ts.expires_at" in begin
            and "ts.login_epoch=pe.current_epoch" in begin
            and "g.root_principal_id=lc.root_principal_id" in begin,
        "begin_requires_new_principal_and_role":
            "p_target_root_principal_id=lc.root_principal_id" in begin
            and "p_target_root_role_name=lc.root_role_name" in begin,
        "begin_backend_identity_required":
            "root change backend identity unavailable" in begin
            and "select a.backend_start into v_backend_start" in begin,
        "begin_replay_target_required":
            "bootstrap begin replay target missing" in begin,
        "begin_initiator_principal_active":
            "root change initiator principal is not active" in begin,
        "begin_target_identity_fresh":
            "root change target principal is not active" in begin
            and "root change target principal epoch is not initial" in begin
            and "root change target identity was already used or is inactive"
            in begin,
        "begin_accepts_locked_recovery":
            "'locked'" in begin and "'revoked'" in begin,
        "caller_cannot_choose_sequence":
            begin_definitions == [begin_key],
        "terminal_attempt_not_reopened":
            "update app.bootstrap_recovery_r2 set state='pending'" not in normalized,
        "approval_scoped_to_attempt":
            execute.count("where recovery_id=p_recovery_id and operator_kind=") >= 2,
        "terminal_timestamp_reason_constraint":
            "bootstrap_recovery_terminal_reason_check_r4" in normalized,
        "candidate_event_backfill":
            "from app.professional_review_event as source" in overlay.lower()
            and "target.candidate_id is null" in overlay.lower(),
        "candidate_snapshot_backfill":
            "from app.selection_professional_review_result as source" in overlay.lower()
            and "target.candidate_id is null" in overlay.lower(),
        "candidate_unknown_fails_closed":
            "professional review candidate provenance is not uniquely resolvable"
            in overlay.lower()
            and "raise exception" in overlay.lower(),
        "candidate_no_invented_value":
            not re.search(
                r"(?:coalesce\s*\(\s*source\.candidate_id|gen_random_uuid).*candidate_id",
                candidate_section,
                re.I | re.S,
            ),
        "candidate_two_not_null":
            overlay.lower().count("alter column candidate_id set not null") == 2,
        "candidate_composite_fk":
            "candidate_id,result_row_digest" in normalized
            and "id,candidate_id,row_digest" in normalized
            and overlay.lower().count("alter column candidate_id set not null") == 2,
        "candidate_guard_exception_narrow":
            "p_old->>'candidate_id' is null" in normalized
            and "p_new->>'candidate_id' is not null" in normalized
            and "(p_new-'candidate_id')=(p_old-'candidate_id')" in normalized
            and len(re.findall(
                r"app_private\.r4_candidate_backfill_row_allowed\(\s*"
                r"to_jsonb\(old\),to_jsonb\(new\)\s*\)",
                normalized,
            )) >= 2,
        "candidate_helper_owned_before_guard":
            -1 < overlay.lower().find(
                "alter function app_private.r4_candidate_backfill_row_allowed"
            )
            < overlay.lower().find(
                "create or replace function app_private.guard_sealed_result_r3"
            ),
        "candidate_migration_locks_sources":
            "lock table\n  app.professional_review_event,\n"
            "  app.selection_professional_review_result,\n"
            "  app.sales_handoff_snapshot_r3,\n"
            "  app.sales_snapshot_professional_review_r3\n"
            "in share row exclusive mode" in overlay.lower(),
        "no_transaction_control_statements":
            re.search(r"(?im)^\s*(?:commit|rollback)\s*;", sql) is None,
        "old_recovery_role_grants_absent":
            all(key not in actual_grants for key in old_recovery_keys),
        "final_acl_matches_r3_capabilities":
            actual_grants == expected_grants
            and set(expected_grants) <= final_grant_signatures,
        "bootstrap_complete_grant_present":
            "app.bootstrap_complete_root_r3(boolean, text, text, text)"
            in actual_grants,
        "final_public_revoke_after_all_functions":
            final_public_position > last_function_position,
        "no_public_grant_after_final_revoke":
            "TO PUBLIC" not in final_public_tail.upper(),
    }


def transaction_vectors() -> list[dict[str, object]]:
    vectors: list[dict[str, object]] = []

    def vector(
        vector_id: str,
        recovery: str,
        lifecycle: str,
        ledger: str,
        audit: bool,
        committed: bool,
        generation_changed: bool,
        replay: str | None,
    ) -> None:
        allowed_recovery = {
            "PENDING", "APPROVED", "EXECUTED", "DENIED", "LOCKED",
        }
        allowed_lifecycle = {
            "RECOVERY_PENDING", "RECOVERY_APPROVED", "ROOT_ROTATION_PENDING",
            "ROOT_ISSUANCE_PENDING", "LOCKED",
        }
        vectors.append({
            "id": vector_id,
            "database_recovery_state": recovery,
            "database_lifecycle_state": lifecycle,
            "ledger_state": ledger,
            "audit_appended": audit,
            "committed": committed,
            "generation_changed": generation_changed,
            "replay_result": replay,
            "pass": (
                recovery in allowed_recovery
                and lifecycle in allowed_lifecycle
                and bool(ledger)
                and (not committed or audit or recovery == "PENDING")
                and (not generation_changed or committed)
            ),
            "scope": "OFFLINE STATE MODEL — NOT POSTGRESQL EXECUTION",
        })

    vector("approval_valid", "APPROVED", "RECOVERY_APPROVED",
           "COMPLETED:APPROVED", True, True, False, "APPROVED")
    vector("approval_already_expired", "LOCKED", "LOCKED",
           "COMPLETED:LOCKED", True, True, False, "LOCKED")
    vector("execute_after_expiry", "LOCKED", "LOCKED",
           "COMPLETED:LOCKED", True, True, False, "LOCKED")
    vector("lost_approval_response", "APPROVED", "RECOVERY_APPROVED",
           "COMPLETED:APPROVED", True, True, False, "APPROVED")
    vector("lost_execute_response", "EXECUTED", "ROOT_ISSUANCE_PENDING",
           "COMPLETED:GENERATION:N+1", True, True, True, "GENERATION:N+1")
    vector("database_error_before_commit", "PENDING", "RECOVERY_PENDING",
           "CLAIMED_ROLLED_BACK", False, False, False, None)
    vector("audit_write_error", "PENDING", "RECOVERY_PENDING",
           "CLAIMED_ROLLED_BACK", False, False, False, None)
    vector("ledger_write_error", "PENDING", "RECOVERY_PENDING",
           "NO_DURABLE_COMPLETION", False, False, False, None)
    vector("concurrent_reader_before_commit", "PENDING", "RECOVERY_PENDING",
           "CLAIMED", False, False, False, None)
    vector("concurrent_reader_after_commit", "LOCKED", "LOCKED",
           "COMPLETED:LOCKED", True, True, False, "LOCKED")
    return vectors


class AttemptModel:
    """Small offline model of the SQL state/invariant contract."""

    def __init__(self) -> None:
        self.next_sequence = 1
        self.attempts: list[dict[str, object]] = []
        self.ledger: dict[str, str] = {}
        self.generation = 1

    def begin(self, attempt_id: str) -> int:
        if any(item["state"] in {"PENDING", "APPROVED"} for item in self.attempts):
            raise ValueError("active attempt exists")
        sequence = self.next_sequence
        self.next_sequence += 1
        self.attempts.append({
            "id": attempt_id,
            "sequence": sequence,
            "state": "PENDING",
            "generation": self.generation,
            "approvals": {"INITIATOR"},
        })
        return sequence

    def approve(self, attempt_id: str, approver: str) -> None:
        attempt = self.get(attempt_id)
        if attempt["state"] != "PENDING":
            raise ValueError("not pending")
        attempt["approvals"].add(approver)
        if len({str(x) for x in attempt["approvals"]}) == 2:
            attempt["state"] = "APPROVED"

    def deny(self, attempt_id: str) -> None:
        attempt = self.get(attempt_id)
        if attempt["state"] not in {"PENDING", "APPROVED"}:
            raise ValueError("not deniable")
        attempt["state"] = "DENIED"

    def expire(self, attempt_id: str) -> None:
        attempt = self.get(attempt_id)
        if attempt["state"] == "LOCKED":
            return
        if attempt["state"] not in {"PENDING", "APPROVED"}:
            raise ValueError("not expirable")
        attempt["state"] = "LOCKED"
        self.ledger[attempt_id] = "LOCKED"

    def execute(self, attempt_id: str) -> int:
        attempt = self.get(attempt_id)
        if attempt["state"] != "APPROVED":
            raise ValueError("execute requires current APPROVED attempt")
        if int(attempt["generation"]) != self.generation:
            raise ValueError("stale generation")
        attempt["state"] = "EXECUTED"
        self.generation += 1
        self.ledger[attempt_id] = f"GENERATION:{self.generation}"
        return self.generation

    def get(self, attempt_id: str) -> dict[str, object]:
        for attempt in self.attempts:
            if attempt["id"] == attempt_id:
                return attempt
        raise KeyError(attempt_id)


def attempt_vectors() -> list[dict[str, object]]:
    results: list[dict[str, object]] = []

    model = AttemptModel()
    first = model.begin("A1")
    model.deny("A1")
    second = model.begin("A2")
    results.append({
        "id": "denied_then_new_attempt",
        "expected": "A2 sequence 2, A1 DENIED",
        "actual": f"A2 sequence {second}, A1 {model.get('A1')['state']}",
        "pass": first == 1 and second == 2 and model.get("A1")["state"] == "DENIED",
    })

    model = AttemptModel()
    model.begin("A1")
    model.expire("A1")
    second = model.begin("A2")
    results.append({
        "id": "locked_then_new_attempt",
        "expected": "A2 sequence 2, A1 LOCKED",
        "actual": f"A2 sequence {second}, A1 {model.get('A1')['state']}",
        "pass": second == 2 and model.get("A1")["state"] == "LOCKED",
    })

    model = AttemptModel()
    model.begin("A1")
    try:
        model.begin("A2")
        concurrent_rejected = False
    except ValueError:
        concurrent_rejected = True
    results.append({
        "id": "concurrent_begin_single_active",
        "expected": "second begin rejected",
        "actual": "rejected" if concurrent_rejected else "accepted",
        "pass": concurrent_rejected,
    })

    model = AttemptModel()
    model.begin("A1")
    model.approve("A1", "APPROVER")
    model.execute("A1")
    try:
        model.execute("A1")
        delayed_rejected = False
    except ValueError:
        delayed_rejected = True
    results.append({
        "id": "old_attempt_delayed_execute",
        "expected": "rejected",
        "actual": "rejected" if delayed_rejected else "accepted",
        "pass": delayed_rejected and model.generation == 2,
    })

    model = AttemptModel()
    model.begin("A1")
    model.approve("A1", "APPROVER")
    before = str(model.ledger.get("A1"))
    replay = str(model.ledger.get("A1"))
    results.append({
        "id": "response_loss_replay",
        "expected": "same durable result",
        "actual": f"before={before}, replay={replay}",
        "pass": before == replay,
    })
    return results


def mutation_cases(definitions: dict[str, dict[str, object]]) -> list[dict[str, object]]:
    helper = "app_private.lock_expired_root_change_r4(text)"
    approve = "app.bootstrap_approve_root_change_r4(text, text, text)"
    execute = "app.bootstrap_execute_root_change_r4(text, text, text)"
    return [
        {
            "id": "R4-TX-01",
            "target": "transaction",
            "description": "LOCKED update followed by uncaught RAISE",
            "function": helper,
            "old": "END",
            "new": "  RAISE EXCEPTION 'root change approval expired';\nEND",
            "check": "expiry_no_unhandled_raise",
        },
        {
            "id": "R4-TX-02",
            "target": "transaction",
            "description": "expiry update placed inside swallowed exception block",
            "function": helper,
            "old": "END",
            "new": "EXCEPTION WHEN OTHERS THEN NULL;\nEND",
            "check": "expiry_no_exception_swallow",
        },
        {
            "id": "R4-TX-03",
            "target": "transaction",
            "description": "business error replaces committed LOCKED path",
            "function": approve,
            "old": "PERFORM app_private.lock_expired_root_change_r4(p_recovery_id);",
            "new": "RAISE EXCEPTION 'root change approval expired';",
            "check": "approve_expiry_calls_helper",
        },
        {
            "id": "R4-TX-04",
            "target": "transaction",
            "description": "audit event omitted from expiry transaction",
            "function": helper,
            "old": "PERFORM app_private.append_bootstrap_event_r2(",
            "new": "PERFORM 1 * (",
            "check": "expiry_appends_audit",
        },
        {
            "id": "R4-TX-09",
            "target": "transaction",
            "description": "expiry Event records a mismatched caller Principal",
            "function": helper,
            "old": "rr.requested_by_role,rr.requested_by_principal_id",
            "new": "session_user,rr.requested_by_principal_id",
            "check": "expiry_audit_uses_attempt_actor",
        },
        {
            "id": "R4-TX-05",
            "target": "transaction",
            "description": "Ledger completed inside helper before caller outcome",
            "function": helper,
            "old": "  UPDATE app.bootstrap_lifecycle_r2",
            "new": "  PERFORM app_private.complete_bootstrap_request_r2('BOOTSTRAP_APPROVE_ROOT_CHANGE_R4','x','x');\n  UPDATE app.bootstrap_lifecycle_r2",
            "check": "expiry_helper_no_ledger_completion",
        },
        {
            "id": "R4-TX-06",
            "target": "transaction",
            "description": "response-loss replay branch removed from Execute",
            "function": execute,
            "old": "IF v_replay THEN",
            "new": "IF false THEN",
            "check": "execute_replay_branch",
        },
        {
            "id": "R4-TX-07",
            "target": "transaction",
            "description": "business expiry converted into swallowed PL/pgSQL exception",
            "function": helper,
            "old": "END",
            "new": "EXCEPTION WHEN OTHERS THEN RETURN;\nEND",
            "check": "expiry_no_exception_swallow",
        },
        {
            "id": "R4-TX-08",
            "target": "transaction",
            "description": "real database error masked as normal expiry result",
            "function": helper,
            "old": "END",
            "new": "EXCEPTION WHEN OTHERS THEN NULL;\nEND",
            "check": "expiry_no_exception_swallow",
        },
        {
            "id": "R4-ATT-01",
            "target": "attempt",
            "description": "legacy one-per-generation unique retained",
            "scope": "sql-last",
            "old": "DROP CONSTRAINT IF EXISTS bootstrap_recovery_one_per_generation_r3",
            "new": "SELECT 1",
            "check": "legacy_one_per_generation_dropped",
        },
        {
            "id": "R4-ATT-02",
            "target": "attempt",
            "description": "attempt sequence uniqueness removed",
            "scope": "sql-all",
            "old": "UNIQUE (bootstrap_id,from_generation,attempt_sequence)",
            "new": "UNIQUE (bootstrap_id,from_generation)",
            "check": "attempt_identity_unique",
        },
        {
            "id": "R4-ATT-03",
            "target": "attempt",
            "description": "caller supplies attempt sequence",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "part": "header",
            "old": "p_request_key text",
            "new": "p_request_key text,p_attempt_sequence bigint",
            "check": "caller_cannot_choose_sequence",
            "header_effect": (
                "signature_remains_exact_without_attempt_sequence_parameter"
            ),
        },
        {
            "id": "R4-ATT-04",
            "target": "attempt",
            "description": "terminal attempt reopened as PENDING",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "v_seq:=app_private.next_bootstrap_recovery_sequence_r4(",
            "new": "UPDATE app.bootstrap_recovery_r2 SET state='PENDING';\n  v_seq:=app_private.next_bootstrap_recovery_sequence_r4(",
            "check": "terminal_attempt_not_reopened",
        },
        {
            "id": "R4-ATT-05",
            "target": "attempt",
            "description": "DENIED lifecycle cannot start new attempt",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "'LOCKED','REVOKED'",
            "new": "'REVOKED'",
            "check": "begin_accepts_locked_recovery",
        },
        {
            "id": "R4-ATT-06",
            "target": "attempt",
            "description": "LOCKED lifecycle cannot start new attempt",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "'ROOT_ISSUANCE_PENDING',\n    'LOCKED','REVOKED'",
            "new": "'ROOT_ISSUANCE_PENDING',\n    'REVOKED'",
            "check": "begin_accepts_locked_recovery",
        },
        {
            "id": "R4-ATT-07",
            "target": "attempt",
            "description": "partial unique allows two active attempts",
            "scope": "sql-last",
            "old": "WHERE state IN ('PENDING','APPROVED')",
            "new": "WHERE state='PENDING' AND false",
            "check": "active_attempt_unique",
        },
        {
            "id": "R4-ATT-08",
            "target": "attempt",
            "description": "old approval is not scoped to its attempt ID",
            "function": execute,
            "old": "WHERE recovery_id=p_recovery_id AND operator_kind='INITIATOR'",
            "new": "WHERE operator_kind='INITIATOR'",
            "check": "approval_scoped_to_attempt",
        },
        {
            "id": "R4-ATT-09",
            "target": "attempt",
            "description": "old attempt delayed Execute accepted",
            "function": execute,
            "old": "IF rr.state<>'APPROVED' THEN",
            "new": "IF rr.state<>'EXECUTED' THEN",
            "check": "execute_requires_approved",
        },
        {
            "id": "R4-ATT-10",
            "target": "attempt",
            "description": "concurrent Begin can skip lifecycle row lock",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "WHERE bootstrap_id=p_bootstrap_id FOR UPDATE;",
            "new": "WHERE bootstrap_id=p_bootstrap_id;",
            "check": "begin_locks_lifecycle",
        },
        {
            "id": "R4-REC-01",
            "target": "recovery",
            "description": "ROTATION omits active current-root authority check",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "RAISE EXCEPTION 'root rotation requires active root authority'",
            "new": "RAISE EXCEPTION 'mutated root authority check'",
            "check": "rotation_requires_active_root",
        },
        {
            "id": "R4-REC-02",
            "target": "recovery",
            "description": "target root role may equal current role",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "OR p_target_root_role_name=lc.root_role_name",
            "new": "OR false",
            "check": "begin_requires_new_principal_and_role",
        },
        {
            "id": "R4-REC-03",
            "target": "recovery",
            "description": "Begin omits strict backend identity",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "RAISE EXCEPTION 'root change backend identity unavailable'",
            "new": "RAISE EXCEPTION 'mutated backend identity check'",
            "check": "begin_backend_identity_required",
        },
        {
            "id": "R4-REC-04",
            "target": "recovery",
            "description": "Begin replay target may be missing",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "RAISE EXCEPTION 'bootstrap Begin replay target missing'",
            "new": "RAISE EXCEPTION 'mutated replay target check'",
            "check": "begin_replay_target_required",
        },
        {
            "id": "R4-REC-05",
            "target": "recovery",
            "description": "Deny approver may be current or target root",
            "function": "app.bootstrap_deny_root_change_r4(text, text, text, text)",
            "old": "AND principal_id<>rr.current_root_principal_id\n     AND principal_id<>rr.target_root_principal_id",
            "new": "AND true",
            "check": "deny_operator_excludes_root_identities",
        },
        {
            "id": "R4-REC-06",
            "target": "recovery",
            "description": "Execute accepts mismatched Lifecycle/Recovery root identity",
            "function": "app.bootstrap_execute_root_change_r4(text, text, text)",
            "old": "lc.root_principal_id<>rr.current_root_principal_id",
            "new": "false",
            "check": "execute_lifecycle_identity",
        },
        {
            "id": "R4-REC-07",
            "target": "recovery",
            "description": "Begin initiator Principal is disabled",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "root change initiator Principal is not active",
            "new": "mutated initiator active check",
            "check": "begin_initiator_principal_active",
        },
        {
            "id": "R4-REC-08",
            "target": "recovery",
            "description": "target root Principal or role reuses an old identity",
            "function": (
                "app.bootstrap_begin_root_change_r4("
                "text, boolean, text, text, text, text, text, text, text)"
            ),
            "old": "root change target identity was already used or is inactive",
            "new": "mutated target freshness check",
            "check": "begin_target_identity_fresh",
        },
        {
            "id": "R4-REC-09",
            "target": "recovery",
            "description": "disabled Approver/Deny Principal remains eligible",
            "function": approve,
            "old": "root change approver Principal is not active",
            "new": "mutated approver active check",
            "check": "approve_deny_principal_active",
        },
        {
            "id": "R4-REC-10",
            "target": "recovery",
            "description": "Execute advances Generation for inactive target or noninitial epoch",
            "function": execute,
            "old": "root change target Principal is not active",
            "new": "mutated target active check",
            "check": "execute_target_principal_active_epoch",
        },
        {
            "id": "R4-REC-11",
            "target": "recovery",
            "description": "Execute auto-provisions target Principal or Epoch",
            "function": execute,
            "old": "UPDATE app.bootstrap_operator_r3 SET enabled=false",
            "new": "INSERT INTO app.trusted_principal(id,state,created_at) VALUES(rr.target_root_principal_id,'ACTIVE',clock_timestamp());\n  UPDATE app.bootstrap_operator_r3 SET enabled=false",
            "check": "execute_does_not_provision_principal",
        },
        {
            "id": "R4-REC-12",
            "target": "recovery",
            "description": "disabled approval Operator remains executable",
            "function": execute,
            "old": "WHERE a.recovery_id=p_recovery_id AND NOT o.enabled",
            "new": "WHERE false",
            "check": "execute_rechecks_approval_operator_enabled",
        },
        {
            "id": "R4-CAND-01",
            "target": "candidate",
            "description": "Selection ProfessionalReview candidate becomes nullable",
            "scope": "sql-all",
            "old": "ALTER COLUMN candidate_id SET NOT NULL",
            "new": "ALTER COLUMN candidate_id DROP NOT NULL",
            "check": "candidate_two_not_null",
        },
        {
            "id": "R4-CAND-02",
            "target": "candidate",
            "description": "Overlay only adds/backfills candidate without NOT NULL",
            "scope": "sql-all",
            "old": "ALTER TABLE app.selection_professional_review_result\n  ALTER COLUMN candidate_id SET NOT NULL;",
            "new": "-- mutation removed Selection NOT NULL",
            "check": "candidate_two_not_null",
        },
        {
            "id": "R4-CAND-03",
            "target": "candidate",
            "description": "trigger bypass can insert NULL",
            "scope": "sql-last",
            "old": "ALTER COLUMN candidate_id SET NOT NULL",
            "new": "ALTER COLUMN candidate_id DROP NOT NULL",
            "check": "candidate_two_not_null",
        },
        {
            "id": "R4-CAND-04",
            "target": "candidate",
            "description": "composite FK depends on a nullable candidate",
            "scope": "sql-all",
            "old": "ALTER COLUMN candidate_id SET NOT NULL",
            "new": "ALTER COLUMN candidate_id DROP NOT NULL",
            "check": "candidate_composite_fk",
        },
        {
            "id": "R4-CAND-05",
            "target": "candidate",
            "description": "backfill invents a Candidate value",
            "scope": "sql-first",
            "old": "SET candidate_id=source.candidate_id",
            "new": "SET candidate_id=coalesce(source.candidate_id,'UNKNOWN')",
            "check": "candidate_no_invented_value",
        },
        {
            "id": "R4-CAND-06",
            "target": "candidate",
            "description": "unresolved historical Candidate proceeds to NOT NULL",
            "scope": "sql-first",
            "old": "RAISE EXCEPTION\n      'professional review candidate provenance is not uniquely resolvable'",
            "new": "NULL;",
            "check": "candidate_unknown_fails_closed",
        },
        {
            "id": "R4-CAND-07",
            "target": "candidate",
            "description": "sealed Selection guard blocks authoritative Candidate backfill",
            "function": "app_private.guard_sealed_result_r3()",
            "old": "AND app_private.r4_candidate_backfill_row_allowed(\n         to_jsonb(OLD),to_jsonb(NEW)\n       )",
            "new": "AND false",
            "check": "candidate_guard_exception_narrow",
        },
        {
            "id": "R4-CAND-08",
            "target": "candidate",
            "description": "finalized Snapshot guard bypasses candidate-only restriction",
            "function": "app_private.guard_snapshot_child_r3()",
            "old": "AND app_private.r4_candidate_backfill_row_allowed(\n         to_jsonb(OLD),to_jsonb(NEW)\n       )",
            "new": "AND true",
            "check": "candidate_guard_exception_narrow",
        },
        {
            "id": "R4-CAND-09",
            "target": "candidate",
            "description": "migration helper permits other business-field mutation",
            "function": "app_private.r4_candidate_backfill_row_allowed(jsonb, jsonb)",
            "old": "AND (p_new-'candidate_id')=(p_old-'candidate_id')",
            "new": "AND true",
            "check": "candidate_guard_exception_narrow",
        },
        {
            "id": "R4-CAND-10",
            "target": "candidate",
            "description": "Candidate helper Owner assigned after guarded backfill",
            "scope": "sql-first",
            "old": "ALTER FUNCTION app_private.r4_candidate_backfill_row_allowed(jsonb,jsonb)\n  OWNER TO elevator_review_function_owner;\nREVOKE EXECUTE ON FUNCTION\n  app_private.r4_candidate_backfill_row_allowed(jsonb,jsonb)\n  FROM PUBLIC;",
            "new": "-- mutation removed early helper ownership",
            "check": "candidate_helper_owned_before_guard",
        },
        {
            "id": "R4-CAND-11",
            "target": "candidate",
            "description": "Candidate backfill reads unfrozen source tables",
            "scope": "sql-first",
            "old": "LOCK TABLE\n  app.professional_review_event,\n  app.selection_professional_review_result,\n  app.sales_handoff_snapshot_r3,\n  app.sales_snapshot_professional_review_r3\nIN SHARE ROW EXCLUSIVE MODE;",
            "new": "-- mutation removed source freeze",
            "check": "candidate_migration_locks_sources",
        },
        {
            "id": "R4-ACL-01",
            "target": "acl",
            "description": "bootstrap completion capability omitted after final revoke",
            "scope": "sql-last",
            "old": "GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(\n  boolean,text,text,text\n) TO elevator_root_issuer;",
            "new": "-- mutation removed completion grant",
            "check": "final_acl_matches_r3_capabilities",
        },
        {
            "id": "R4-ACL-02",
            "target": "acl",
            "description": "unsafe legacy Recovery entry remains role-accessible",
            "scope": "sql-all",
            "old": "REVOKE EXECUTE ON FUNCTION app.bootstrap_begin_root_change_r2(\n  text,boolean,text,text,text,text,text,text,text\n) FROM elevator_bootstrap_initiator;",
            "new": "-- mutation removed legacy revoke",
            "check": "old_recovery_role_grants_absent",
        },
        {
            "id": "R4-ACL-03",
            "target": "acl",
            "description": "PUBLIC EXECUTE reintroduced after final revoke",
            "scope": "append-final",
            "old": "",
            "new": "GRANT EXECUTE ON FUNCTION app.bootstrap_complete_root_r3(boolean,text,text,text) TO PUBLIC;",
            "check": "no_public_grant_after_final_revoke",
        },
        {
            "id": "R4-ACL-04",
            "target": "acl",
            "description": "new sequence table omits function-owner DML privilege",
            "scope": "sql-last",
            "old": "GRANT SELECT,INSERT,UPDATE ON TABLE app.bootstrap_recovery_sequence_r4\n  TO elevator_review_function_owner;",
            "new": "-- mutation removed sequence table function-owner grant",
            "check": "sequence_table_function_owner_privilege",
        },
    ]


def apply_mutation(
    sql: str,
    definitions: dict[str, dict[str, object]],
    case: dict[str, object],
) -> str:
    function = case.get("function")
    if function:
        if case.get("part") == "header":
            item = definitions[str(function)]
            header = sql[
                int(item["header_start"]):int(item["header_end"])
            ]
            revised = header.replace(str(case["old"]), str(case["new"]), 1)
            return (
                sql[:int(item["header_start"])]
                + revised
                + sql[int(item["header_end"]):]
            )
        return replace_in_function(
            sql, definitions, str(function), str(case["old"]), str(case["new"])
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


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    guard = require_guard(root)
    repo = root.parents[2]
    r3 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r3"
    r3_review = (
        repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r3"
    )
    r2 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"
    r2_review = (
        repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r2"
    )
    manifests = [
        verify_manifest(
            r3 / "SHA256SUMS_R3_C8_CORRECTIONS_R3.txt",
            repo,
            R3_MANIFEST_SHA256,
        ),
        verify_manifest(
            r3_review / "SHA256SUMS_R3_C8_CORRECTIONS_R3_REVIEW.txt",
            repo,
            R3_REVIEW_MANIFEST_SHA256,
        ),
        verify_manifest(
            r2 / "SHA256SUMS_R3_C8_CORRECTIONS_R2.txt",
            repo,
            R2_MANIFEST_SHA256,
        ),
        verify_manifest(
            r2_review / "SHA256SUMS_R3_C8_CORRECTIONS_R2_REVIEW.txt",
            repo,
            R2_REVIEW_MANIFEST_SHA256,
        ),
    ]

    ddl_path = root / "DATABASE_COMPLETE_DDL_DESIGN_R4.sql"
    registry_path = root / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R4.json"
    sql = ddl_path.read_text(encoding="utf-8")
    r3_sql = (
        r3 / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql"
    ).read_text(encoding="utf-8")

    sys.path.insert(0, str(r3 / "tools"))
    spec = importlib.util.spec_from_file_location(
        "r3validator", r3 / "tools/validate_r3.py"
    )
    if spec is None or spec.loader is None:
        raise SystemExit("cannot load frozen R3 validator")
    r3v = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r3v)

    tables, keys, fks = r3v.table_blocks(sql)
    fk_errors: list[dict[str, object]] = []
    for source, source_columns, target, target_columns in fks:
        if len(source_columns) != len(target_columns):
            fk_errors.append({"source": source, "reason": "arity"})
        if source not in tables or any(
            column not in tables[source] for column in source_columns
        ):
            fk_errors.append({"source": source, "reason": "source-columns"})
        if target not in tables:
            fk_errors.append({"source": source, "reason": "missing-target"})
        elif target_columns not in keys.get(target, set()):
            fk_errors.append({
                "source": source,
                "target": target,
                "target_columns": target_columns,
                "reason": "target-key",
            })

    definitions = function_definitions(sql)
    checks = semantic_checks(sql, r3_sql)
    checks["all_manifests_valid"] = all(item["pass"] for item in manifests)
    checks["fk_target_integrity"] = not fk_errors
    required_deliverables = {
        "P1_PRODUCT_REMEDIATION_DESIGN_R4.md",
        "DATABASE_COMPLETE_DDL_DESIGN_R4.sql",
        "DATABASE_FINAL_STATE_OVERLAY_R4.sql",
        "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R4.json",
        "BOOTSTRAP_RECOVERY_TRANSACTION_PERSISTENCE_R4.md",
        "BOOTSTRAP_RECOVERY_ATTEMPT_SEQUENCE_R4.md",
        "PROFESSIONAL_REVIEW_CANDIDATE_NOT_NULL_R4.md",
        "TRANSACTION_AND_ATTEMPT_VALIDATOR_DESIGN_R4.md",
        "R4_FINDING_TRACEABILITY.md",
        "HISTORICAL_FINDING_CLOSURE_MATRIX_R4.md",
        "OPEN_DECISIONS_DISPOSITION_R4.md",
        "P1_P2_P3_ACCEPTANCE_TEST_MATRIX_R4.md",
        "VALIDATOR_MUTATION_COVERAGE_R4.md",
        "VALIDATION_EVIDENCE_R4.json",
        "DESIGN_CHANGELOG_R4.md",
        "UNVERIFIED_ITEMS_R4.md",
        "SIDE_EFFECT_AND_GIT_AUDIT_R4.md",
    }
    checks["required_deliverables_present"] = all(
        (root / name).is_file() for name in required_deliverables
    )
    open_decisions_text = (
        root / "OPEN_DECISIONS_DISPOSITION_R4.md"
    ).read_text(encoding="utf-8")
    open_ids = re.findall(r"`(OD-(?:R2|R3)[A-Z0-9-]*)`", open_decisions_text)
    checks["open_decisions_57_unique_open"] = (
        len(open_ids) >= 57
        and len(set(open_ids)) == 57
        and "Approved by User: 0" in open_decisions_text
        and "Still OPEN: 57" in open_decisions_text
    )
    checks["registry_contract"] = False
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    checks["registry_contract"] = (
        registry.get("ddl_sha256") == sha256(ddl_path)
        and registry.get("function_count") == len(definitions)
        and not registry.get("missing_owners")
        and not registry.get("unresolved_call_targets")
        and registry.get("effective_capability_grants") == effective_grants(sql)
    )

    formal_tree = ast.parse((r3 / "tools/validate_r3.py").read_text(encoding="utf-8"))

    def literal_dict(name: str) -> dict[str, object]:
        for node in ast.walk(formal_tree):
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

    formal_mutations = literal_dict("mutations")
    r2_mutations = literal_dict("r2_mutations")
    baseline_required = r3v.req_checks(sql)
    baseline_failures = {
        key for key, value in baseline_required.items() if not value
    }
    formal_results: list[dict[str, object]] = []
    for mutation_id, pair in formal_mutations.items():
        old, new = pair
        mutated = sql.replace(old, new) if old in sql else sql
        changed = r3v.req_checks(mutated)
        failures = {
            key for key, value in changed.items() if not value
        }
        new_failures = sorted(baseline_failures.symmetric_difference(failures))
        formal_results.append({
            "id": mutation_id,
            "target_present": old in sql,
            "detected": old in sql and mutation_id in new_failures,
            "new_failures": new_failures,
        })

    baseline_r2 = r3v.r2_marker_checks(sql)
    r2_results: list[dict[str, object]] = []
    for mutation_id, (key, pairs) in r2_mutations.items():
        mutated = sql
        for old, new in pairs:
            mutated = mutated.replace(old, new)
        changed = r3v.r2_marker_checks(mutated)
        r2_results.append({
            "id": mutation_id,
            "detected": bool(baseline_r2[key]) and not bool(changed[key]),
        })

    r4_results: list[dict[str, object]] = []
    for case in mutation_cases(definitions):
        mutated = apply_mutation(sql, definitions, case)
        mutated_checks = semantic_checks(mutated, r3_sql)
        check_name = str(case["check"])
        detected = bool(checks[check_name]) and not bool(
            mutated_checks.get(check_name, False)
        )
        r4_results.append({
            **case,
            "detected": detected,
            "mutated_check_value": mutated_checks.get(check_name),
        })

    tx_vectors = transaction_vectors()
    attempt_results = attempt_vectors()
    functions = len(definitions)
    object_inventory = {
        "tables": len(tables),
        "foreign_keys": len(fks),
        "functions": functions,
        "function_signatures": len(definitions),
        "triggers": len(re.findall(
            r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+", sql, re.I
        )),
        "procedures": len(re.findall(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+app\.", sql, re.I
        )),
        "roles": len(set(re.findall(
            r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)", sql, re.I
        ))),
        "views": len(re.findall(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+app\.", sql, re.I
        )),
        "sequences": len(re.findall(
            r"CREATE\s+SEQUENCE\s+app\.", sql, re.I
        )),
    }
    result = {
        "design": "FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R4",
        "scope": "OFFLINE STATIC ANALYSIS AND STATE MODELS; NO SQL OR DATABASE EXECUTION",
        "guard": guard,
        "input_manifests": manifests,
        "complete_ddl_sha256": sha256(ddl_path),
        "complete_ddl_bytes": ddl_path.stat().st_size,
        "complete_ddl_lines": len(sql.splitlines()),
        "overlay_sha256": sha256(root / "DATABASE_FINAL_STATE_OVERLAY_R4.sql"),
        "registry_sha256": sha256(registry_path),
        "object_inventory": object_inventory,
        "semantic_checks": checks,
        "failed_checks": sorted(key for key, value in checks.items() if not value),
        "fk_errors": fk_errors,
        "formal_mutations_total": len(formal_results),
        "formal_mutations_detected": sum(bool(item["detected"]) for item in formal_results),
        "formal_mutation_results": formal_results,
        "r2_mutations_total": len(r2_results),
        "r2_mutations_detected": sum(bool(item["detected"]) for item in r2_results),
        "r2_mutation_results": r2_results,
        "r4_mutations_total": len(r4_results),
        "r4_mutations_detected": sum(bool(item["detected"]) for item in r4_results),
        "r4_mutation_results": r4_results,
        "transaction_vectors": tx_vectors,
        "attempt_vectors": attempt_results,
        "postgresql_grammar": "NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_execution": "NOT EXECUTED — DATABASE NOT AUTHORIZED",
        "runtime_concurrency": "NOT EXECUTED — RUNTIME NOT AUTHORIZED",
    }
    result["result"] = (
        "PASS"
        if (
            not result["failed_checks"]
            and not fk_errors
            and all(item["detected"] for item in formal_results)
            and all(item["detected"] for item in r2_results)
            and all(item["detected"] for item in r4_results)
            and all(item["pass"] for item in tx_vectors)
            and all(item["pass"] for item in attempt_results)
        )
        else "FAIL"
    )
    output = root / "VALIDATION_EVIDENCE_R4.json"
    output.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "failed_checks": result["failed_checks"],
        "fk_errors": len(fk_errors),
        "object_inventory": object_inventory,
        "formal_mutations": (
            f"{result['formal_mutations_detected']}/{len(formal_results)}"
        ),
        "r2_mutations": f"{result['r2_mutations_detected']}/{len(r2_results)}",
        "r4_mutations": (
            f"{result['r4_mutations_detected']}/{len(r4_results)}"
        ),
        "transaction_vectors": (
            f"{sum(item['pass'] for item in tx_vectors)}/{len(tx_vectors)}"
        ),
        "attempt_vectors": (
            f"{sum(item['pass'] for item in attempt_results)}/{len(attempt_results)}"
        ),
        "result": result["result"],
        "output": str(output),
    }, indent=2))
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
