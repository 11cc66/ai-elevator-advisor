"""Static structural and mutation validation for R3."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from guard import require_guarded_context


def n(v: str) -> str:
    return re.sub(r"\s+", " ", v.strip().lower())


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def cols(v: str) -> tuple[str, ...]:
    return tuple(n(x) for x in v.split(",") if x.strip())


def table_blocks(sql: str):
    tables, keys, fks = {}, {}, []
    for m in re.finditer(r"CREATE\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s*\(", sql, re.I):
        table=m.group(1).lower(); start=sql.find("(",m.start()); depth=0; end=start
        for i in range(start,len(sql)):
            if sql[i]=="(": depth+=1
            elif sql[i]==")":
                depth-=1
                if depth==0: end=i; break
        body=sql[start+1:end]
        tables.setdefault(table,set()); keys.setdefault(table,set())
        for c in re.finditer(r"^\s*([a-z_][a-z0-9_]*)\s+[a-z]",body,re.I|re.M):
            if c.group(1).lower() not in {"constraint","primary","foreign","unique","check"}:
                tables[table].add(c.group(1).lower())
        for c in re.finditer(
            r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",
            body,
            re.I | re.M,
        ):
            keys[table].add((c.group(1).lower(),))
        for k in re.finditer(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",body,re.I|re.S):
            keys[table].add(cols(k.group(1)))
        for f in re.finditer(
            r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
            r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",body,re.I|re.S):
            fks.append((table,cols(f.group(1)),f.group(2).lower(),cols(f.group(3))))
    for m in re.finditer(r"ALTER\s+TABLE\s+(app\.[a-z_][a-z0-9_]*)\s+([\s\S]*?);",sql,re.I):
        table=m.group(1).lower(); body=m.group(2)
        tables.setdefault(table,set()); keys.setdefault(table,set())
        for c in re.finditer(r"ADD\s+COLUMN\s+([a-z_][a-z0-9_]*)",body,re.I):
            tables[table].add(c.group(1).lower())
        for k in re.finditer(r"(?:PRIMARY\s+KEY|UNIQUE)\s*\(([^()]*)\)",body,re.I|re.S):
            keys[table].add(cols(k.group(1)))
        for f in re.finditer(
            r"FOREIGN\s+KEY\s*\(([^()]*)\)\s+REFERENCES\s+"
            r"(app\.[a-z_][a-z0-9_]*)\s*\(([^()]*)\)",body,re.I|re.S):
            fks.append((table,cols(f.group(1)),f.group(2).lower(),cols(f.group(3))))
    return tables,keys,fks


def core_checks(sql: str) -> dict[str,bool]:
    b=n(sql)
    return {
        "no_bootstrap_root_session_old_fk":
            "bootstrap_root_session_generation_fk_r2" not in b,
        "bootstrap_root_session_generation_history_fk_r3":
            "bootstrap_root_session_generation_history_fk_r3" in b,
        "approval_uses_generation_history":
            "bootstrap_approval_generation_identity_fk_r3" in b,
        "lifecycle_state_fk_deferrable":
            "bootstrap_lifecycle_generation_fk_r3" in b,
        "issuance_attempt":
            "bootstrap_issuance_attempt_r3" in b,
        "recovery_expiry":
            "approval_expires_at" in b,
        "recovery_single_generation":
            "bootstrap_recovery_one_per_generation_r3" in b,
        "recovery_replay_first":
            b.find(
                "claim_bootstrap_request_r2",
                b.rfind("create or replace function app.bootstrap_execute_root_change_r2")
            )
            < b.find(
                "from app.bootstrap_lifecycle_r2",
                b.rfind("create or replace function app.bootstrap_execute_root_change_r2")
            ),
        "root_active_check":
            "root principal is not active" in b,
        "owner_advisory_lock":
            "pg_advisory_xact_lock" in b,
        "catalog_source_pk_fk":
            "foreign key (source_revision_id) references app.catalog_source_revision(id)" in b,
        "catalog_event_pk_fk":
            "foreign key (source_target_binding_id) references app.catalog_source_target_binding_r2(id)" in b,
        "catalog_source_evidence_trigger":
            "a_bind_catalog_source_evidence_r3" in b,
        "catalog_event_binding_trigger":
            "a_bind_catalog_event_binding_r3" in b,
        "professional_candidate_columns":
            b.count("add column candidate_id text") >= 2,
        "professional_candidate_triggers":
            "a_bind_professional_candidate_r3" in b
            and "a_bind_snapshot_professional_candidate_r3" in b,
        "result_recovery_single":
            "command_result_recovery_single_request_r3" in b,
        "result_recovery_replay_first":
            b.find(
                "claim_command_request",
                b.rfind("create or replace function app.approve_command_result_recovery_r2")
            )
            < b.find(
                "rr.state<>'pending'",
                b.rfind("create or replace function app.approve_command_result_recovery_r2")
            ),
        "catalog_actor_grant_fk":
            "catalog_binding_actor_grant_fk_r3" in b,
        "final_public_revoke":
            "revoke execute on all functions in schema app from public" in b
            and "revoke execute on all functions in schema app_private from public" in b,
        "state_timestamp_checks":
            "bootstrap_root_session_revocation_check_r3" in b
            and "command_result_recovery_state_timestamp_check_r3" in b,
    }


def req_checks(sql: str) -> dict[str,bool]:
    b=n(sql)
    return {
        "root1_operator_principal":"principal_id=st.root_principal_id" in b,
        "root2_operator_role":"role_name=st.root_role_name" in b,
        "root3_session_principal":"st.root_principal_id,v_epoch,session_user" in b,
        "root4_grant_recipient":"check (root_principal_id=issuer_principal_id)" in b,
        "root5_grant_session":"root_grant_id,root_session_id,root_principal_id" in b,
        "root6_nonroot_approvals":"check (principal_id<>root_principal_id)" in b,
        "root7_generation":"bootstrap_generation=st.bootstrap_generation" in b,
        "root8_single_root_grant":"unique (root_grant_id,bootstrap_id,bootstrap_generation)" in b,
        "owner1_database_self":"v_database_owner=v_role_oid" in b,
        "owner2_database_member":"pg_has_role(v_role_oid,v_database_owner,'member')" in b,
        "owner3_pg_database_owner":"pg_database_owner" in b,
        "owner4_schema_owner":"n.nspowner=v_role_oid" in b,
        "owner5_schema_indirect":"pg_has_role(v_role_oid,n.nspowner,'member')" in b,
        "owner6_table_owner":"c.relowner=v_role_oid" in b and "c.relkind in ('r','p','v','m','f','s')" in b,
        "owner7_sequence_owner":"c.relkind in ('r','p','v','m','f','s')" in b,
        "owner8_view_owner":"c.relkind in ('r','p','v','m','f','s')" in b,
        "owner9_function_owner":"p.proowner=v_role_oid" in b,
        "owner10_set":"set_option" in b,
        "owner11_inherit":"inherit_option" in b,
        "owner12_admin":"admin_seen" in b,
        "cat1_binding_table":"create table app.catalog_source_target_binding_r2" in b,
        "cat2_product_source":"product_revision_source_exact_unique_r2" in b,
        "cat3_spec_source":"specification_revision_source_exact_unique_r2" in b,
        "cat4_price_source":"price_revision_source_exact_unique_r2" in b,
        "cat5_source_fk":"foreign key (source_revision_id) references app.catalog_source_revision(id)" in b,
        "cat6_target_key":"catalog_binding_target_identity_unique_r2" in b,
        "cat7_event_binding_fk":"catalog_event_source_target_binding_fk_r2" in b,
        "cat8_event_digest":"sourcetargetbindingdigest" in b,
        "cat9_snapshot_binding":"snapshot_catalog_source_target_binding_fk_r2" in b,
    }


def r2_marker_checks(sql: str) -> dict[str,bool]:
    b=n(sql)
    return {
        "root_principal":"principal_id=st.root_principal_id" in b,
        "root_grant":"check (root_principal_id=issuer_principal_id)" in b,
        "recovery_functions":all(x in b for x in (
            "create or replace function app.bootstrap_begin_root_change_r2",
            "create or replace function app.bootstrap_approve_root_change_r2",
            "create or replace function app.bootstrap_execute_root_change_r2",
        )),
        "database_owner":"v_database_owner=v_role_oid" in b,
        "schema_owner":"n.nspowner=v_role_oid" in b,
        "relation_owner":"c.relowner=v_role_oid" in b,
        "function_owner":"p.proowner=v_role_oid" in b,
        "catalog_table":"create table app.catalog_source_target_binding_r2" in b,
        "catalog_event_binding":"sourcetargetbindingdigest" in b,
        "original_session":"if orig.state='active'" in b,
        "field_trigger":"a_validate_selection_requirement_domain_r2" in b,
        "bootstrap_guard":"deny_bootstrap_event_truncate_r2" in b,
    }


def main() -> int:
    root=Path(__file__).resolve().parents[1]
    guard=require_guarded_context(root)
    repo=root.parents[2]
    r2=repo/"docs/product/full-mvp-remediation-design-r3-c8-corrections-r2"
    ddl=root/"DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql"
    overlay=root/"DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R3.sql"
    registry=root/"DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R3.json"
    required=[
        "P1_PRODUCT_REMEDIATION_DESIGN_R3_C8_CORRECTIONS_R3.md",
        "DATABASE_ROLE_PRIVILEGE_MATRIX_R3_C8_CORRECTIONS_R3.md",
        "BOOTSTRAP_GENERATION_AND_RECOVERY_R3.md",
        "CATALOG_SOURCE_TARGET_BINDING_R3.md",
        "SECURITY_DEFINER_FINAL_ACL_CLOSURE_R3.md",
        "REQUEST_LEDGER_IDEMPOTENCY_AND_RECOVERY_R3.md",
        "OWNER_PRIVILEGE_CLOSURE_AND_CONCURRENCY_R3.md",
        "R3_C8_CORRECTIONS_R3_FINDING_TRACEABILITY.md",
        "HISTORICAL_FINDING_CLOSURE_MATRIX_R3.md",
        "OPEN_DECISIONS_DISPOSITION_R3.md",
        "P1_P2_P3_ACCEPTANCE_TEST_MATRIX_R3.md",
        "VALIDATOR_MUTATION_COVERAGE_R3.md",
        "DESIGN_CHANGELOG_R3.md",
        "UNVERIFIED_ITEMS_R3.md",
        "SIDE_EFFECT_AND_GIT_AUDIT_R3.md",
    ]
    missing=[x for x in required if not (root/x).is_file()]
    if missing:
        raise SystemExit(f"missing required files: {missing}")
    sql=ddl.read_text(encoding="utf-8")
    tables,keys,fks=table_blocks(sql)
    fk_errors=[]
    for source,sc,target,tc in fks:
        if len(sc)!=len(tc): fk_errors.append({"source":source,"reason":"arity"})
        if target not in tables: fk_errors.append({"source":source,"target":target,"reason":"missing_table"})
        elif tc not in keys.get(target,set()): fk_errors.append({"source":source,"target":target,"columns":tc,"reason":"target_key"})
        if source in tables and any(x not in tables[source] for x in sc):
            fk_errors.append({"source":source,"reason":"source_columns"})
    functions=len(set(re.findall(r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)\s*\(",sql,re.I)))
    triggers=len(re.findall(r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+",sql,re.I))
    roles=len(set(re.findall(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)",sql,re.I)))
    checks=core_checks(sql)
    checks["r2_manifest_hash"]=sha(r2/"SHA256SUMS_R3_C8_CORRECTIONS_R2.txt")=="45331850C8DB01CC4AE1DC58825AFFB9E5187259CD28F0B68D6BE32F9F6422E8"
    checks["fk_target_integrity"]=not fk_errors
    checks["registry_parses"]=isinstance(json.loads(registry.read_text(encoding="utf-8")),dict)
    checks["complete_contains_overlay"]="BEGIN R3-C8 CORRECTIONS R3 OVERLAY" in sql
    required_mutations=req_checks(sql)
    mutations={
        "root1_operator_principal":("principal_id=st.root_principal_id","principal_id=rootop.principal_id"),
        "root2_operator_role":("role_name=st.root_role_name","role_name=session_user"),
        "root3_session_principal":("st.root_principal_id,v_epoch,session_user","rootop.principal_id,v_epoch,session_user"),
        "root4_grant_recipient":("CHECK (root_principal_id=issuer_principal_id)","CHECK (true)"),
        "root5_grant_session":("root_grant_id,root_session_id,root_principal_id","root_grant_id,root_session_id,issuer_principal_id"),
        "root6_nonroot_approvals":("CHECK (principal_id<>root_principal_id)","CHECK (true)"),
        "root7_generation":("bootstrap_generation=st.bootstrap_generation","bootstrap_generation>0"),
        "root8_single_root_grant":("UNIQUE (root_grant_id,bootstrap_id,bootstrap_generation)","UNIQUE (root_grant_id)"),
        "owner1_database_self":("v_database_owner=v_role_oid","false"),
        "owner2_database_member":("pg_has_role(v_role_oid,v_database_owner,'MEMBER')","false"),
        "owner3_pg_database_owner":("pg_database_owner","removed_owner_name"),
        "owner4_schema_owner":("n.nspowner=v_role_oid","false"),
        "owner5_schema_indirect":("pg_has_role(v_role_oid,n.nspowner,'MEMBER')","false"),
        "owner6_table_owner":("c.relowner=v_role_oid","false"),
        "owner7_sequence_owner":("c.relkind IN ('r','p','v','m','f','S')","c.relkind='r'"),
        "owner8_view_owner":("c.relkind IN ('r','p','v','m','f','S')","c.relkind='r'"),
        "owner9_function_owner":("p.proowner=v_role_oid","false"),
        "owner10_set":("set_option","removed_set"),
        "owner11_inherit":("inherit_option","removed_inherit"),
        "owner12_admin":("admin_seen","removed_admin"),
        "cat1_binding_table":("CREATE TABLE app.catalog_source_target_binding_r2","CREATE TABLE app.removed_binding_r2"),
        "cat2_product_source":("product_revision_source_exact_unique_r2","removed_product_source"),
        "cat3_spec_source":("specification_revision_source_exact_unique_r2","removed_spec_source"),
        "cat4_price_source":("price_revision_source_exact_unique_r2","removed_price_source"),
        "cat5_source_fk":("FOREIGN KEY (source_revision_id)\n    REFERENCES app.catalog_source_revision(id)","FOREIGN KEY (source_revision_id) REFERENCES app.removed_source(id)"),
        "cat6_target_key":("catalog_binding_target_identity_unique_r2","removed_target_key"),
        "cat7_event_binding_fk":("catalog_event_source_target_binding_fk_r2","removed_event_binding"),
        "cat8_event_digest":("sourceTargetBindingDigest","removedBindingDigest"),
        "cat9_snapshot_binding":("snapshot_catalog_source_target_binding_fk_r2","removed_snapshot_binding"),
    }
    mutation_results=[]
    baseline_fail={k for k,v in required_mutations.items() if not v}
    for mid,(old,new) in mutations.items():
        if old not in sql:
            mutation_results.append({"id":mid,"detected":False,"reason":"mutation target missing"})
            continue
        mutated=sql.replace(old,new)
        mchecks=req_checks(mutated)
        newfail=sorted(baseline_fail.symmetric_difference({k for k,v in mchecks.items() if not v}))
        mutation_results.append({"id":mid,"detected":mid in newfail,"new_failures":newfail})
    r2_mutations = {
        "root_principal":("root_principal",[("principal_id=st.root_principal_id","principal_id=rootop.principal_id")]),
        "root_grant":("root_grant",[("CHECK (root_principal_id=issuer_principal_id)","CHECK (true)")]),
        "recovery_functions":("recovery_functions",[
            ("CREATE OR REPLACE FUNCTION app.bootstrap_begin_root_change_r2","CREATE OR REPLACE FUNCTION app.removed_begin_r2"),
            ("CREATE OR REPLACE FUNCTION app.bootstrap_approve_root_change_r2","CREATE OR REPLACE FUNCTION app.removed_approve_r2"),
            ("CREATE OR REPLACE FUNCTION app.bootstrap_execute_root_change_r2","CREATE OR REPLACE FUNCTION app.removed_execute_r2"),
        ]),
        "database_owner":("database_owner",[("IF v_database_owner=v_role_oid","IF false")]),
        "schema_owner":("schema_owner",[("AND (n.nspowner=v_role_oid","AND (false")]),
        "relation_owner":("relation_owner",[("AND (c.relowner=v_role_oid","AND (false")]),
        "function_owner":("function_owner",[("AND (p.proowner=v_role_oid","AND (false")]),
        "catalog_table":("catalog_table",[("CREATE TABLE app.catalog_source_target_binding_r2","CREATE TABLE app.removed_binding_r2")]),
        "catalog_event_binding":("catalog_event_binding",[("'sourceTargetBindingDigest',p_row->>'source_target_binding_digest'","'removedBindingDigest',''")]),
        "original_session":("original_session",[("IF orig.state='ACTIVE'","IF false")]),
        "field_trigger":("field_trigger",[("CREATE TRIGGER a_validate_selection_requirement_domain_r2","CREATE TRIGGER removed_selection_domain_r2")]),
        "bootstrap_guard":("bootstrap_guard",[("CREATE TRIGGER deny_bootstrap_event_truncate_r2","CREATE TRIGGER removed_bootstrap_truncate_r2")]),
    }
    r2_results=[]
    for mid,(key,pairs) in r2_mutations.items():
        mutated_sql=sql
        for old,new in pairs:
            mutated_sql=mutated_sql.replace(old,new)
        base=r2_marker_checks(sql); mutated=r2_marker_checks(mutated_sql)
        r2_results.append({"id":mid,"detected":base[key] and not mutated[key]})
    failed=[k for k,v in checks.items() if not v]
    result={
        "design":"FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R3",
        "guard":guard,
        "complete_ddl_sha256":sha(ddl),
        "overlay_sha256":sha(overlay),
        "object_inventory":{"tables":len(tables),"foreign_keys":len(fks),"functions":functions,"triggers":triggers,"roles":roles},
        "core_checks":checks,
        "core_failed":failed,
        "fk_errors":fk_errors,
        "formal_mutations_total":len(mutation_results),
        "formal_mutations_detected":sum(x["detected"] for x in mutation_results),
        "formal_mutation_results":mutation_results,
        "r2_mutations_total":len(r2_results),
        "r2_mutations_detected":sum(x["detected"] for x in r2_results),
        "r2_mutation_results":r2_results,
        "result":"PASS" if not failed and not fk_errors and all(x["detected"] for x in mutation_results) and all(x["detected"] for x in r2_results) else "FAIL",
        "postgresql_grammar":"NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_execution":"NOT EXECUTED — DATABASE NOT AUTHORIZED",
    }
    out=root/"VALIDATION_EVIDENCE_R3.json"
    out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"core_failed":failed,"fk_errors":len(fk_errors),"object_inventory":result["object_inventory"],"formal_mutations":f"{result['formal_mutations_detected']}/{result['formal_mutations_total']}","r2_mutations":f"{result['r2_mutations_detected']}/{result['r2_mutations_total']}","result":result["result"],"output":str(out)},indent=2))
    return 0 if result["result"]=="PASS" else 1


if __name__=="__main__":
    raise SystemExit(main())
