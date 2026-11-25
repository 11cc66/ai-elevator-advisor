# P1 Product Remediation Open Decisions R3-C6

Status:

```text
46 EXISTING DECISIONS RETAINED AND OPEN
5 C6 DECISIONS ADDED AND OPEN
```

## 1. Existing Decisions

Preserved without approval:

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
OD-R3-C5-01 OD-R3-C5-02 OD-R3-C5-03 OD-R3-C5-04 OD-R3-C5-05
```

Count: 46. No ID is renumbered, deleted or approved.

## 2. New C6 Decisions

### OD-R3-C6-01 — Session assertion and broker mechanism

- Choose issuer, signing algorithm, key custody/rotation, audience, nonce cache,
  session role authentication and HA behavior.
- Owner: security architecture/identity/platform.
- Blocks session and transition implementation.

### OD-R3-C6-02 — Registry R3 / Basis R6 rollout

- Approve SNAPSHOT-R3, R3-BASIS-1-R6, R3/R6 migration and coexistence with
  historical R2/R5.
- Owner: product/security/database architecture.
- Blocks Snapshot implementation and migration.

### OD-R3-C6-03 — Price provenance and validity policy

- Approve price basis/scope semantics, validity policy, historical-vs-current
  price behavior, timezone and open-ended validity.
- Owner: commercial/product/security.
- Blocks Price schema/import/formal quotation.

### OD-R3-C6-04 — Session role provisioning and connection topology

- Approve whether each session uses a unique DB login role/credential and
  whether login always invalidates previous epochs.
- Owner: database platform/security/operations.
- Blocks production session deployment.

### OD-R3-C6-05 — Policy approval split and effective-policy process

- Approve policy author/approver roles, dual approval requirements, validity,
  supersession and emergency invalidation.
- Owner: technical authority/security.
- Blocks PolicyEvent implementation.

## 3. State

```text
Existing approved: 0
Existing open: 46
C6 approved: 0
C6 open: 5
```

No Open Decision waives source identity, provenance FKs, Session validation,
Policy events, Basis bytes, deferred validation or runtime gates.

