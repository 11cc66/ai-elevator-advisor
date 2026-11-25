# FULL-MVP-REMEDIATION-DESIGN-R3-C8-CORRECTIONS-R2

## Status

```text
DESIGN COMPLETE — READY FOR INDEPENDENT REVIEW
P1: 3/3 DESIGN-ADDRESSED
P2: 3/3 DESIGN-ADDRESSED
P3: 2/2 DESIGN-ADDRESSED
```

This package is design-only. PostgreSQL compilation, Catalog behavior, Runtime,
Storage, Schema, Prisma, Migration and production are outside this authorization.

## Frozen Layering

```text
Frozen R3-C8 Corrections complete DDL
  -> R3-C8 Corrections R2 Final-State Overlay
  -> R3-C8 Corrections R2 Complete DDL
  -> Function Signature Registry
```

The previous Corrections directories and all earlier Review directories remain
read-only inputs.

## R2 Correction Summary

### Root Principal Binding

The Bootstrap State, immutable Bootstrap Generation record, Root Operator,
Root Session, root Grant, Root Grant mapping and completion Event now share
Principal, Role and Generation identity through composite relationships.
`bootstrap_complete_root_r3` requires:

```text
root operator role = state root role
root operator principal = state root principal
root session principal = state root principal
root grant recipient = state root principal
root grant issuer principal = root session principal
generation = state/lifecycle/approval generation
```

### Owner Privilege Closure

Session Role validation now rejects:

- current database Owner and any database-Owner membership path;
- protected Schema Owner and indirect Owner membership;
- table, partitioned table, view, materialized view, foreign table and sequence
  Owner;
- function/procedure Owner, including SECURITY DEFINER owners;
- protected type/domain Owner;
- direct relation, column, sequence, function, schema and database privileges;
- recursive unexpected membership, INHERIT, SET, ADMIN abuse and incomplete
  owner Catalog results.

The closure digest is captured before a transaction and checked again before
business completion.

### Catalog Source-Target Binding

Product, Specification and Price revisions now carry or verify their exact
Source Revision. An immutable `catalog_source_target_binding_r2` row binds:

```text
Source Revision + Source Evidence + Source Digest
-> Target Kind + exact Product/Specification/Price Revision + Target Digest
-> optional Project scope
```

CatalogReview Events reference that complete binding. The V2 Event digest
covers the binding identity and digest in addition to the source, target,
policy, decision, actor and database time.

### Bootstrap Recovery / Rotation

The lifecycle distinguishes:

```text
SEED_READY
APPROVAL_PENDING
ROOT_ISSUANCE_PENDING
BOOTSTRAP_COMPLETED
RECOVERY_PENDING
RECOVERY_APPROVED
ROOT_ROTATION_PENDING
ROOT_ROTATED
REVOKED
LOCKED
```

No row means `NOT_STARTED`. A request ledger makes a lost response replayable
without creating a second root Grant. Any change of Root Principal or Role
requires two distinct non-root approvals, a new Generation, revocation of old
root authority and a fresh Root Issuance completion.

### Request Ledger Revocation

Ordinary cross-Session replay is allowed only after `NORMAL_CLOSE` or
`NATURAL_EXPIRY`, at the same Principal and current Epoch. Security revocation,
Principal disable, explicit admin revocation, credential rotation and Grant
revocation do not use ordinary replay. A separate two-approver, one-time result
recovery path is required; security-revoked and disabled-Principal results are
permanently non-recoverable.

### Validator

The R2 validator independently checks Root, Owner and Catalog invariants,
performs targeted mutations and fails closed on missing files, Registry or
objects. It does not claim PostgreSQL grammar, Catalog or Runtime validation.

### FieldValue Domains

Requirement source values, Selection copies and Snapshot copies use the same
type, status, unit and scalar-shape validation. Missing/Not Applicable/Conflicted
states require JSON null and no unit. Boolean, text, enum, integer, decimal,
canonical ID, timestamp and bytes payloads each have explicit domains.

### Execution Identity Guard

All R2 tools route through `Invoke-R2GuardedTool.ps1`. It verifies actual
`pwsh.exe`, PowerShell 7.6.9 Core, FileVersion 7.6.9.500, PID, Parent PID,
parent image, working root and Python child relationship. A wrong shell,
unverified parent or output-path escape fails before tool execution.

## Security Protocol Summary

```text
Bootstrap:
  State -> Generation -> Approvals -> Root Operator -> Root Session
  -> Root Grant mapping -> Completion Event -> Recovery/Rotation

Owner Closure:
  Session Role -> all Membership paths -> INHERIT/SET/ADMIN
  -> database/schema/relation/function/type owners -> fail closed

Catalog:
  Source Revision + target revision source FK -> binding digest
  -> Event digest -> Selection row -> Snapshot row

Request:
  Original session termination class -> ordinary replay or controlled recovery
  -> result disclosure audit -> no duplicate business execution
```

## Evidence

Tools and evidence are under `tools/` and `evidence/`. The final manifest records
all output hashes. Static checks never substitute for PostgreSQL compilation.

## Verification Boundary

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
