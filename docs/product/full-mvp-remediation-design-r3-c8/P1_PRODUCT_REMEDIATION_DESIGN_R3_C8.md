# P1 Product Remediation Design R3-C8

Artifact: `P1_PRODUCT_REMEDIATION_DESIGN_R3_C8.md`

Date: 2026-11-24

## 1. Status

```text
FULL-MVP-REMEDIATION-DESIGN-R3-C8
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW

R3-C8 P1: 6/6 DESIGN-ADDRESSED
R3-C8 P2: 6/6 DESIGN-ADDRESSED
R3-C8 P3: 1/1 DESIGN-ADDRESSED

IMPLEMENTATION AUTHORIZATION: NOT GRANTED
SCHEMA AUTHORIZATION: NOT GRANTED
MIGRATION AUTHORIZATION: NOT GRANTED
DATABASE AUTHORIZATION: NOT GRANTED
RUNTIME AUTHORIZATION: NOT GRANTED
PRODUCTION AUTHORIZATION: NOT GRANTED
GIT WRITES: NONE
```

“Design-addressed” means the design object, invariant, algorithm, test case and
evidence location exist. It does not mean PostgreSQL compiled the SQL or that a
real Runtime test passed.

## 2. Design Choice

The complete DDL draft is a layered design document:

```text
Frozen R3-C7 baseline
  -> R3-C8 final-state corrections
```

The R3-C8 overlay uses `ALTER` and `CREATE OR REPLACE` deliberately so that the
final object state is unambiguous. It is not a Prisma migration and was not
executed.

## 3. Six P1 Corrections

| Finding | Correction |
|---|---|
| `REV-R3-C7-P1-01` | Snapshot Candidate is bound to the complete SelectionCandidateResult identity through the result row digest and exact composite FK; candidate context fields are copied and checked |
| `REV-R3-C7-P1-02` | RequirementField, Source, CatalogReview, ProfessionalReview, Warning, MissingField, Parameter and Price rows receive source-row digests, exact source-digest FKs, source-content triggers and set-completeness checks |
| `REV-R3-C7-P1-03` | TrustedSession is bound to one session-role registry, activation token, backend PID, backend start time and session-binding GUC; shared/owner roles are rejected |
| `REV-R3-C7-P1-04` | Review function owner, table owner and broker receive the necessary schema/object/USAGE grants; Runtime capabilities remain function/View-only |
| `REV-R3-C7-P1-05` | Controlled functions now create SelectionRun, Candidate, Candidate Price/Parameter, Result, all sealed input rows and ProfessionalReview plus its initial CREATED Event |
| `REV-R3-C7-P1-06` | Session status and audit Views resolve the caller through an active bound Session and Epoch; cross-Principal access requires a subject-scoped `SESSION_AUDIT` grant |

## 4. Data Chain

```text
sales_case
  -> selection_run
  -> selection_candidate
  -> candidate price / parameter
  -> candidate result
  -> sealed selection run
  -> sealed source/evidence rows
  -> snapshot candidate / children
  -> Basis
```

Every immutable source row receives a canonical row digest. Snapshot children
carry the source digest in an FK and verify the copied row payload against that
digest before finalization. Source and Snapshot sets are compared in both
directions with `EXCEPT`. Exact referenced UNIQUE constraints are added for the
product, specification and SelectionRun context keys required by composite FKs;
the price source-digest key includes both candidate and price revision.

## 5. Identity Chain

```text
session-specific DB login role
  -> one-time activation token
  -> TrustedSession backend binding
  -> PrincipalEpoch
  -> session-bound AuthorityGrant
  -> controlled command
```

Activation stores:

- backend PID;
- backend start time;
- one-use activation token digest;
- a session-scoped binding GUC.

Business requests require all of these to match the current backend. A shared
role or copied role credential cannot satisfy a second backend binding.

## 6. Lock Order

All sensitive functions use:

```text
PrincipalEpoch
  -> TrustedSession
  -> AuthorityGrant
  -> business owner row
  -> request ledger / event sequence
```

Revocation and epoch advancement use `FOR UPDATE` in the same order. Every
transition rechecks the active bound session before return, and request replay
lookup precedes stale-sequence rejection.

## 7. Policy Lifecycle

- Canonical content is computed from the database's deterministic JSONB text.
- Digest is calculated inside the trusted function, never caller-supplied.
- Revision UPDATE/DELETE/TRUNCATE is blocked.
- Review Event UPDATE/DELETE/TRUNCATE is blocked.
- Event policy/revision links are checked by trigger and composite FK.
- Current pointer uses `(policy_id,revision_id,effective_event_id)` composite
  relationships.
- Create and seal operations use the Request Ledger for replay.

## 8. Privilege Model

- owner roles are NOLOGIN/NOSUPERUSER/NOBYPASSRLS;
- capability roles are NOLOGIN;
- session login roles are separately provisioned and validated;
- runtime roles cannot DML protected base tables;
- only Views and controlled function EXECUTE grants are exposed to capability
  roles;
- SECURITY DEFINER owners have fixed `pg_catalog`-first search paths;
- PUBLIC receives no protected table, View, function or type usage grant.

## 9. Offline Verification

```text
C6-SNAP-01: 4036 bytes, SHA-256
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB

Node/Python scalar vectors: 23/23 PASS
SourceKey executed examples: PASS
Basis resource vectors: 14/14 PASS
C8 DDL static consistency: PASS

Static text checks:
  Tables: 50
  Functions: 78
  FKs inspected: 64
  Required exact digest FKs: 9
  Table owner assignments: 50
  TRUNCATE-guarded tables: 35
  Function call targets: 32
```

PostgreSQL compilation, Catalog introspection and real concurrency remain
outside this phase.
