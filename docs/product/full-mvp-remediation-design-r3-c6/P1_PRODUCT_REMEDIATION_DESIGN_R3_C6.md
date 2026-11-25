# P1 Product Remediation Design R3-C6

Status:

```text
DESIGN COMPLETE WITH OPEN BLOCKERS
IMPLEMENTATION NOT AUTHORIZED
```

## 1. Scope

R3-C6 corrects all P1/P2/P3 findings from the independent R3-C5 review and
preserves all earlier history. It is design-only.

## 2. Version Model

| Concern | Version |
|---|---|
| StableKey | `SK-R2`, registry code 3 |
| Source identity | `SOURCE_KEY_R3`, 362-byte maximum |
| Registry | `SNAPSHOT-R3` |
| Basis | `R3-BASIS-1-R6` |
| Schema | `SNAPSHOT-SCHEMA-R3` |

C5/R2/R5 remains immutable historical evidence.

## 3. Data Chain

```text
SEALED SelectionRun
  -> immutable SelectionCandidateResult
  -> exact Product/Specification/Price revisions
  -> exact Catalog Parameter revision
  -> exact RuleSet revision
  -> SNAPSHOT-R3 canonical rows
  -> R3-BASIS-1-R6
```

## 4. Source Length

Independent calculation:

```text
SOURCE_KEY_R3 maximum = 362 bytes
R6 BYTES maximum = 512 bytes
```

This removes the C5 256-byte contradiction with 150 bytes headroom. Component,
complete-key and generic BYTES limits are separately checked.

See:

- `SOURCE_KEY_R3_BASIS_LENGTH_BUDGET_R3_C6.md`;
- `SOURCE_KEY_R3_MAXIMUM_LENGTH_PROTOCOL_R3_C6.md`.

## 5. Business Provenance

- SelectionRun is sealed before Snapshot creation.
- SelectionCandidateResult is immutable.
- Candidate exact key includes product/revision/digest, specification/revision/
  digest, optional price, run/context and RuleSet.
- Parameter includes immutable CatalogParameterRevision in Registry/Basis.
- Price includes immutable PriceRevision, source Revision, price basis, tax,
  applicability, valid-from/valid-until and quote time.
- RuleSet ID/content digest are Header Basis fields.
- Warning stores `sourceWarningId` and deterministic sequence.

See:

- `SELECTION_RESULT_IMMUTABLE_PROVENANCE_DESIGN_R3_C6.md`;
- `CANDIDATE_PARAMETER_PRICE_REVISION_BINDING_R3_C6.md`;
- `RULESET_REVISION_SNAPSHOT_BASIS_BINDING_R3_C6.md`.

## 6. Snapshot

Registry R3 has ten record types and complete field tags. Header includes
conversation, scenario, sealed run, RuleSet/digest, and `basisAsOf`.

Schema R3 uses:

- exact same-Snapshot FKs;
- exact immutable SelectionResult FKs;
- exact parameter/price/source/review FKs;
- real `mutation_version` CAS;
- immediate finalized-row guards;
- complete deferred commit validation;
- no `ON DELETE CASCADE`.

See:

- `SNAPSHOT_REGISTRY_R3_C6.md`;
- `SNAPSHOT_NORMALIZED_SCHEMA_R3_C6.md`;
- `SNAPSHOT_REGISTRY_SCHEMA_BASIS_CROSSWALK_R3_C6.md`.

## 7. Basis

`C6-SNAP-01` has 15 records:

```text
Basis length: 4036
SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

Node/Python full bytes are identical.

## 8. Trusted Session

The session chain is:

```text
signed broker assertion
  -> random session ID + login epoch
  -> random per-session DB login role
  -> TrustedSession ACTIVE row
  -> transition checks role + session + epoch + expiry + revocation
```

An old open connection is rejected after logout because its TrustedSession row
is no longer ACTIVE or its epoch is stale. Switching callers cannot reuse a
connection.

See:

- `TRUSTED_SESSION_INSTANCE_EPOCH_REVOCATION_DESIGN_R3_C6.md`;
- `DATABASE_VERIFIABLE_SESSION_ASSERTION_DESIGN_R3_C6.md`;
- `TRUSTED_SESSION_THREAT_MODEL_AND_REPLAY_TESTS_R3_C6.md`.

## 9. Policy Lifecycle

`policy_revision` is immutable content/digest. `policy_review_event` is
append-only with:

- event sequence/state version/request uniqueness;
- exact actor principal and authority grant FKs;
- closed state matrix;
- author/approver separation;
- current effective policy view.

ProfessionalReview binds the exact approved policy revision. The previously
passed Event six-column key remains intact, plus the policy-inclusive Review FK.

## 10. PostgreSQL Security

The design includes:

- exact CREATE ROLE role options;
- database/schema ownership and PUBLIC revokes;
- table/view/sequence/function/type grants;
- default privileges for each creating owner;
- non-login owner roles;
- session role membership/SET behavior;
- protected read views with `security_barrier`;
- complete SECURITY DEFINER matrix;
- Event/Policy append-only and TRUNCATE controls.

## 11. Transactions

`create_snapshot_r3`:

1. validates active TrustedSession;
2. locks Case;
3. reads SEALED SelectionRun;
4. materializes immutable provenance rows;
5. derives SourceKey and stableKeys;
6. builds and independently verifies Basis;
7. CASes the real `mutation_version`;
8. deferred triggers revalidate at commit.

No schema or function has been executed.

## 12. Compatibility

R3/R6 is a new version. R2/R5 and R1/R4 evidence is preserved read-only.
Migration creates a new Snapshot only when all new provenance and validity
fields can be recovered; otherwise quarantine.

## 13. Open Decisions

All 46 existing decisions remain open. Five C6 decisions are added and open.

## 14. Input Integrity Exception

All authoritative text/design records and all four manifest self-hashes match.
One generated Python `__pycache__` file under the historical C5 review was
regenerated by an import during independent comparison. The source script and
all authoritative C5 evidence still match. The exception is recorded in
`C6_INPUT_INTEGRITY_EXCEPTION.md`; no recovery or deletion was attempted.

## 15. Authorization

```text
FULL-MVP-REMEDIATION-DESIGN-R3-C6

Overall:
DESIGN COMPLETE WITH OPEN BLOCKERS

R3-C5 P1 corrections: 4/4
R3-C5 P2 corrections: 6/6
R3-C5 P3 correction: 1/1
R3-C4 historical findings: ADDRESSED

SK-R2: PRESERVED
SOURCE_KEY_R3: 362-byte maximum
R3-BASIS-1-R6 BYTES maximum: 512
SNAPSHOT-R3: DESIGNED
Selection provenance: DESIGNED
TrustedSession: DESIGNED
Policy lifecycle: DESIGNED
Deferred DDL: DESIGNED
PostgreSQL privilege matrix: DESIGNED

C6-SNAP-01:
4036 bytes
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB

Node/Python complete bytes: IDENTICAL
Existing Open Decisions: 46 OPEN
C6 Open Decisions: 5 OPEN

IMPLEMENTATION AUTHORIZATION: NOT GRANTED
SCHEMA AUTHORIZATION: NOT GRANTED
MIGRATION AUTHORIZATION: NOT GRANTED
DATABASE AUTHORIZATION: NOT GRANTED
RUNTIME AUTHORIZATION: NOT GRANTED
PRODUCTION AUTHORIZATION: NOT GRANTED
```

