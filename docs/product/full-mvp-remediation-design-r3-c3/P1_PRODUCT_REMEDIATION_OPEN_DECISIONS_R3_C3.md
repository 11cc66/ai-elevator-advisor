# P1 Product Remediation Open Decisions R3-C3

Status:

```text
OPEN DECISIONS RETAINED
NO POLICY OR IMPLEMENTATION APPROVAL
```

## 1. C3 Decisions

### OD-R3-C3-01 — Canonical Text/CUID identity acceptance

- Question: Does the product/security architecture approve retaining CUID/Text
  business IDs and namespaced text sourceKey for R3-C3?
- Owner: architecture and security owners.
- Choice: retain CUID/Text (recommended) or perform a separately approved
  identity migration.
- Blocks: `BLOCKS_SCHEMA`, `BLOCKS_MIGRATION`, `BLOCKS_DATA_IMPORT`.
- Can proceed: protocol vectors with fixed text row IDs.
- Must decide before Schema/Migration: yes.

### OD-R3-C3-02 — Typed field catalogue and units

- Question: Which exact units, decimal ranges, field enum values and
  scenario-specific typed catalogue are authoritative?
- Owner: elevator technical authority/product/security.
- Blocks: `BLOCKS_SCHEMA`, `BLOCKS_MIGRATION`, `BLOCKS_DATA_IMPORT`,
  `BLOCKS_PRODUCTION`.
- Can proceed: type-independent validation and quarantine.
- Must decide before typed field activation: yes.

### OD-R3-C3-03 — Transition function ownership and grants

- Question: Which database owner deploys RuleSet/ProfessionalReview transition
  functions, what fixed `search_path`, and which roles receive EXECUTE?
- Owner: database platform/security owner.
- Blocks: `BLOCKS_SCHEMA`, `BLOCKS_SECURITY_APPROVAL`, `BLOCKS_PRODUCTION`.
- Can proceed: event-only transition specification and denial tests.
- Must decide before function creation: yes.

### OD-R3-C3-04 — Canonical evidence archive and verifier

- Question: Which archive adapter, verifier service identity, encryption,
  retention and legal-hold policy apply to catalog source evidence?
- Owner: security/legal/platform/catalog.
- Blocks: `BLOCKS_SCHEMA`, `BLOCKS_MIGRATION`, `BLOCKS_DATA_IMPORT`,
  `BLOCKS_PRODUCTION`.
- Can proceed: immutable archive interface and negative fixtures.
- Must decide before source capture: yes.

## 2. Retained R2/R3/C2 Decisions

| IDs | Status | Main blocked effect |
|---|---|---|
| `OD-R2-01`–`OD-R2-20` | RETAINED | Engineering rules, price, scenario/head, visibility, retention, Demo, rollout |
| `OD-R3-01`–`OD-R3-09` | RETAINED | Archive, evidence basis, professional workflow, policy continuity, snapshot retention, legacy/evidence recovery |
| `OD-R3-C2-01`–`OD-R3-C2-04` | RETAINED | Typed catalogue, archive verifier, transition ownership, basis implementation |

No Open Decision may waive:

- exact composite FKs;
- typed-source ownership;
- event-only status;
- append-only events;
- sourceKey equality;
- R3-BASIS-1 revision 3 framing;
- P1-3 isolation.

## 3. Decision Matrix

```text
Business/engineering policy: UNRESOLVED
Canonical CUID/Text mechanism: DESIGNED, pending approval
Type/unit catalogue: UNRESOLVED
Event transition owner: UNRESOLVED
Archive verifier/identity: UNRESOLVED
P1-3 boundary: PRESERVED
Implementation authorization: NOT GRANTED
```
