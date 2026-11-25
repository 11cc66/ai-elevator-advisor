# P1 Product Remediation Design R3-C7

Artifact: `P1_PRODUCT_REMEDIATION_DESIGN_R3_C7.md`

Artifact metadata authority: `SHA256SUMS_R3_C7.txt`.

Date: 2026-11-24

## 1. Status

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

R3-C6 P1 corrections: 4/4 DESIGN-ADDRESSED
R3-C6 P2 corrections: 6/6 DESIGN-ADDRESSED
R3-C4 unresolved findings: 5/5 DESIGN-ADDRESSED
R3-C5 unresolved findings: 5/5 DESIGN-ADDRESSED

IMPLEMENTATION AUTHORIZATION: NOT GRANTED
SCHEMA AUTHORIZATION: NOT GRANTED
MIGRATION AUTHORIZATION: NOT GRANTED
DATABASE AUTHORIZATION: NOT GRANTED
RUNTIME AUTHORIZATION: NOT GRANTED
PRODUCTION AUTHORIZATION: NOT GRANTED
GIT WRITES: NONE
```

“Design-addressed” means the exact relationships, DDL, algorithms, static
evidence and execution plan now exist. It is not independent approval and not
database verification.

## 2. Authoritative DDL

The exact PostgreSQL 18 design draft is:

```text
DATABASE_COMPLETE_DDL_R3_C7.sql
```

It defines 46 tables, 8 views, 44 functions and 15 roles. The Markdown documents
explain and classify that DDL; they do not replace it with prose claims.

No statement in the DDL file was executed. PostgreSQL Catalog behavior remains
`NOT VERIFIED` until a separately authorized database phase.

## 3. Ten Required Corrections

| Finding | R3-C7 design correction | Evidence |
|---|---|---|
| `REV-R3-C6-P1-01` | Complete contextual composite FKs from sealed run through candidate, result and Snapshot children | `SELECTION_RESULT_COMPOSITE_FK_DDL_R3_C7.md` |
| `REV-R3-C6-P1-02` | Every referenced Database function now has a body, exact owner, search path and permission | `DATABASE_OBJECT_FUNCTION_INVENTORY_R3_C7.md` |
| `REV-R3-C6-P1-03` | Global epoch -> session -> grant -> business lock order and final recheck | `TRUSTED_SESSION_LOCK_ORDER_AND_CAS_R3_C7.md` |
| `REV-R3-C6-P1-04` | Database-computed policy digest, immutable Revision, append-only Event and effective pointer | `POLICY_CANONICAL_CONTENT_DIGEST_DESIGN_R3_C7.md` |
| `REV-R3-C6-P2-01` | Exact DDL for effective policy, audit, session, authority and Snapshot/selection views | `POLICY_EFFECTIVE_VIEW_AND_AUDIT_VIEW_DDL_R3_C7.md` |
| `REV-R3-C6-P2-02` | Definition/call/grant signatures generated from one exact Registry | `DATABASE_FUNCTION_GRANT_SIGNATURE_MATRIX_R3_C7.md` |
| `REV-R3-C6-P2-03` | Request replay lookup occurs before Stale Sequence rejection | `TrustedSession and Policy transition bodies in the complete DDL` |
| `REV-R3-C6-P2-04` | Record, field, body and complete-Basis limits with 14 executed boundary vectors | `R6_BASIS_RESOURCE_LIMITS_R3_C7.md` |
| `REV-R3-C6-P2-05` | 23 scalar/source-aux vectors executed through Node and Python real entries | `R6_SCALAR_NEGATIVE_VECTOR_EXECUTION_R3_C7.md` |
| `REV-R3-C6-P2-06` | 19 SourceKey cases executed through both real encoders | `SOURCEKEY_REAL_ENCODER_BOUNDARY_EXECUTION_R3_C7.md` |

## 4. Architecture Result

The design preserves the approved module boundaries:

- Web remains a view/API consumer and receives no base-table DML;
- Worker calls controlled Snapshot/selection sealing functions;
- identity broker opens and revokes sessions but does not approve policy;
- a separately authorized security-admin capability revokes AuthorityGrants;
- Policy authors create canonical revisions but cannot self-approve;
- professional reviewers use a separate capability and transition function;
- auditors receive only protected read views;
- deterministic basis construction remains outside AI authority;
- Storage and the private file lifecycle are not changed.

## 5. Provenance Invariant

The shortest authoritative chain is:

```text
requirement_version
  -> sales_case
  -> selection_run
  -> selection_candidate
  -> selection_candidate_price / selection_candidate_parameter
  -> selection_candidate_result
  -> selection_run_seal
  -> sales_handoff_snapshot_r3
  -> snapshot canonical children
```

Context fields are repeated only to support exact composite FKs; they are not
independent authorities. Every repeated tuple references the same parent value.

## 6. Trusted Session Invariant

All sensitive operations:

1. acquire PrincipalEpoch `FOR SHARE`;
2. acquire TrustedSession `FOR SHARE`;
3. acquire the concrete AuthorityGrant `FOR SHARE`;
4. lock the business owner row;
5. perform request-id replay lookup;
6. validate the new request's sequence/CAS;
7. append evidence;
8. update the current-state pointer;
9. recheck Session/Epoch;
10. commit.

Revocation and epoch advancement acquire PrincipalEpoch then TrustedSession
`FOR UPDATE` in that order. This makes the possible orders explicit: a
transition may commit before revocation, or it must observe the newer revoked
state and reject. No event can commit after revocation wins.

## 7. Policy Invariant

The only authoritative policy bytes are the canonical bytes generated inside
`create_policy_revision` from JSONB. The digest includes an algorithm/version
domain separator. Callers cannot submit a digest. Revision rows are immutable;
event rows are append-only; TRUNCATE is denied; effective policy is represented
by an event-bound current pointer and is visible only through an authorized
view.

## 8. Basis Result

Preserved baselines:

```text
SOURCE_KEY_R3 maximum: 362 bytes
R6 BYTES maximum: 512 bytes
C6-SNAP-01: 4036 bytes
C6-SNAP-01 SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

New global bounds:

```text
Record count maximum: 4096
Field count per record: 32
Field count per Snapshot: 65536
Record encoded bytes: 16874
Field encoded bytes: 520
Body bytes: 16777216
Complete Basis bytes: 16777244
```

## 9. Implementation Gate

The next allowed activity is R3-C7 Independent Design Review. Schema,
Migrations, database connection, Storage access, source implementation, Build,
Runtime and production remain unauthorized.
