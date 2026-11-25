# P1 Product Remediation Open Decisions R3-C4

Status:

```text
OPEN DECISIONS RETAINED
NO IMPLEMENTATION APPROVAL
```

## 1. C4 Decision Additions

### OD-R3-C4-01 — Snapshot Registry R1 approval

- Question: Does product/security approve the R1 record/field registry and the
  actual Snapshot Basis coverage?
- Owner: product architecture, security and database owner.
- Choices: accept R1; revise registry; postpone registry-dependent Snapshot.
- Blocks: Block Schema, Migration, Snapshot UI and production.
- Can proceed: generic framing tests and registry review.
- Must decide before Snapshot schema: yes.

### OD-R3-C4-02 — Typed catalogue authority and engineering units

- Question: Which field units, ranges, enums and scenario-specific catalogue
  values are authoritative?
- Owner: elevator technical authority/product/security.
- Blocks: Block Schema, Migration, Data Import and production.
- Can proceed: type-independent validation/quarantine.
- Must decide before typed field activation: yes.

### OD-R3-C4-03 — Event transition role and function owner

- Question: Which exact deployment roles own, execute and audit RuleSet and
  ProfessionalReview transition functions, and who authors/approves policy?
- Owner: database platform/security.
- Choices: SECURITY DEFINER with fixed search path; invoker with least
  privilege; an equivalent isolated transition service.
- Blocks: Block Schema, Security Approval and production.
- Can proceed: DDL relationship, event-only tests and role matrix.
- Must decide before function creation: yes.

### OD-R3-C4-04 — Snapshot registry/version rollout

- Question: How are `SNAPSHOT-R1` and future registry revisions introduced,
  retained and re-verified for old Snapshots?
- Owner: product/security/database owner.
- Choices: immutable registry per snapshot; registry migration with dual
  read; read-only archive of retired registry.
- Blocks: Block Migration, Data Import and production.
- Can proceed: R1 fixtures and versioned read tests.
- Must decide before production: yes.

## 2. Retained Historical Decisions

| IDs | Status | Blocked capabilities |
|---|---|---|
| `OD-R2-01`–`OD-R2-20` | RETAINED | rules, professional authority, price, scenario/head, sales, Demo, rollout |
| `OD-R3-01`–`OD-R3-09` | RETAINED | archive, evidence, professional workflow, policy continuity, snapshot/evidence recovery |
| `OD-R3-C2-01`–`OD-R3-C2-04` | RETAINED | typed catalogue, archive verifier, transition ownership, basis implementation |
| `OD-R3-C3-01`–`OD-R3-C3-04` | RETAINED | CUID/Text approval, typed catalogue, transition owner, archive |

## 3. Decision Matrix

```text
Snapshot registry R1 approval: UNRESOLVED
Typed field/unit authority: UNRESOLVED
Event function ownership/grants: UNRESOLVED
Archive verifier/ACL/retention: UNRESOLVED
Policy/role continuity: UNRESOLVED
Legacy data import disposition: UNRESOLVED
Formal rollout: UNRESOLVED

Exact FK/registry/protocol mechanics: DESIGNED
Implementation authorization: NOT GRANTED
```

Open Decisions cannot waive:

- exact UNIQUE/FK sets;
- Registry R1 completeness;
- sourceKey structured ownership;
- Event-only append rules;
- canonical Basis bytes;
- P1-3 isolation.
