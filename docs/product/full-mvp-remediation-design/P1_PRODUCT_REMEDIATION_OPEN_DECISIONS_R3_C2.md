# P1 Product Remediation Open Decisions R3-C2

Status:

```text
OPEN DECISIONS RETAINED
NO BUSINESS, ENGINEERING, LEGAL OR SECURITY APPROVAL IMPLIED
```

R3-C2 preserves all R2 and R3 decisions. New C2 decisions are only for
implementation authority and policy questions not answerable by Codex.

## 1. New R3-C2 Decisions

### OD-R3-C2-01 — Authoritative typed field catalogue and units

- Question: Which exact field types, decimal precision/scale, units, ranges,
  enum codes and composite field shapes are authoritative for Requirement
  Assertion/FieldValue?
- Owner: elevator technical authority, product owner and security.
- Choices:
  1. a minimal scalar catalogue for the current MVP;
  2. a broader typed catalogue including date/time and lists;
  3. scenario-specific catalogues with separate approval.
- Risk: accepting arbitrary types or using JSON as a hidden escape weakens the
  typed fact model.
- Blocks: typed value DDL and parser schema.
- Can proceed: scalar encoding fixtures and rejection tests.
- Must decide before Schema/Migration: yes.

### OD-R3-C2-02 — Catalog evidence verifier identity and archive ownership

- Question: Which independent role/process owns archive capture and
  verification, and what ACL prevents catalog admins from overwriting evidence
  or forging verification events?
- Owner: security and platform owner.
- Choices:
  1. separate evidence verifier service identity with write-once archive;
  2. catalog-domain service with independent DB owner and verification role;
  3. externally signed evidence service plus internal acceptance.
- Risk: the same service that edits catalog records cannot be the sole verifier
  of its own evidence.
- Blocks: archive adapter, verification events and formal catalog trust.
- Can proceed: interface and role matrix.
- Must decide before archive implementation: yes.

### OD-R3-C2-03 — Database transition-function ownership

- Question: Who owns/deploys and grants execute rights to RuleSet and
  ProfessionalReview transition functions, and what fixed `search_path` and
  role separation apply?
- Owner: database platform owner and security.
- Choices:
  1. database-owner-deployed SECURITY DEFINER functions;
  2. constrained invoker functions with explicit table grants;
  3. equivalent isolated transition service with DB ownership controls.
- Risk: a broadly executable function or owner-role table access bypasses the
  event-only state model.
- Blocks: event transition implementation, CAS, and formal approval.
- Can proceed: function signatures, transition tables and test fixtures.
- Must decide before Schema/Migration: yes.

### OD-R3-C2-04 — Snapshot basis implementation authority

- Question: Which component is the approved independent database-side or
  verifier-side implementation of R3-BASIS-1, and how are the two independent
  encoders deployed and versioned?
- Owner: security and platform architecture.
- Choices:
  1. application serializer + independent SQL verifier;
  2. SQL encoder + independent application verifier;
  3. separately deployed evidence/signing verifier.
- Risk: one implementation generating both output and expected value is
  circular self-verification.
- Blocks: snapshot creation and digest verification.
- Can proceed: immutable vectors and interface.
- Must decide before implementation: yes.

## 2. Retained R2 Decisions

| ID | Decision | Blocked area |
|---|---|---|
| `OD-R2-01` | Authoritative engineering rule set | Formal Operational |
| `OD-R2-02` | Professional data/review authority | ProfessionalReview |
| `OD-R2-03` | VERIFIED approval roles/evidence | CatalogReview |
| `OD-R2-04` | Source content/review expiry | Catalog evidence |
| `OD-R2-05` | Price semantics/validity | Commercial status |
| `OD-R2-06` | Project Type changes | Project update/backfill |
| `OD-R2-07` | Project current requirement | Head/default selection |
| `OD-R2-08` | Conversation sharing/sales visibility | APIs/sales |
| `OD-R2-09` | Snapshot retention/visibility | Export/delete |
| `OD-R2-10` | Demo environment identity | Demo startup |
| `OD-R2-11` | Effective version ambiguity | Resolver policy |
| `OD-R2-12` | Legacy data disposition | Migration/backfill |
| `OD-R2-13` | Rule-set approval separation | Rule approval |
| `OD-R2-14` | Snapshot canonicalization/hash | Export/read model |
| `OD-R2-15` | Historical JSON/field mismatch | Requirement migration |
| `OD-R2-16` | Professional review workflow | Review workflow |
| `OD-R2-17` | Sales assignment identity/scope | Sales UI |
| `OD-R2-18` | Source review cadence | Source trust |
| `OD-R2-19` | Preliminary result visibility | UI |
| `OD-R2-20` | Formal rollout | Production |

## 3. Retained R3 Decisions

| ID | Decision | C2 effect |
|---|---|---|
| `OD-R3-01` | Archive product/retention/encryption | Preserved; archive required for source evidence |
| `OD-R3-02` | Raw vs canonical review basis | Preserved; controls typed evidence basis |
| `OD-R3-03` | Professional event retention/resubmission | Preserved; event table is append-only |
| `OD-R3-04` | Policy change continuity | Preserved; formal resolver rejects incompatible policy |
| `OD-R3-05` | Snapshot export/deletion | Preserved; no default deletion |
| `OD-R3-06` | Unmappable legacy scenario | Preserved; quarantine/mapping table |
| `OD-R3-07` | RuleSet creator/approver authority | Preserved; required for transition approval |
| `OD-R3-08` | Idempotency FAILED retention/replay | Preserved |
| `OD-R3-09` | Evidence unavailable/lost | Preserved; formal review fails closed |

## 4. Technical Items Not Open

The following are designed and cannot be waived by an Open Decision:

- exact composite keys and NOT NULL ownership;
- typed value columns and exactly-one-type checks;
- RuleSet/ProfessionalReview event-only current states;
- append-only event and transition-function requirements;
- exact Snapshot FieldValue/sourceKey relation;
- R3-BASIS-1 scalar framing and fixed vectors;
- no P1-3 lifecycle modification.

## 5. Gate

```text
Policy/authority decisions unresolved: YES
Core technical mechanisms designed: YES, pending independent review
Implementation authorized: NO
Database/Runtime verified: NO
```
