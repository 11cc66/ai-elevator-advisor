"""Independent static audit of R3-C8 Corrections R3."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from review_guard import require_guard


EXPECTED_MANIFEST = "C5611B8807D50E3E02286A63B5C9E39F9F745684793C2FD5525DCA4537A71825"
EXPECTED_KEYS = {
    "P1_PRODUCT_REMEDIATION_DESIGN_R3_C8_CORRECTIONS_R3.md":
        "D7D96DEEDDB4AC3BE7E25ED72ADBC00DA878A7F3685F8B2E6CD4B267C60C4F0F",
    "DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql":
        "C899D5F7C433F6936617033E76161FB0D33ACED85B6CFF004073FB0B012C67ED",
    "DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS_R3.sql":
        "8EC1CE0F6174225629F1A8EDD88CF7CDB77C0D296F6E3002C9418D5D655E4CEB",
    "DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R3.json":
        "CC08248DABE2B4301D05A3D14F93374F0E6913F572F6A0FB24A1EC584874A56E",
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def n(v: str) -> str:
    return re.sub(r"\s+", " ", v.strip().lower())


def cols(v: str):
    return tuple(n(x) for x in v.split(",") if x.strip())


def manifest_check(root: Path, manifest: Path):
    repo = root.parents[2]
    prefix = root.relative_to(repo).as_posix() + "/"
    rows = manifest.read_text(encoding="utf-8").splitlines()
    errors, listed = [], []
    for row in rows:
        m = re.fullmatch(r"([0-9A-F]{64}) (\d+) (\d+) (.+)", row)
        if not m:
            errors.append("format")
            continue
        if not m.group(4).startswith(prefix):
            errors.append("path")
            continue
        rel = m.group(4)[len(prefix):]
        listed.append(rel)
        path = root / rel
        if not path.is_file():
            errors.append("missing:" + rel)
            continue
        payload = path.read_bytes()
        if hashlib.sha256(payload).hexdigest().upper() != m.group(1):
            errors.append("hash:" + rel)
        if len(payload) != int(m.group(2)):
            errors.append("bytes:" + rel)
        if len(payload.decode("utf-8").splitlines()) != int(m.group(3)):
            errors.append("lines:" + rel)
    actual = sorted(
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file() and p != manifest
    )
    return {
        "records": len(rows),
        "unique": len(set(listed)),
        "actual_including_manifest": len(actual) + 1,
        "coverage_differences": sorted(set(listed) ^ set(actual)),
        "errors": errors,
    }


def objects(sql: str):
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
        for c in re.finditer(r"^\s*([a-z_][a-z0-9_]*)\s+[^,\n]*\bPRIMARY\s+KEY\b",body,re.I|re.M):
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


def main() -> int:
    guard=require_guard(Path(__file__).resolve().parents[1])
    review=Path(__file__).resolve().parents[1]
    repo=review.parents[2]
    r3=repo/"docs/product/full-mvp-remediation-design-r3-c8-corrections-r3"
    manifest=r3/"SHA256SUMS_R3_C8_CORRECTIONS_R3.txt"
    ddl_path=r3/"DATABASE_COMPLETE_DDL_DESIGN_R3_C8_CORRECTIONS_R3.sql"
    registry_path=r3/"DATABASE_FUNCTION_SIGNATURE_REGISTRY_R3_C8_CORRECTIONS_R3.json"
    sql=ddl_path.read_text(encoding="utf-8")
    b=n(sql)
    mf=manifest_check(r3,manifest)
    key_hashes={x:sha(r3/x) for x in EXPECTED_KEYS}
    tables,keys,fks=objects(sql)
    fk_errors=[]
    for s,sc,t,tc in fks:
        if len(sc)!=len(tc): fk_errors.append({"source":s,"reason":"arity"})
        if s not in tables or any(c not in tables[s] for c in sc):
            fk_errors.append({"source":s,"reason":"source_column"})
        if t not in tables: fk_errors.append({"source":s,"target":t,"reason":"target_table"})
        elif tc not in keys.get(t,set()): fk_errors.append({"source":s,"target":t,"reason":"target_key"})
    def body(name: str) -> str:
        p=sql.rfind(f"CREATE OR REPLACE FUNCTION {name}")
        if p<0: p=sql.rfind(f"CREATE FUNCTION {name}")
        nxt=sql.find("\nCREATE ",p+10)
        return sql[p:len(sql) if nxt<0 else nxt]
    approve=body("app.bootstrap_approve_root_change_r2")
    execute=body("app.bootstrap_execute_root_change_r2")
    expiry_rollback = (
        "clock_timestamp()>=rr.approval_expires_at" in approve
        and "SET state='LOCKED'" in approve and "RAISE EXCEPTION" in approve
    ) and (
        "clock_timestamp()>=rr.approval_expires_at" in execute
        and "SET state='LOCKED'" in execute and "RAISE EXCEPTION" in execute
    )
    candidate_not_null = (
        "ADD COLUMN candidate_id text" in sql
        and "candidate_id SET NOT NULL" in sql
    )
    last_function=max(
        (sql.count("\n",0,m.start())+1 for m in re.finditer(
            r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+app",sql,re.I))
    )
    final_revoke=sql.rfind("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC")
    final_revoke_line=sql.count("\n",0,final_revoke)+1 if final_revoke>=0 else 0
    registry=json.loads(registry_path.read_text(encoding="utf-8"))
    submitted_validation=json.loads(
        (r3/"VALIDATION_EVIDENCE_R3.json").read_text(encoding="utf-8")
    )
    result={
        "guard":guard,
        "manifest":mf,
        "manifest_hash":sha(manifest),
        "key_hashes":key_hashes,
        "key_hashes_match":key_hashes==EXPECTED_KEYS,
        "objects":{
            "tables":len(tables),"foreign_keys":len(fks),
            "unique_function_names":len(set(re.findall(
                r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(app(?:_private)?\.[a-z_][a-z0-9_]*)",
                sql,re.I))),
            "triggers":len(re.findall(r"CREATE\s+(?:CONSTRAINT\s+)?TRIGGER",sql,re.I)),
            "roles":len(set(re.findall(r"CREATE\s+ROLE\s+([a-z_][a-z0-9_]*)",sql,re.I))),
        },
        "registry":{
            "signature_count":registry.get("function_count"),
            "missing_owners":registry.get("missing_owners"),
            "unresolved_calls":registry.get("unresolved_call_targets"),
        },
        "submitted_validation":{
            "result":submitted_validation.get("result"),
            "formal_mutations_detected":submitted_validation.get("formal_mutations_detected"),
            "formal_mutations_total":submitted_validation.get("formal_mutations_total"),
            "r2_mutations_detected":submitted_validation.get("r2_mutations_detected"),
            "r2_mutations_total":submitted_validation.get("r2_mutations_total"),
        },
        "fk_errors":fk_errors,
        "checks":{
            "bootstrap_history_immutable":
                "bootstrap_root_session_generation_history_fk_r3" in b
                and "bootstrap_approval_generation_identity_fk_r3" in b,
            "bootstrap_lifecycle_deferrable":
                "bootstrap_lifecycle_generation_fk_r3" in b,
            "issuance_attempt":"bootstrap_issuance_attempt_r3" in b,
            "approval_expiry_defined":"approval_expires_at" in b,
            "approval_expiry_persists_state":not expiry_rollback,
            "catalog_source_pk":"foreign key (source_revision_id) references app.catalog_source_revision(id)" in b,
            "catalog_event_binding_pk":"foreign key (source_target_binding_id) references app.catalog_source_target_binding_r2(id)" in b,
            "catalog_binding_triggers":
                "a_bind_catalog_source_evidence_r3" in b
                and "a_bind_catalog_event_binding_r3" in b,
            "professional_candidate_columns":sql.count("ADD COLUMN candidate_id text")>=2,
            "professional_candidate_not_null":candidate_not_null,
            "professional_candidate_triggers":
                "a_bind_professional_candidate_r3" in b
                and "a_bind_snapshot_professional_candidate_r3" in b,
            "final_public_revoke_after_functions":final_revoke_line>last_function,
            "owner_advisory_lock":"pg_advisory_xact_lock" in b,
            "owner_validation_uses_r3":
                "PERFORM app_private.assert_protected_owner_closure_r3(p_role_name)" in sql,
            "root_active_recheck":"root principal is not active" in b,
            "recovery_single_request":
                "command_result_recovery_single_request_r3" in b,
            "result_recovery_replay_first":
                n(approve).find("claim_command_request")<n(approve).find("rr.state<>'pending'"),
            "catalog_actor_grant_fk":"catalog_binding_actor_grant_fk_r3" in b,
        },
        "postgresql_grammar":"NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER",
        "postgresql_compilation":"NOT VERIFIED — DATABASE NOT AUTHORIZED",
        "runtime":"NOT EXECUTED",
    }
    result["failed_checks"]=[k for k,v in result["checks"].items() if not v]
    out=review/"VALIDATION_EVIDENCE_REVIEW_R3.json"
    out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({
        "manifest_ok":not mf["errors"] and not mf["coverage_differences"],
        "key_hashes_match":result["key_hashes_match"],
        "objects":result["objects"],
        "fk_errors":len(fk_errors),
        "failed_checks":result["failed_checks"],
        "output":str(out),
    },indent=2))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
