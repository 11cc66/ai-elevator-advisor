# P1 Product Remediation Open Decisions R3-C5

Status:

```text
41 HISTORICAL DECISIONS RETAINED AND OPEN
5 C5 DECISIONS ADDED AND OPEN
NO POLICY OR IMPLEMENTATION APPROVAL
```

## 1. Historical Decisions

The following IDs are preserved without approval:

```text
OD-R2-01 OD-R2-02 OD-R2-03 OD-R2-04 OD-R2-05
OD-R2-06 OD-R2-07 OD-R2-08 OD-R2-09 OD-R2-10
OD-R2-11 OD-R2-12 OD-R2-13 OD-R2-14 OD-R2-15
OD-R2-16 OD-R2-17 OD-R2-18 OD-R2-19 OD-R2-20

OD-R3-01 OD-R3-02 OD-R3-03 OD-R3-04 OD-R3-05
OD-R3-06 OD-R3-07 OD-R3-08 OD-R3-09

OD-R3-C2-01 OD-R3-C2-02 OD-R3-C2-03 OD-R3-C2-04
OD-R3-C3-01 OD-R3-C3-02 OD-R3-C3-03 OD-R3-C3-04
OD-R3-C4-01 OD-R3-C4-02 OD-R3-C4-03 OD-R3-C4-04
```

| Family | Count | C5 status |
|---|---:|---|
| R2 business/security/rollout | 20 | OPEN |
| R3 archive/review/evidence | 9 | OPEN |
| R3-C2 database/archive/vector authority | 4 | OPEN |
| R3-C3 identity/catalogue/transition/archive | 4 | OPEN |
| R3-C4 registry/catalogue/event/Rollout | 4 | OPEN |
| Total historical | 41 | OPEN |

No design change in C5 is an explicit user/security approval of these items.

## 2. New C5 Decisions

### OD-R3-C5-01 — Trusted identity broker and database session binding

- Question: Which identity broker, authentication mechanism, audience,
  expiration, revocation, replay protection, per-principal login role and
  connection-pool topology will bind `session_user` to an active
  TrustedPrincipal?
- Owner: security architecture, database platform, identity/operations.
- Blocks: Review transition function, Policy approval, production.
- Can proceed: static DDL, threat matrix, fake-principal unit tests.
- Must decide before Schema/Migration: yes for principal/session tables and
  non-login role provisioning.

### OD-R3-C5-02 — SNAPSHOT-R2 / R3-BASIS-1-R5 rollout

- Question: Which snapshot/schema/protocol migration window permits R2/R5 while
  preserving R1/R4 history?
- Owner: product architecture, security, database owner.
- Blocks: Snapshot implementation, historical migration, production.
- Can proceed: fixtures, schema review, static version tests.
- Must decide before any Snapshot migration: yes.

### OD-R3-C5-03 — SourceKey R3 storage derivation

- Question: Is `source_key bytea` stored with a CHECK against an IMMUTABLE
  function, or generated as a stored column, or reconstructed only in the
  Basis builder?
- Owner: database platform and security.
- Blocks: source binding DDL and data backfill.
- Can proceed: fixture derivation and crosswalk review.
- Must decide before source-key DDL: yes.

### OD-R3-C5-04 — Reviewer/approver separation policy

- Question: Is one professional approver sufficient, or is dual engineering /
  technical-lead approval mandatory for every scenario or selected fields?
- Owner: elevator technical authority/product/security.
- Blocks: authority matrix, review workflow, formal Operational.
- Can proceed: general self-approval denial and matrix tests.
- Must decide before professional review implementation: yes.

### OD-R3-C5-05 — Database owner break-glass and reauthentication

- Question: How do controlled DB owner/admin sessions reauthenticate, notify
  security, expire, and produce evidence without becoming routine business
  actors?
- Owner: database platform, security operations and compliance.
- Blocks: privileged deployment, emergency operations, production.
- Can proceed: privilege baseline and denial tests.
- Must decide before establishing production roles: yes.

## 3. Decision Effects

| Decision | Technical design | Policy/security approval | Schema | Import | Demo/Prod |
|---|---|---|---|---|---|
| C5-01 identity broker | COMPLETE DESIGN | REQUIRED | BLOCKED until approval | n/a | BLOCKED |
| C5-02 R2/R5 rollout | COMPLETE DESIGN | REQUIRED | BLOCKED | BLOCKED for legacy | BLOCKED |
| C5-03 source_key storage | OPTIONS DEFINED | REQUIRED | BLOCKED | BLOCKED | BLOCKED |
| C5-04 approval separation | MATRIX DEFINED | REQUIRED | workflow blocked | review data blocked | BLOCKED |
| C5-05 break-glass | DESIGN DIRECTION | REQUIRED | admin setup blocked | n/a | BLOCKED |

## 4. Historical Gates Not Closed by C5

- typed field/unit authority;
- source archive/retention and verifier;
- price semantics;
- legacy import/quarantine disposition;
- professional workflow authority;
- snapshot export/deletion/retention;
- event owner/role provisioning;
- all formal Operational and production approval.

## 5. No Waiver

An Open Decision cannot waive:

- `SK-R2` tuple identity;
- exact `SNAPSHOT-R2` field mapping;
- `R3-BASIS-1-R5` bytes;
- exact composite FKs;
- commit-time validation;
- trusted actor/authority binding;
- Event/Snapshot append-only and immutability;
- P1-3 isolation.

## 6. Gate

```text
Historical decisions: 41 OPEN
New C5 decisions: 5 OPEN
Design readiness: INDEPENDENT REVIEW REQUIRED
Implementation authorization: NOT GRANTED
Database authorization: NOT GRANTED
Runtime authorization: NOT GRANTED
```

