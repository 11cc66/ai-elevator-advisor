# FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R3

## Status

```text
DESIGN COMPLETE — READY FOR SEPARATE INDEPENDENT REVIEW
P1: 3/3 DESIGN-ADDRESSED
P2: 6/6 DESIGN-ADDRESSED
P3: 2/2 DESIGN-ADDRESSED
```

This is a design and offline-verification package only. It does not authorize
SQL execution, database access, Schema, Migration, Runtime or production.

## Frozen Input and Transformation

The complete R3 DDL is generated from:

```text
verified R2 complete DDL
  -> deterministic removal/replacement of five invalid R2 FK structures
  -> R3 final-state Overlay
```

The generator fails if any transformation target is absent or appears more than
once. R2 remains immutable.

## Corrections

### Bootstrap

- Historical Approvals and Root Sessions reference immutable
  `bootstrap_generation_r2`, not mutable Lifecycle.
- Root Session history uses the actual `session_id` column.
- Lifecycle-to-State Generation FK is deferrable across the generation update.
- `bootstrap_issuance_attempt_r3` records every Generation issuance attempt.
- root recovery has approval expiry, deny, failed-issuance lock and new-recovery
  paths.
- Request Ledger replay occurs before terminal state/Génération checks.
- Root and Approver Principals are rechecked ACTIVE under lock.

### Catalog

- Binding references `catalog_source_revision(id)`, the actual PK.
- Source evidence and digest are copied and checked by an immutable trigger.
- Event references `catalog_source_target_binding_r2(id)`.
- Event target/source fields are copied and checked by trigger before digest.
- ProfessionalReview source tables gain `candidate_id`, populated from the
  authoritative Review Event.

### Function ACL

After every R2/R3 function is created, both schemas execute final PUBLIC
REVOKE statements. Role-specific grants are applied afterward.

### Result Recovery

- One recovery record is allowed per original Request.
- Approval and execution replay are evaluated before terminal state.
- Recovery remains a separate two-approver, one-time operation.

### Owner Closure

- a transaction advisory lock is acquired before the R2 Owner checks;
- the same key is reserved for approved role/Owner changes;
- Principal/owner change race windows are documented.

### P3

- state/timestamp consistency CHECKs are added;
- R3 Guard records child exit code and completion time.

## Required Boundaries

```text
PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Database: NOT ACCESSED
Storage: NOT ACCESSED
Runtime: NOT EXECUTED
Production: NOT AUTHORIZED
Git Writes: NONE
```

## Open Decisions

```text
Original IDs: 57
Present and unique: 57/57
Approved by User: 0
Still OPEN: 57
```

Root recovery ownership, credential custody, emergency authority, role
provisioning, break-glass, price policy and evidence retention remain OPEN.

