# P1 Product Remediation Design R3-C5

Status:

```text
R3-C5 DESIGN COMPLETE
READY FOR INDEPENDENT REVIEW
IMPLEMENTATION NOT AUTHORIZED
```

## 1. Scope

R3-C5 corrects all 11 findings from the independent R3-C4 review without
modifying R3-C4 history or implementing product code.

The established direction remains:

- CUID/Text business IDs;
- typed requirement values;
- event-only ProfessionalReview/RuleSet state;
- snapshot-normalized facts;
- exact ownership FKs;
- P1-3 isolation;
- all business/security/legal decisions remain Open Decisions.

## 2. Version Model

| Concern | Historical | C5 |
|---|---|---|
| Stable-key encoding | implicit colon text in R1 | `SK-R2` binary tuple |
| Snapshot Registry | `SNAPSHOT-R1` | `SNAPSHOT-R2` |
| Basis protocol | `R3-BASIS-1-R4` | `R3-BASIS-1-R5` |
| Normalized schema | R1 | `SNAPSHOT-SCHEMA-R2` |
| Legacy mapping | R1 | R2 clarification |
| Review policy | independent immutable revision | independent immutable revision |

The C5 version change is intentional:

- stableKey changes from text to opaque length-prefixed bytes;
- every Registry field is explicitly present;
- NULL and present-empty are distinct;
- source identity is split into ASCII IDs and UTF-8 auxiliary text;
- full source binding enters the Basis.

## 3. Architecture

```text
authenticated project facts and immutable source revisions
        |
        v
normalized Snapshot rows with exact ownership/source FKs
        |
        v
SK-R2 structured stable keys
        |
        v
SNAPSHOT-R2 field registry
        |
        v
deferred transaction validation
        |
        v
R3-BASIS-1-R5 canonical bytes
        |
        v
independent generator/verifier equality
        |
        v
FINALIZED immutable snapshot + append-only audit
```

ProfessionalReview:

```text
trusted identity-bound DB session
        |
        v
active TrustedPrincipal
        |
        v
active scoped AuthorityGrant
        |
        v
closed command/state matrix
        |
        v
exact immutable PolicyRevision
        |
        v
append-only ProfessionalReviewEvent
```

## 4. Stable Identity

No Snapshot business identity uses colon concatenation. Every stable key is:

```text
SK-R2(registry, recordType, ordered typed components)
```

The complete bytes are stored in `bytea`, included in the Basis and compared
directly. Optional hashes do not replace byte equality. Structured component
columns plus a composite UNIQUE remain the primary relational uniqueness proof.

See `SNAPSHOT_STABLE_KEY_TUPLE_ENCODING_R2.md`.

## 5. Registry

`SNAPSHOT-R2` contains ten record types, `0..9`, including the Header and nine
child types:

```text
Header
Requirement Field
Candidate
Parameter
Price
Source Revision
Catalog Review
Professional Review
Warning
Missing Field
```

All Registry fields have explicit tags, scalar types, nullability, ownership
relationships and normalized destinations. Source binding now includes:

```text
sourceFieldValueId
sourceKind
sourceEntityType
sourceEntityId
sourceAuxId
sourceKey
```

See `SNAPSHOT_REGISTRY_R2.md`.

## 6. Canonical Snapshot Data

Normalized rows are the sole data authority. The schema addresses the C4
missing fields directly:

- Source row has `source_kind`;
- Catalog Review row has `target_revision_id` and `policy_revision_id`;
- Warning row has an integer `warning_sequence`;
- Requirement Field row includes the full structured source binding and
  `source_key`;
- all child-to-Snapshot and candidate-child relationships use composite
  same-Snapshot keys;
- Snapshot metadata and validation rows have exact Snapshot FKs;
- no `ON DELETE CASCADE` is used on finalized facts.

See:

- `SNAPSHOT_NORMALIZED_CHILD_SCHEMA_R2.md`;
- `SNAPSHOT_REGISTRY_SCHEMA_BASIS_CROSSWALK_R2.md`.

## 7. Canonical Basis

`R3-BASIS-1-R5` uses byte stable keys and explicit field presence.

The sole semantic fixture is:

```text
C5_SNAPSHOT_VECTOR_01.json
```

Both independent encoders produce:

```text
records = 15
length = 3051
SHA-256 =
83F00E53B7AC21779B2753F0640B3023E2DE6A53AFA405BC0E4C8A2FDC056FB1
```

Complete bytes and reproduction evidence:

- `C5_SNAPSHOT_VECTOR_01_HEX.md`;
- `C5_SNAPSHOT_VECTOR_01_EXPECTED_RESULT.md`;
- `R3_BASIS_V4_NODE_PYTHON_INDEPENDENT_REPRODUCTION_R3_C5.md`.

## 8. Deferred Validation

The transaction:

1. locks the Case;
2. inserts DRAFT Snapshot and immutable children;
3. derives stable/source keys from structured fields;
4. computes and independently verifies Basis;
5. runs final-state validation;
6. CASes `DRAFT -> FINALIZED`;
7. commits;
8. deferred constraint triggers repeat validation against final transaction
   state.

Constraint triggers cover `INSERT/UPDATE/DELETE` on child rows. `TRUNCATE` is
denied through privilege and a separate statement trigger because PostgreSQL
constraint triggers do not cover it.

See `SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R2.md`.

## 9. Trusted Actor and Authority

The caller no longer supplies actor ID or target state. The database uses
`session_user` from a principal-bound, identity-broker-controlled login, maps it
to one active TrustedPrincipal, resolves a scoped active AuthorityGrant, and
derives the next state from a closed command matrix.

Reviewer/policy-author separation and self-approval denial are explicit.
Replay/idempotency, sequence CAS, authority revocation, policy equality and
commit failure are defined.

See `TRUSTED_PRINCIPAL_AUTHORITY_TRANSITION_DESIGN_R2.md`.

## 10. ProfessionalReview Ownership

The previously passed exact key is preserved:

```text
Event UNIQUE(
  id, project_id, conversation_id, requirement_id,
  requirement_version_id, installation_scenario)
```

FieldValue and Assertion both continue to use that exact six-column Event key:

```text
(source_professional_review_event_id, project_id, conversation_id,
 requirement_id, requirement_version_id, installation_scenario)
-> Event(
  id, project_id, conversation_id,
  requirement_id, requirement_version_id, installation_scenario)
```

The source Event ID is nullable only for non-professional source kinds. The
retained source-kind CHECK requires it non-null when
`sourceKind='PROFESSIONAL_REVIEW'`, so `MATCH SIMPLE` cannot bypass the source
relation.

Policy equality is closed by an additional unique Review key and Event FK:

```text
Review UNIQUE(
  id, policy_revision_id, project_id, conversation_id,
  requirement_id, requirement_version_id, installation_scenario)

Event FK(
  review_id, policy_revision_id, project_id, conversation_id,
  requirement_id, requirement_version_id, installation_scenario)
-> Review(same columns)
```

Event `policy_revision_id` also references the immutable policy revision.

## 11. PostgreSQL Privileges

The baseline separates:

```text
database owner / schema owner / table owner / function owner
migration / web runtime / worker runtime
trusted principal / reviewer / policy author / policy reviewer
auditor / reporting
```

Owner roles are non-login and non-inheritable by runtime. Schema, tables,
sequences, views, types, default privileges, function ownership, PUBLIC
revokes, SECURITY DEFINER, trigger execute and TRUNCATE are specified.

See `EVENT_ONLY_POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R2.md`.

## 12. Failure and Concurrency

- incomplete Snapshot commit -> validation failure and rollback;
- concurrent finalization -> one row-lock/CAS winner;
- child mutation during finalization -> validation failure or final immutability;
- source withdrawal race -> exact read lock or fail closed;
- duplicate transition request -> prior immutable result or stable conflict;
- stale sequence/policy/authority -> conflict/authorization failure;
- commit unknown -> re-read by durable request/sequence identity;
- only `40001`/`40P01` are eligible for bounded retries.

## 13. Compatibility Matrix

| Old | New | Compatible | Migration |
|---|---|---|---|
| R1 colon stableKey | SK-R2 | no identity equivalence assumed | new R2 snapshot; quarantine if structured tuple cannot be recovered |
| SNAPSHOT-R1 | SNAPSHOT-R2 | read-only historical | preserve old Basis verbatim |
| R3-BASIS-1-R4 | R3-BASIS-1-R5 | not wire-equivalent | new R5 Basis |
| Snapshot Schema R1 | R2 | no in-place mutation of finalized data | forward migration before any implementation |
| Legacy JSON Mapping R1 | R2 | yes with normalized equivalence | raw JSON retained; ambiguous values quarantine |
| Policy Pn | Pn+1 | per `OD-R3-04` | no automatic carryover unless approved |

No existing historical Basis is rewritten. No R1/R4 implementation/data is
claimed to exist or approved.

## 14. P1-3 Boundary

This design does not modify:

- Upload Intent/Attempt;
- Lifecycle or FileVersion;
- Operation Attempts;
- P1-3 migrations/triggers;
- Storage capability or filesystem operations.

Catalog evidence is referenced only through existing approved design
boundaries. Actual archive/Storage access remains blocked and out of scope.

## 15. Open Decisions

All 41 historical Open Decisions remain open. C5 adds decisions for:

- trusted identity broker/session mechanism;
- Registry R2/Basis R5 rollout;
- source key persistence/generated-column deployment;
- reviewer/approver policy;
- break-glass database administration.

See `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS_R3_C5.md`.

## 16. Completion Criteria

```text
C4 P1 corrections addressed: 4/4
C4 P2 corrections addressed: 6/6
C4 P3 addressed: 1/1
Stable-key collision proof: DESIGN + FIXED VECTORS
Registry/Schema/Basis crosswalk: COMPLETE DESIGN
Deferred trigger DDL: COMPLETE DESIGN
Trusted actor chain: COMPLETE DESIGN WITH DEPLOYMENT OD
Privilege baseline: COMPLETE DESIGN
Node/Python full bytes: IDENTICAL
Historical Open Decisions: 41 RETAINED
```

```text
IMPLEMENTATION AUTHORIZATION: NOT GRANTED
SCHEMA AUTHORIZATION: NOT GRANTED
MIGRATION AUTHORIZATION: NOT GRANTED
DATABASE AUTHORIZATION: NOT GRANTED
RUNTIME AUTHORIZATION: NOT GRANTED
PRODUCTION AUTHORIZATION: NOT GRANTED
```

