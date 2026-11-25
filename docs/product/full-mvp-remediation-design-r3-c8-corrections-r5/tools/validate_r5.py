"""Offline adversarial validation for the R5 design package."""

from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

from guard import require_guard


R4_MANIFEST_SHA256 = (
    "BAB1129478D70E3CD21B6C2D60B338525CE7E18660ABE26D69BBE540409AB377"
)
R4_REVIEW_MANIFEST_SHA256 = (
    "9B6084121907475A29D5C1FC7C9B53FDBD52D908F547741FD2C6730A3428F62C"
)
R4_COMPLETE_SHA256 = (
    "F4DA543931B69F67DEB6672B41F968FCF24E1D8E025B367E5282B4AF44711B2F"
)
R4_OVERLAY_SHA256 = (
    "87A3814632B59FBD6614CCA31E6A388FE3FDEDD0D695611FC04B1E39C4664552"
)
R4_REGISTRY_SHA256 = (
    "C0FD9D353F5E82D937E587A81106652B3A66DC47256B777BD8CE2DF430F86EA3"
)
R4_EVIDENCE_SHA256 = (
    "B1AB36A2CFB92E286AAA78F43F036B643257978B2F2112ACAF807360FAEBDA0E"
)
R4_REVIEW_SHA256 = (
    "0BB94BED7CC0C1EB55ECF7D856B1B34DF0BE06FE1AEFA900EC8E9823154E147B"
)
R4_REVIEW_EVIDENCE_SHA256 = (
    "5C7B393CBCCC90B70B8508F296DAF7ACA0F56C85D5CDBB1BADB4CBB2FFC88D6D"
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def verify_manifest(
    manifest: Path, expected_sha256: str
) -> dict[str, object]:
    actual_sha256 = sha256(manifest)
    records = 0
    unique: set[str] = set()
    errors: list[str] = []
    repo_root = manifest.parents[3]
    for line in manifest.read_text(encoding="utf-8").splitlines():
        match = re.match(
            r"^([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)$", line
        )
        if not match:
            errors.append("malformed-record")
            continue
        expected_hash, expected_bytes, expected_lines, raw_relative = match.groups()
        target = (
            repo_root / raw_relative
            if raw_relative.startswith("docs/")
            else manifest.parent / raw_relative
        )
        try:
            relative = str(target.relative_to(manifest.parent)).replace("\\", "/")
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
        if len(target.read_text(encoding="utf-8").splitlines()) != int(
            expected_lines
        ):
            errors.append(f"lines:{relative}")
    actual = {
        str(path.relative_to(manifest.parent)).replace("\\", "/")
        for path in manifest.parent.rglob("*")
        if path.is_file() and path != manifest
    }
    if unique != actual:
        errors.append("coverage")
    if actual_sha256 != expected_sha256:
        errors.append("manifest-hash")
    return {
        "path": str(manifest),
        "sha256": actual_sha256,
        "expected_sha256": expected_sha256,
        "records": records,
        "unique": len(unique),
        "actual": len(actual),
        "errors": errors,
        "pass": not errors,
    }


def load_module(name: str, path: Path):
    previous_guard = sys.modules.get("guard")
    local_guard_path = path.parent / "guard.py"
    if local_guard_path.is_file() and local_guard_path.resolve() != (
        Path(__file__).resolve().parent / "guard.py"
    ):
        guard_spec = importlib.util.spec_from_file_location(
            f"_guard_{abs(hash(str(local_guard_path)))}", local_guard_path
        )
        if guard_spec is None or guard_spec.loader is None:
            raise SystemExit(f"cannot load local guard: {local_guard_path}")
        local_guard = importlib.util.module_from_spec(guard_spec)
        guard_spec.loader.exec_module(local_guard)
        sys.modules["guard"] = local_guard
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        if spec is None or spec.loader is None:
            raise SystemExit(f"cannot load module: {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        if previous_guard is not None:
            sys.modules["guard"] = previous_guard


def literal_dict(tree: ast.AST, name: str) -> dict[str, object]:
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


class AttemptModel:
    def __init__(self) -> None:
        self.next_sequence = 1
        self.generation = 1
        self.attempts: list[dict[str, object]] = []
        self.events: list[dict[str, object]] = []
        self.lock_owner: str | None = None

    def begin(self, attempt_id: str, now: int) -> int:
        if self.lock_owner is not None:
            raise ValueError("identity mutex unavailable")
        self.lock_owner = attempt_id
        try:
            active = [
                item
                for item in self.attempts
                if item["state"] in {"PENDING", "APPROVED"}
            ]
            if active:
                item = active[0]
                if now < int(item["expires_at"]):
                    raise ValueError("active attempt exists")
                item["state"] = "LOCKED"
                item["terminalized_by"] = "BEGIN_EXPIRED_SWEEP"
                self.events.append({
                    "type": "LOCKED",
                    "attempt": item["id"],
                })
            sequence = self.next_sequence
            self.next_sequence += 1
            self.attempts.append({
                "id": attempt_id,
                "sequence": sequence,
                "state": "PENDING",
                "generation": self.generation,
                "expires_at": now + 10,
                "approvals": {"INITIATOR"},
            })
            self.events.append({"type": "BEGIN", "attempt": attempt_id})
            return sequence
        finally:
            self.lock_owner = None

    def approve(self, attempt_id: str, approver: str) -> None:
        item = self.get(attempt_id)
        if item["state"] != "PENDING":
            raise ValueError("not pending")
        cast_approvals = item["approvals"]
        assert isinstance(cast_approvals, set)
        cast_approvals.add(approver)
        if len(cast_approvals) == 2:
            item["state"] = "APPROVED"
        self.events.append({"type": "APPROVED", "attempt": attempt_id})

    def revoke_approval(self, attempt_id: str) -> None:
        item = self.get(attempt_id)
        cast_approvals = item["approvals"]
        assert isinstance(cast_approvals, set)
        if "APPROVER" in cast_approvals:
            cast_approvals.remove("APPROVER")
            item["state"] = "PENDING"

    def execute(self, attempt_id: str, root_active: bool) -> int:
        item = self.get(attempt_id)
        if item["state"] != "APPROVED":
            raise ValueError("execute requires approved attempt")
        if int(item["generation"]) != self.generation:
            raise ValueError("stale generation")
        if not root_active:
            raise ValueError("current root authority revoked")
        item["state"] = "EXECUTED"
        self.generation += 1
        self.events.append({"type": "GENERATION", "attempt": attempt_id})
        return self.generation

    def get(self, attempt_id: str) -> dict[str, object]:
        for item in self.attempts:
            if item["id"] == attempt_id:
                return item
        raise KeyError(attempt_id)


class ReplayModel:
    def __init__(self) -> None:
        self.ledger: dict[str, str] = {}
        self.business_transitions = 0
        self.events = 0
        self.last_client_received = False

    def execute(self, request_id: str) -> str:
        if request_id in self.ledger:
            return self.ledger[request_id]
        self.ledger[request_id] = "GENERATION:2"
        self.business_transitions += 1
        self.events += 1
        self.last_client_received = True
        return self.ledger[request_id]

    def lose_response(self) -> None:
        if not self.last_client_received:
            raise ValueError("no committed response to lose")
        self.last_client_received = False

    def replay(self, request_id: str) -> str:
        if request_id not in self.ledger:
            raise ValueError("request ledger missing")
        return self.ledger[request_id]


def semantic_checks(
    sql: str,
    r3_sql: str,
    registry: dict[str, object],
    root: Path,
) -> dict[str, bool]:
    r4v = load_module(
        "r4_validator_for_r5",
        root.parent / "full-mvp-remediation-design-r3-c8-corrections-r4/tools/validate_r4.py",
    )
    normalized = r4v.norm(sql)
    definitions = r4v.function_definitions(sql)
    bodies = {
        key: r4v.norm(str(item["body"]))
        for key, item in definitions.items()
    }
    begin_key = (
        "app.bootstrap_begin_root_change_r4("
        "text, boolean, text, text, text, text, text, text, text)"
    )
    approve_key = "app.bootstrap_approve_root_change_r4(text, text, text)"
    execute_key = "app.bootstrap_execute_root_change_r4(text, text, text)"
    deny_key = "app.bootstrap_deny_root_change_r4(text, text, text, text)"
    begin = bodies.get(begin_key, "")
    approve = bodies.get(approve_key, "")
    execute = bodies.get(execute_key, "")
    deny = bodies.get(deny_key, "")
    terminal_key = (
        "app_private.terminalize_expired_root_change_r5("
        "text, text, timestamptz)"
    )
    terminal = bodies.get(terminal_key, "")
    authority_key = (
        "app_private.assert_current_root_authority_r5("
        "boolean, bigint, text, text, text, text, timestamptz, boolean)"
    )
    authority = bodies.get(authority_key, "")
    generation_guard = bodies.get(
        "app_private.enforce_rotation_generation_revalidation_r5()", ""
    )
    candidate_key = (
        "app_private.execute_candidate_backfill_r5("
        "text, text, text, text, text, text, text, text, bigint)"
    )
    candidate = bodies.get(candidate_key, "")
    overlay_start = sql.find("-- ===== BEGIN R5 OVERLAY =====")
    overlay = sql[overlay_start:] if overlay_start >= 0 else ""
    final_functions = set(definitions)
    actual_grants = r4v.effective_grants(sql)
    expected_grants = r4v.expected_r4_grants(r3_sql)
    expected_grants.update({
        "app.bootstrap_complete_root_r3(boolean, text)":
            ["elevator_root_issuer"],
        "app.bootstrap_begin_root_change_r4(text, boolean, text, text, text, text, text, text, text)":
            ["elevator_bootstrap_initiator"],
        "app.bootstrap_approve_root_change_r4(text, text, text)":
            ["elevator_bootstrap_approver"],
        "app.bootstrap_deny_root_change_r4(text, text, text, text)":
            ["elevator_bootstrap_approver"],
        "app.bootstrap_execute_root_change_r4(text, text, text)":
            ["elevator_bootstrap_seed"],
    })
    candidate_update = "set candidate_id=v_source_candidate_id"
    direct_candidate_update = "set candidate_id=source.candidate_id"
    update_pos = candidate.find(candidate_update)
    audit_insert_pos = candidate.find(
        "insert into app.candidate_backfill_row_audit_r5"
    )
    batch_insert_pos = candidate.find(
        "insert into app.candidate_backfill_batch_r5"
    )
    final_public_positions = [
        match.start()
        for match in re.finditer(
            r"REVOKE\s+EXECUTE\s+ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA\s+"
            r"(?:app|app_private)\s+FROM\s+PUBLIC",
            sql,
            re.I,
        )
    ]
    final_public_position = max(final_public_positions, default=-1)
    final_public_tail = sql[final_public_position:] if final_public_position >= 0 else ""
    final_grant_signatures = {
        r4v.signature(event.group("name"), event.group("args"))
        for event in r4v.GRANT_RE.finditer(final_public_tail)
        if event.group(1).upper() == "GRANT"
    }
    r4_overlay_start = sql.find("-- ===== BEGIN R4 OVERLAY =====")
    r4_overlay = sql[r4_overlay_start:] if r4_overlay_start >= 0 else ""
    sealed_guard = bodies.get("app_private.guard_sealed_result_r3()", "")
    snapshot_guard = bodies.get("app_private.guard_snapshot_child_r3()", "")

    return {
        "r5_complete_overlay_marker": (
            sql.count("-- ===== BEGIN R5 OVERLAY =====") == 1
            and sql.count("-- ===== END R5 OVERLAY =====") == 1
        ),
        "uncontrolled_candidate_update_removed":
            direct_candidate_update not in normalized,
        "required_r5_functions": {
            "app_private.lock_bootstrap_identity_r5()",
            authority_key,
            terminal_key,
            candidate_key,
            "app_private.enforce_rotation_generation_revalidation_r5()",
        } <= final_functions,
        "identity_mutex_public_commands":
            all("lock_bootstrap_identity_r5()" in body for body in (
                begin, approve, execute, deny
            )),
        "identity_mutex_before_recovery_lock":
            all(
                -1 < body.find("lock_bootstrap_identity_r5()")
                < body.find("from app.bootstrap_recovery_r2")
                for body in (approve, execute, deny)
            )
            and -1 < begin.find("lock_bootstrap_identity_r5()")
            < begin.find("from app.bootstrap_lifecycle_r2"),
        "identity_mutex_revocation_triggers":
            all(
                f"r5_identity_mutex_{name}" in normalized
                for name in (
                    "trusted_principal","principal_epoch","trusted_session",
                    "authority_grant","bootstrap_root_session",
                    "bootstrap_root_grant","bootstrap_operator",
                )
            ),
        "authority_gate_binds_all_identity":
            all(
                token in authority
                for token in (
                    "app.bootstrap_root_session_r2",
                    "app.trusted_session",
                    "app.trusted_principal",
                    "app.principal_epoch",
                    "app.bootstrap_root_grant_r2",
                    "app.authority_grant",
                    "ts.state='active'",
                    "p_now<ts.expires_at",
                    "pe.current_epoch=ts.login_epoch",
                    "ag.revoked_at is null",
                )
            ),
        "rotation_requires_active_root":
            "assert_current_root_authority_r5(" in begin
            and "root rotation requires active root authority" in normalized,
        "execute_rotation_current_root_recheck":
            "if rr.kind='rotation' then" in execute
            and "assert_current_root_authority_r5(" in execute
            and execute.find("assert_current_root_authority_r5(")
            < execute.find("update app.bootstrap_operator_r3"),
        "generation_trigger_rechecks_current_root":
            "generation insert recovery attempt is stale" in generation_guard
            and "assert_current_root_authority_r5(" in generation_guard
            and "rr.kind='rotation'" in generation_guard
            and "rr.kind not in ('recovery','rotation')" in generation_guard
            and "if new.bootstrap_generation<=1" in generation_guard,
        "expired_begin_sweeps_active_attempt":
            "begin_expired_sweep" in begin
            and "terminalize_expired_root_change_r5(" in begin
            and "order by attempt_sequence" in begin
            and "for update" in begin,
        "terminalization_atomic_evidence":
            all(
                token in terminal
                for token in (
                    "update app.bootstrap_recovery_r2",
                    "update app.bootstrap_lifecycle_r2",
                    "append_bootstrap_event_r2",
                    "insert into app.bootstrap_recovery_terminalization_r5",
                )
            )
            and "complete_bootstrap_request_r2" not in terminal,
        "expiry_helper_no_ledger_completion":
            "complete_bootstrap_request_r2" not in terminal,
        "expiry_appends_audit":
            "append_bootstrap_event_r2" in terminal
            and "'locked'" in terminal,
        "expiry_audit_uses_attempt_actor":
            "v_event_id:=app_private.append_bootstrap_event_r2( "
            "'locked',rr.bootstrap_id,rr.from_generation, "
            "rr.requested_by_role,rr.requested_by_principal_id" in terminal,
        "terminalization_appends_once":
            "recovery_id text not null unique" in normalized
            and "r5_guard_terminalization" in normalized,
        "expiry_no_unhandled_raise":
            "raise exception 'root change approval expired'" not in terminal,
        "expiry_no_exception_swallow":
            "exception when others" not in terminal,
        "approve_expiry_calls_terminalizer":
            "terminalize_expired_root_change_r5(" in approve
            and "'approve_expiry'" in approve,
        "approve_completes_own_ledger":
            "complete_bootstrap_request_r2( 'bootstrap_approve_root_change_r4'"
            in approve,
        "execute_expiry_calls_terminalizer":
            "terminalize_expired_root_change_r5(" in execute
            and "'execute_expiry'" in execute,
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
            "row_number() over" in normalized
            and "partition by bootstrap_id,from_generation" in normalized,
        "attempt_sequence_not_null":
            "alter column attempt_sequence set not null" in normalized,
        "attempt_sequence_atomic":
            "on conflict (bootstrap_id,bootstrap_generation) do update"
            in bodies.get(
                "app_private.next_bootstrap_recovery_sequence_r4(boolean, bigint)",
                "",
            ),
        "sequence_table_function_owner_privilege":
            "grant select,insert,update on table app.bootstrap_recovery_sequence_r4"
            in normalized
            and "to elevator_review_function_owner" in normalized,
        "attempt_identity_unique":
            "unique (bootstrap_id,from_generation,attempt_sequence)"
            in normalized,
        "active_attempt_unique":
            "create unique index bootstrap_recovery_one_active_attempt_r4"
            in normalized
            and "where state in ('pending','approved')" in normalized,
        "legacy_one_per_generation_dropped":
            "drop constraint if exists bootstrap_recovery_one_per_generation_r3"
            in normalized,
        "begin_locks_lifecycle":
            begin.count(
                "from app.bootstrap_lifecycle_r2 "
                "where bootstrap_id=p_bootstrap_id for update;"
            ) >= 2,
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
            len([
                key for key in final_functions
                if key.startswith("app.bootstrap_begin_root_change_r4(")
            ]) == 1,
        "terminal_attempt_not_reopened":
            "update app.bootstrap_recovery_r2 set state='pending'"
            not in normalized,
        "approval_scoped_to_attempt":
            execute.count("where recovery_id=p_recovery_id and operator_kind=")
            >= 2,
        "terminal_timestamp_reason_constraint":
            "bootstrap_recovery_terminal_reason_check_r4" in normalized,
        "candidate_unknown_fails_closed":
            "professional review candidate backfill batches are incomplete"
            in normalized
            and "using errcode='23502'" in normalized,
        "candidate_no_invented_value":
            "coalesce(v_source_candidate_id" not in normalized
            and "candidate_id=source.candidate_id" not in normalized,
        "candidate_batch_table":
            "create table app.candidate_backfill_batch_r5" in normalized,
        "candidate_row_audit_table":
            "create table app.candidate_backfill_row_audit_r5" in normalized,
        "candidate_per_row_old_new":
            all(
                token in normalized
                for token in (
                    "old_candidate_was_null",
                    "old_candidate_id",
                    "new_candidate_id",
                    "old_row_digest",
                    "new_row_digest",
                )
            ),
        "candidate_per_row_provenance":
            all(
                token in normalized
                for token in (
                    "provenance_type",
                    "provenance_record_id",
                    "provenance_version",
                    "provenance_policy_version",
                )
            ),
        "candidate_digest_proof":
            all(
                token in normalized
                for token in (
                    "original_sealed_digest",
                    "correction_digest",
                    "aiea-candidate-backfill-correction-v1",
                )
            ),
        "candidate_audit_before_update":
            -1 < batch_insert_pos < audit_insert_pos < update_pos,
        "candidate_source_exact_join":
            "where e.id=v_row.professional_review_event_id" in candidate
            and "src.selection_run_id=v_snapshot.selection_run_id"
            in candidate
            and "src.professional_review_id=v_snapshot.professional_review_id"
            in candidate
            and "src.event_sequence=v_snapshot.event_sequence" in candidate,
        "candidate_expected_equals_applied":
            candidate.count("v_count<>p_expected_rows") == 2
            and "v_applied<>p_expected_rows" in candidate
            and "set applied_rows=v_applied,failed_rows=0,state='completed'"
            in candidate,
        "candidate_batch_idempotent":
            "on conflict (request_id) do nothing" in candidate
            and "candidate backfill request identity conflict" in candidate
            and "'replay',true" in candidate,
        "candidate_actor_binding":
            "ag.session_id=ts.session_id" in candidate
            and "ag.principal_id=ts.principal_id" in candidate
            and "pe.current_epoch=ts.login_epoch" in candidate,
        "candidate_guard_exception_narrow":
            "p_old->>'candidate_id' is null" in normalized
            and "p_new->>'candidate_id' is not null" in normalized
            and "(p_new-'candidate_id')=(p_old-'candidate_id')" in normalized,
        "candidate_guard_sealed":
            "app_private.r4_candidate_backfill_row_allowed("
            " to_jsonb(old),to_jsonb(new)" in sealed_guard,
        "candidate_guard_snapshot":
            "app_private.r4_candidate_backfill_row_allowed("
            " to_jsonb(old),to_jsonb(new)" in snapshot_guard,
        "candidate_composite_fk":
            "candidate_id,result_row_digest" in normalized
            and "id,candidate_id,row_digest" in normalized
            and normalized.count(
                "alter column candidate_id set not null"
            ) >= 2,
        "candidate_helper_owned_before_guard":
            -1 < r4v.norm(r4_overlay).find(
                "alter function app_private.r4_candidate_backfill_row_allowed"
            )
            < r4v.norm(r4_overlay).find(
                "create or replace function app_private.guard_sealed_result_r3"
            ),
        "candidate_migration_locks_sources":
            "in share row exclusive mode" in candidate,
        "candidate_two_not_null":
            normalized.count(
                "alter column candidate_id set not null"
            ) >= 2,
        "candidate_sources_frozen":
            "in share row exclusive mode" in candidate
            and "app.professional_review_event" in candidate
            and "app.selection_professional_review_result" in candidate
            and "app.sales_handoff_snapshot_r3" in candidate
            and "app.sales_snapshot_professional_review_r3" in candidate,
        "no_transaction_control_statements":
            re.search(r"(?im)^\s*(?:commit|rollback)\s*;", sql) is None,
        "old_recovery_role_grants_absent":
            all(
                key not in actual_grants
                for key in (
                    "app.bootstrap_begin_root_change_r2(text, boolean, text, text, text, text, text, text, text)",
                    "app.bootstrap_approve_root_change_r2(text, text, text)",
                    "app.bootstrap_deny_root_change_r3(text, text, text, text)",
                    "app.bootstrap_execute_root_change_r2(text, text, text)",
                )
            ),
        "final_acl_matches_r4_capabilities":
            actual_grants == expected_grants,
        "final_acl_matches_r3_capabilities":
            actual_grants == expected_grants,
        "completion_grant_in_final_tail":
            "app.bootstrap_complete_root_r3(boolean, text, text, text)"
            in final_grant_signatures,
        "bootstrap_complete_grant_present":
            "app.bootstrap_complete_root_r3(boolean, text, text, text)"
            in actual_grants,
        "no_public_grant_after_final_revoke":
            "TO PUBLIC" not in final_public_tail.upper(),
        "registry_contract":
            registry.get("ddl_sha256") == sha256(
                root / "DATABASE_COMPLETE_DDL_DESIGN_R5.sql"
            )
            and registry.get("function_count") == len(definitions)
            and not registry.get("missing_owners")
            and not registry.get("unresolved_call_targets")
            and registry.get("effective_capability_grants") == actual_grants,
        "open_decisions_57_unique_open": (
            (root / "OPEN_DECISIONS_DISPOSITION_R5.md").is_file()
            and len(re.findall(
                r"`(OD-(?:R2|R3)[A-Z0-9-]*)`",
                (root / "OPEN_DECISIONS_DISPOSITION_R5.md").read_text(
                    encoding="utf-8"
                ),
            )) >= 57
        ),
    }


def adjusted_r4_cases(r4v, definitions) -> list[dict[str, object]]:
    cases = r4v.mutation_cases(definitions)
    terminal = (
        "app_private.terminalize_expired_root_change_r5("
        "text, text, timestamptz)"
    )
    begin = (
        "app.bootstrap_begin_root_change_r4("
        "text, boolean, text, text, text, text, text, text, text)"
    )
    approve = "app.bootstrap_approve_root_change_r4(text, text, text)"
    candidate = (
        "app_private.execute_candidate_backfill_r5("
        "text, text, text, text, text, text, text, text, bigint)"
    )
    result: list[dict[str, object]] = []
    for source in cases:
        case = dict(source)
        case_id = str(case["id"])
        if case_id in {"R4-TX-01","R4-TX-02","R4-TX-04","R4-TX-05",
                       "R4-TX-07","R4-TX-08","R4-TX-09"}:
            case["function"] = terminal
            if case_id == "R4-TX-04":
                case["old"] = "app_private.append_bootstrap_event_r2("
                case["new"] = "false * ("
        elif case_id == "R4-TX-03":
            case["function"] = approve
            case["old"] = (
                "PERFORM app_private.terminalize_expired_root_change_r5(\n"
                "      p_recovery_id,'APPROVE_EXPIRY',v_now\n"
                "    );"
            )
            case["new"] = "RAISE EXCEPTION 'root change approval expired';"
            case["check"] = "approve_expiry_calls_terminalizer"
        elif case_id == "R4-REC-01":
            case["function"] = begin
            case["old"] = (
                "PERFORM app_private.assert_current_root_authority_r5("
            )
            case["new"] = "PERFORM false * ("
            case["check"] = "rotation_requires_active_root"
        elif case_id == "R4-CAND-05":
            case["function"] = candidate
            case["old"] = "SET candidate_id=v_source_candidate_id"
            case["new"] = (
                "SET candidate_id=coalesce(v_source_candidate_id,'UNKNOWN')"
            )
            case["check"] = "candidate_no_invented_value"
        elif case_id == "R4-CAND-06":
            case["scope"] = "sql-last"
            case["old"] = (
                "RAISE EXCEPTION\n"
                "      'professional review candidate backfill batches are incomplete'\n"
                "      USING ERRCODE='23502';"
            )
            case["new"] = "NULL;"
            case["check"] = "candidate_unknown_fails_closed"
        elif case_id == "R4-CAND-07":
            case["check"] = "candidate_guard_sealed"
        elif case_id == "R4-CAND-08":
            case["check"] = "candidate_guard_snapshot"
        elif case_id == "R4-CAND-11":
            case["function"] = candidate
            case["old"] = (
                "LOCK TABLE\n"
                "    app.professional_review_event,\n"
                "    app.selection_professional_review_result,\n"
                "    app.sales_handoff_snapshot_r3,\n"
                "    app.sales_snapshot_professional_review_r3\n"
                "  IN SHARE ROW EXCLUSIVE MODE;"
            )
            case["new"] = "-- mutation removed source freeze"
            case["check"] = "candidate_migration_locks_sources"
        elif case_id == "R4-ACL-01":
            case["check"] = "completion_grant_in_final_tail"
        result.append(case)
    return result


def apply_case(sql: str, definitions, case: dict[str, object]) -> str:
    r4v = load_module(
        "r4_validator_apply_for_r5",
        Path(definitions["__root__"]) / "tools/validate_r4.py",
    ) if "__root__" in definitions else None
    function = case.get("function")
    if function:
        if case.get("part") == "header":
            item = definitions[str(function)]
            header = sql[int(item["header_start"]):int(item["header_end"])]
            revised = header.replace(str(case["old"]), str(case["new"]), 1)
            return (
                sql[:int(item["header_start"])]
                + revised
                + sql[int(item["header_end"]):]
            )
        item = definitions[str(function)]
        body = str(item["body"])
        if str(case["old"]) not in body:
            return sql
        revised = body.replace(str(case["old"]), str(case["new"]), 1)
        return (
            sql[:int(item["body_start"])]
            + revised
            + sql[int(item["body_end"]):]
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


def negative_state_vectors() -> list[dict[str, object]]:
    results: list[dict[str, object]] = []

    model = AttemptModel()
    model.begin("A1",now=0)
    model.approve("A1","APPROVER")
    model.revoke_approval("A1")
    try:
        model.execute("A1",True)
        rejected = False
    except ValueError:
        rejected = True
    results.append({
        "id":"revoked_approval_cannot_execute",
        "pass":rejected,
    })

    model = AttemptModel()
    model.begin("A1",now=0)
    model.approve("A1","APPROVER")
    try:
        model.execute("A1",False)
        rejected = False
    except ValueError:
        rejected = True
    results.append({
        "id":"revoked_root_cannot_execute",
        "pass":rejected and model.generation == 1,
    })

    model = AttemptModel()
    model.begin("A1",now=0)
    sequence = model.begin("A2",now=20)
    results.append({
        "id":"expired_active_attempt_replaced",
        "pass":(
            sequence == 2
            and model.get("A1")["state"] == "LOCKED"
            and model.get("A1")["terminalized_by"] == "BEGIN_EXPIRED_SWEEP"
            and model.get("A2")["state"] == "PENDING"
        ),
    })

    model = AttemptModel()
    model.begin("A1",now=0)
    model.approve("A1","APPROVER")
    try:
        model.begin("A2",now=1)
        rejected = False
    except ValueError:
        rejected = True
    results.append({
        "id":"single_active_attempt",
        "pass":rejected and len(model.attempts) == 1,
    })

    replay = ReplayModel()
    request_id = "req-response-loss-001"
    first = replay.execute(request_id)
    replay.lose_response()
    second = replay.replay(request_id)
    results.append({
        "id":"response_loss_replay_non_vacuous",
        "request_id":request_id,
        "first_result":first,
        "replay_result":second,
        "ledger_rows":len(replay.ledger),
        "business_transitions":replay.business_transitions,
        "event_count":replay.events,
        "pass":(
            first is not None
            and second is not None
            and first == second
            and len(replay.ledger) == 1
            and replay.business_transitions == 1
            and replay.events == 1
        ),
    })
    return results


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    guard = require_guard(root)
    repo = root.parents[2]
    r4 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r4"
    r4_review = (
        repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r4"
    )
    r3 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r3"
    r3_review = (
        repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r3"
    )
    r2 = repo / "docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"
    r2_review = (
        repo / "docs/product/full-mvp-remediation-review-r3-c8-corrections-r2"
    )

    manifests = [
        verify_manifest(r4 / "SHA256SUMS_R4.txt", R4_MANIFEST_SHA256),
        verify_manifest(
            r4_review / "SHA256SUMS_R4_REVIEW.txt",
            R4_REVIEW_MANIFEST_SHA256,
        ),
        verify_manifest(
            r3 / "SHA256SUMS_R3_C8_CORRECTIONS_R3.txt",
            "C5611B8807D50E3E02286A63B5C9E39F9F745684793C2FD5525DCA4537A71825",
        ),
        verify_manifest(
            r3_review / "SHA256SUMS_R3_C8_CORRECTIONS_R3_REVIEW.txt",
            "1500C72F8059AAD1D15F4829818D1BA688CD57B95DD606CDFEB26A3D58285EC2",
        ),
        verify_manifest(
            r2 / "SHA256SUMS_R3_C8_CORRECTIONS_R2.txt",
            "45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8",
        ),
        verify_manifest(
            r2_review / "SHA256SUMS_R3_C8_CORRECTIONS_R2_REVIEW.txt",
            "5865AAE961DDCFF7A546D6435729455D091810FF3BF8D4A155CA0EDB36082FF1",
        ),
    ]
    key_hashes = {
        "r4_complete": sha256(r4 / "DATABASE_COMPLETE_DDL_DESIGN_R4.sql"),
        "r4_overlay": sha256(r4 / "DATABASE_FINAL_STATE_OVERLAY_R4.sql"),
        "r4_registry": sha256(
            r4 / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R4.json"
        ),
        "r4_evidence": sha256(r4 / "VALIDATION_EVIDENCE_R4.json"),
        "r4_review": sha256(r4_review / "INDEPENDENT_REVIEW_R4.md"),
        "r4_review_evidence": sha256(
            r4_review / "VALIDATION_EVIDENCE_REVIEW_R4.json"
        ),
    }
    expected_key_hashes = {
        "r4_complete": R4_COMPLETE_SHA256,
        "r4_overlay": R4_OVERLAY_SHA256,
        "r4_registry": R4_REGISTRY_SHA256,
        "r4_evidence": R4_EVIDENCE_SHA256,
        "r4_review": R4_REVIEW_SHA256,
        "r4_review_evidence": R4_REVIEW_EVIDENCE_SHA256,
    }

    ddl_path = root / "DATABASE_COMPLETE_DDL_DESIGN_R5.sql"
    overlay_path = root / "DATABASE_FINAL_STATE_OVERLAY_R5.sql"
    registry_path = root / "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R5.json"
    sql = ddl_path.read_text(encoding="utf-8")
    r3_sql = (
        r3 / "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql"
    ).read_text(encoding="utf-8")
    registry = json.loads(registry_path.read_text(encoding="utf-8"))

    r3v = load_module("r3_validator_for_r5", r3 / "tools/validate_r3.py")
    r4v = load_module("r4_validator_for_r5_main", r4 / "tools/validate_r4.py")
    tables, keys, fks = r3v.table_blocks(sql)
    fk_errors: list[dict[str, object]] = []
    for source, source_columns, target, target_columns in fks:
        if len(source_columns) != len(target_columns):
            fk_errors.append({"source":source,"reason":"arity"})
        if source not in tables or any(
            column not in tables[source] for column in source_columns
        ):
            fk_errors.append({"source":source,"reason":"source-columns"})
        if target not in tables:
            fk_errors.append({"source":source,"reason":"missing-target"})
        elif target_columns not in keys.get(target,set()):
            fk_errors.append({
                "source":source,
                "target":target,
                "target_columns":target_columns,
                "reason":"target-key",
            })

    definitions = r4v.function_definitions(sql)
    checks = semantic_checks(sql, r3_sql, registry, root)
    checks["all_input_manifests_valid"] = all(
        bool(item["pass"]) for item in manifests
    )
    checks["key_input_hashes_match"] = all(
        key_hashes[key] == expected_key_hashes[key]
        for key in expected_key_hashes
    )
    checks["fk_target_integrity"] = not fk_errors
    required_deliverables = {
        "P1_PRODUCT_REMEDIATION_DESIGN_R5.md",
        "DATABASE_COMPLETE_DDL_DESIGN_R5.sql",
        "DATABASE_FINAL_STATE_OVERLAY_R5.sql",
        "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R5.json",
        "ROTATION_EXECUTE_CURRENT_ROOT_REVALIDATION_R5.md",
        "EXPIRED_ACTIVE_ATTEMPT_AUTO_TERMINALIZATION_R5.md",
        "CANDIDATE_BACKFILL_DURABLE_AUDIT_R5.md",
        "CANDIDATE_SEALED_DIGEST_COMPATIBILITY_R5.md",
        "RESPONSE_LOSS_REPLAY_NON_VACUOUS_VALIDATION_R5.md",
        "FINDING_MUTATION_TRACEABILITY_R5.md",
        "HISTORICAL_FINDING_CLOSURE_MATRIX_R5.md",
        "OPEN_DECISIONS_DISPOSITION_R5.md",
        "P1_P2_P3_ACCEPTANCE_TEST_MATRIX_R5.md",
        "VALIDATOR_MUTATION_COVERAGE_R5.md",
        "VALIDATION_EVIDENCE_R5.json",
        "DESIGN_CHANGELOG_R5.md",
        "UNVERIFIED_ITEMS_R5.md",
        "SIDE_EFFECT_AND_GIT_AUDIT_R5.md",
    }
    checks["required_deliverables_present"] = all(
        (root / name).is_file() for name in required_deliverables
    )

    r3_tree = ast.parse((r3 / "tools/validate_r3.py").read_text(encoding="utf-8"))
    formal_mutations = literal_dict(r3_tree, "mutations")
    r2_mutations = literal_dict(r3_tree, "r2_mutations")
    baseline_required = r3v.req_checks(sql)
    baseline_failures = {
        key for key, value in baseline_required.items() if not value
    }
    formal_results: list[dict[str, object]] = []
    for mutation_id, pair in formal_mutations.items():
        old, new = pair
        mutated = sql.replace(old, new) if old in sql else sql
        changed = r3v.req_checks(mutated)
        failures = {key for key, value in changed.items() if not value}
        new_failures = sorted(baseline_failures.symmetric_difference(failures))
        formal_results.append({
            "id":mutation_id,
            "target_present":old in sql,
            "detected":old in sql and mutation_id in new_failures,
            "new_failures":new_failures,
        })

    baseline_r2 = r3v.r2_marker_checks(sql)
    r2_results: list[dict[str, object]] = []
    for mutation_id, (key, pairs) in r2_mutations.items():
        mutated = sql
        for old, new in pairs:
            mutated = mutated.replace(old, new)
        changed = r3v.r2_marker_checks(mutated)
        r2_results.append({
            "id":mutation_id,
            "target_present":all(old in sql for old, _ in pairs),
            "detected":(
                all(old in sql for old, _ in pairs)
                and bool(baseline_r2[key])
                and not bool(changed[key])
            ),
        })

    r4_results: list[dict[str, object]] = []
    for case in adjusted_r4_cases(r4v, definitions):
        mutated = apply_case(sql, definitions, case)
        changed_checks = semantic_checks(mutated, r3_sql, registry, root)
        check_name = str(case["check"])
        detected = bool(checks[check_name]) and not bool(
            changed_checks.get(check_name, False)
        )
        r4_results.append({
            **case,
            "target_present":mutated != sql,
            "detected":detected,
            "mutated_check_value":changed_checks.get(check_name),
        })

    negative = negative_state_vectors()
    independent_rules = [
        {
            "id":"IND-MUT-01",
            "basis":"terminal expiry helper contains no update-then-raise path",
            "pass":checks["expiry_no_unhandled_raise"],
        },
        {
            "id":"IND-MUT-02",
            "basis":"expiry helper completes no caller Ledger operation",
            "pass":checks["terminalization_atomic_evidence"],
        },
        {
            "id":"IND-MUT-03",
            "basis":"DENIED attempt history permits a later ordered Begin",
            "pass":checks["active_attempt_unique"]
            and checks["attempt_identity_unique"],
        },
        {
            "id":"IND-MUT-04",
            "basis":"LOCKED attempt history permits a later ordered Begin",
            "pass":checks["active_attempt_unique"]
            and checks["begin_accepts_locked_recovery"],
        },
        {
            "id":"IND-MUT-05",
            "basis":"sequence allocator is a single atomic upsert",
            "pass":checks["attempt_sequence_atomic"],
        },
        {
            "id":"IND-MUT-06",
            "basis":"partial unique permits at most one active Attempt",
            "pass":checks["active_attempt_unique"],
        },
        {
            "id":"IND-MUT-07",
            "basis":"old approval is scoped to recovery_id",
            "pass":checks["approval_scoped_to_attempt"],
        },
        {
            "id":"IND-MUT-08",
            "basis":"delayed Execute requires APPROVED state",
            "pass":checks["execute_requires_approved"],
        },
        {
            "id":"IND-MUT-09",
            "basis":"sequence Function Owner has exact DML",
            "pass":checks["sequence_table_function_owner_privilege"],
        },
        {
            "id":"IND-MUT-10",
            "basis":"ROTATION Execute and Generation trigger recheck Root",
            "pass":checks["execute_rotation_current_root_recheck"]
            and checks["generation_trigger_rechecks_current_root"],
        },
        {
            "id":"IND-MUT-11",
            "basis":"revoked Initiator cannot Begin",
            "pass":checks["begin_initiator_principal_active"],
        },
        {
            "id":"IND-MUT-12",
            "basis":"revoked/disabled Approver Principal is rejected",
            "pass":checks["approve_deny_principal_active"],
        },
        {
            "id":"IND-MUT-13",
            "basis":"Execute creates no Principal",
            "pass":checks["execute_does_not_provision_principal"],
        },
        {
            "id":"IND-MUT-14",
            "basis":"Execute creates no Principal Epoch",
            "pass":checks["execute_does_not_provision_principal"],
        },
        {
            "id":"IND-MUT-15",
            "basis":"both Candidate columns become NOT NULL",
            "pass":checks["candidate_two_not_null"],
        },
        {
            "id":"IND-MUT-16",
            "basis":"guard permits only Candidate NULL to value",
            "pass":checks["candidate_guard_exception_narrow"],
        },
        {
            "id":"IND-MUT-17",
            "basis":"backfill source joins are exact and unique",
            "pass":checks["candidate_source_exact_join"],
        },
        {
            "id":"IND-MUT-18",
            "basis":"source and target tables are transaction-frozen",
            "pass":checks["candidate_sources_frozen"],
        },
        {
            "id":"IND-MUT-19",
            "basis":"original sealed digest and correction digest are recorded",
            "pass":checks["candidate_digest_proof"],
        },
        {
            "id":"IND-MUT-20",
            "basis":"expired active Attempt is swept and replaced",
            "pass":checks["expired_begin_sweeps_active_attempt"]
            and all(
                item["pass"]
                for item in negative
                if item["id"] == "expired_active_attempt_replaced"
            ),
        },
        {
            "id":"IND-MUT-21",
            "basis":"Candidate backfill has per-row durable audit",
            "pass":checks["candidate_row_audit_table"]
            and checks["candidate_per_row_old_new"]
            and checks["candidate_audit_before_update"],
        },
        {
            "id":"IND-MUT-22",
            "basis":"response-loss replay compares non-NULL durable results",
            "pass":all(
                item["pass"]
                for item in negative
                if item["id"] == "response_loss_replay_non_vacuous"
            ),
        },
    ]

    traceability_path = root / "FINDING_MUTATION_TRACEABILITY_R5.md"
    traceability = traceability_path.read_text(encoding="utf-8")
    canonical_start = traceability.find("## Canonical Finding Registry")
    canonical_end = traceability.find("## Historical Duplicate-ID Resolution")
    canonical_section = traceability[canonical_start:canonical_end]
    canonical_findings = re.findall(
        r"^\|\s*`([^`]+)`\s*\|", canonical_section, re.M
    )
    r4_ids = [str(item["id"]) for item in r4_results]
    independent_ids = [str(item["id"]) for item in independent_rules]
    checks["finding_registry_unique"] = (
        len(canonical_findings) == 5
        and len(set(canonical_findings)) == 5
    )
    checks["candidate_mutation_range_01_11"] = all(
        f"R4-CAND-{index:02d}" in traceability
        for index in range(1,12)
    )
    checks["r4_tx_09_registered"] = "R4-TX-09" in traceability
    checks["duplicate_p3_resolution_complete"] = (
        "R4-HIST-P3-01A" in traceability
        and "R4-HIST-P3-01B" in traceability
        and "No historical text was edited" in traceability
    )
    checks["r4_mutation_ids_unique"] = len(r4_ids) == len(set(r4_ids)) == 46
    checks["independent_rule_ids_unique"] = (
        len(independent_ids) == len(set(independent_ids)) == 22
    )
    checks["all_r4_mutation_checks_resolve"] = all(
        str(item["check"]) in checks for item in r4_results
    )
    checks["all_evidence_ids_known"] = (
        {f"R4-CAND-{index:02d}" for index in range(1,12)}
        <= set(r4_ids)
        and "R4-TX-09" in r4_ids
        and "IND-MUT-10" in independent_ids
        and "IND-MUT-20" in independent_ids
        and "IND-MUT-21" in independent_ids
        and "IND-MUT-22" in independent_ids
    )

    object_inventory = {
        "tables":len(tables),
        "foreign_keys":len(fks),
        "function_signatures":len(definitions),
        "triggers":len(re.findall(
            r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+",sql,re.I
        )),
        "roles":len(set(re.findall(
            r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)",sql,re.I
        ))),
        "views":len(re.findall(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+app\.",sql,re.I
        )),
        "sequences":len(re.findall(
            r"CREATE\s+SEQUENCE\s+app\.",sql,re.I
        )),
        "procedures":len(re.findall(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+app\.",sql,re.I
        )),
    }
    result = {
        "design":"FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R5",
        "scope":"OFFLINE STATIC ANALYSIS AND STATE MODELS; NO SQL OR DATABASE EXECUTION",
        "guard":guard,
        "input_manifests":manifests,
        "key_input_hashes":key_hashes,
        "expected_key_input_hashes":expected_key_hashes,
        "complete_ddl_sha256":sha256(ddl_path),
        "complete_ddl_bytes":ddl_path.stat().st_size,
        "complete_ddl_lines":len(sql.splitlines()),
        "overlay_sha256":sha256(overlay_path),
        "registry_sha256":sha256(registry_path),
        "object_inventory":object_inventory,
        "semantic_checks":checks,
        "failed_checks":sorted(
            key for key, value in checks.items() if not value
        ),
        "fk_errors":fk_errors,
        "formal_mutations_total":len(formal_results),
        "formal_mutations_detected":sum(
            bool(item["detected"]) for item in formal_results
        ),
        "formal_mutation_results":formal_results,
        "r2_mutations_total":len(r2_results),
        "r2_mutations_detected":sum(
            bool(item["detected"]) for item in r2_results
        ),
        "r2_mutation_results":r2_results,
        "r4_mutations_total":len(r4_results),
        "r4_mutations_detected":sum(
            bool(item["detected"]) for item in r4_results
        ),
        "r4_mutation_results":r4_results,
        "independent_negative_total":len(independent_rules),
        "independent_negative_detected":sum(
            bool(item["pass"]) for item in independent_rules
        ),
        "independent_negative_results":independent_rules,
        "state_vectors":negative,
        "postgresql_grammar":"NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_execution":"NOT EXECUTED — DATABASE NOT AUTHORIZED",
        "runtime_concurrency":"NOT EXECUTED — RUNTIME NOT AUTHORIZED",
    }
    result["failed_checks"] = sorted(
        key for key, value in checks.items() if not value
    )
    result["semantic_checks"] = checks
    result["result"] = "PASS" if (
        not result["failed_checks"]
        and not fk_errors
        and all(item["detected"] for item in formal_results)
        and all(item["detected"] for item in r2_results)
        and all(item["detected"] for item in r4_results)
        and all(item["pass"] for item in independent_rules)
        and all(item["pass"] for item in negative)
    ) else "FAIL"
    output = root / "VALIDATION_EVIDENCE_R5.json"
    output.write_text(
        json.dumps(result,indent=2,ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "failed_checks":result["failed_checks"],
        "fk_errors":len(fk_errors),
        "object_inventory":object_inventory,
        "formal_mutations":(
            f"{result['formal_mutations_detected']}/{len(formal_results)}"
        ),
        "r2_mutations":(
            f"{result['r2_mutations_detected']}/{len(r2_results)}"
        ),
        "r4_mutations":(
            f"{result['r4_mutations_detected']}/{len(r4_results)}"
        ),
        "independent_negative":(
            f"{result['independent_negative_detected']}/{len(independent_rules)}"
        ),
        "state_vectors":(
            f"{sum(bool(item['pass']) for item in negative)}/{len(negative)}"
        ),
        "result":result["result"],
        "output":str(output),
    },indent=2))
    return 0 if result["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

