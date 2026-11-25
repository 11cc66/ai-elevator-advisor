# P1 Product Remediation Traceability R3-C8

## C7 Finding to C8 Correction

| C7 Finding | Root Cause | C8 Design Correction | Evidence |
|---|---|---|---|
| `REV-R3-C7-P1-01` | Snapshot Candidate used only result/candidate/run IDs | Candidate now copies full context, revision and status fields; result row digest and exact composite FK bind the complete result | `DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql`, `SNAPSHOT_PROVENANCE_AND_COMPLETENESS_R3_C8.md` |
| `REV-R3-C7-P1-02` | Child rows were ID-only and finality checked only candidates | Source-row digests, child digest triggers, directional `EXCEPT` completeness and immutable source guards | Snapshot provenance document; DDL digest/completeness functions |
| `REV-R3-C7-P1-03` | Session accepted shared roles and was not connection-bound | Session-role registry, one-use activation token, backend PID/start binding, session GUC, owner/scoped capability checks | Trusted session protocol |
| `REV-R3-C7-P1-04` | Owner/broker lacked schema and object privileges | Explicit schema USAGE, review-owner table DML, enum USAGE, function/View grants and no runtime base-table DML | Role matrix; DDL grant section |
| `REV-R3-C7-P1-05` | No creation path for selection or professional review | Controlled create APIs for run, candidate, price, parameter, result, requirement/source/review/warning/missing records and professional review initial event | DDL creation functions; acceptance matrix |
| `REV-R3-C7-P1-06` | Session status View checked target grant, not caller | Active bound caller context and subject-scoped `SESSION_AUDIT` checks; status and audit Views separated | DDL View section |
| `REV-R3-C7-P2-01` | SQL/Node/Python encoder divergence | SQL exact header type map, StableKey arity and Decimal 18-digit precision | DDL R6 functions; independent R6 evidence |
| `REV-R3-C7-P2-02` | NFD accepted by JS/Python but rejected by SQL | SQL now normalizes source auxiliary text to NFC before encoding; source fields require NFC storage | `source_key_r3` and source constraints |
| `REV-R3-C7-P2-03` | Create/seal lacked request idempotency | Command Request Ledger with request hash, scope, principal/session and result replay | Policy/idempotency document |
| `REV-R3-C7-P2-04` | AuthorityGrant was not session-bound and scope selection was ambiguous | Grant recipient and audit subject are separate; Session-bound grants declare exact `GLOBAL`/`PROJECT`/`POLICY`/`PRINCIPAL` scope; lock and View paths use the same matching rule | DDL authority grant, `issue_authority_grant`, `lock_authority_grant`, and `has_current_authority` |
| `REV-R3-C7-P2-05` | Text statuses and pointer relations underconstrained | State CHECK constraints, policy pointer composite FKs and policy Event link guard | DDL constraints/triggers |
| `REV-R3-C7-P2-06` | Selection state lacked complete TRUNCATE protection | TRUNCATE guards for all selection source/result/seal and policy pointer tables | DDL trigger section |
| `REV-R3-C7-P3-01` | Duplicate `v_content` assignment | C8 creates the canonical content directly once | `create_policy_revision` body |

## Findings Mapping

```text
REV-R3-C7-P1-01 -> REV-R3-C8-P1-01 DESIGN-ADDRESSED
REV-R3-C7-P1-02 -> REV-R3-C8-P1-02 DESIGN-ADDRESSED
REV-R3-C7-P1-03 -> REV-R3-C8-P1-03 DESIGN-ADDRESSED
REV-R3-C7-P1-04 -> REV-R3-C8-P1-04 DESIGN-ADDRESSED
REV-R3-C7-P1-05 -> REV-R3-C8-P1-05 DESIGN-ADDRESSED
REV-R3-C7-P1-06 -> REV-R3-C8-P1-06 DESIGN-ADDRESSED

REV-R3-C7-P2-01 -> REV-R3-C8-P2-01 DESIGN-ADDRESSED
REV-R3-C7-P2-02 -> REV-R3-C8-P2-02 DESIGN-ADDRESSED
REV-R3-C7-P2-03 -> REV-R3-C8-P2-03 DESIGN-ADDRESSED
REV-R3-C7-P2-04 -> REV-R3-C8-P2-04 DESIGN-ADDRESSED
REV-R3-C7-P2-05 -> REV-R3-C8-P2-05 DESIGN-ADDRESSED
REV-R3-C7-P2-06 -> REV-R3-C8-P2-06 DESIGN-ADDRESSED
REV-R3-C7-P3-01 -> REV-R3-C8-P3-01 DESIGN-ADDRESSED
```

Final independent review status remains `PENDING`.
