# P1 Product Remediation Traceability R3-C2

Status:

```text
R3-C2 DESIGN COMPLETE WITH OPEN BLOCKERS
```

Status meanings:

- `DESIGN_ADDRESSED_PENDING_REVIEW`: a concrete R3-C2 mechanism exists and
  awaits independent review.
- `DESIGN_PRESERVED`: previously reviewed direction is retained.
- `OPEN_DECISION_RETAINED`: no authority exists to choose policy.
- No status means implementation, database behavior or Runtime verification.

## 1. Six R3 P1 Findings

| R3 finding | C2 design | DB invariant | Negative tests | Acceptance | Open dependency |
|---|---|---|---|---|---|
| `REV-R3-P1-01` | §3.2–3.4; exact four- and five-column RequirementVersion keys | Assertion/Value FKs use declared exact UNIQUE sets; all ownership columns NOT NULL | `C2-SRC-01/02/03/05/07/08` | direct SQL cross-version/cross-requirement writes fail | no |
| `REV-R3-P1-02` | §3.4–3.6; typed assertion and field value columns plus statuses | exactly one typed column per valueType; source kind and confirmation checks; no JSON authority | `C2-SRC-04/05/06/07/09/13` | uncertain/typed/confirmed states are representable and invalid combinations fail | `OD-R3-06/12/15` for legacy mapping |
| `REV-R3-P1-03` | §5; RuleSet event-only status view and transition function | status is latest event; APPROVED requires event for same revision/policy/basis | `C2-RULE-01/02/03/05/06/07` | no-event APPROVED is impossible | `OD-R2-01/13`, `OD-R3-07` |
| `REV-R3-P1-04` | §6; ProfessionalReview event-only state view and transition function | latest event is current state/version; event append-only; previous state and CAS checked | `C2-PRO-01`–`C2-PRO-12` | direct state tampering and state/event divergence fail | `OD-R2-16`, `OD-R3-03/04` |
| `REV-R3-P1-05` | §7; complete R3-BASIS-1 revision 2 | exact header, record/field/scalar framing, sorting, rejection rules | V01–V26 and two independent encoders | exact bytes and SHA-256 match; invalid input rejected before hash | no |
| `REV-R3-P1-06` | §8.2; snapshot `sourceFieldValueId + sourceKind + sourceKey` exact FK | USER_ASSERTION sourceKey equals sourceAssertionId; NULL cannot bypass source relation | `C2-SNP-01/02/03/04/10` | no second assertion can masquerade as FieldValue source | no |

## 2. P2-A through P2-E

| Group | Exact original Finding | R3 finding / review context | C2 disposition | Tests |
|---|---|---|---|---|
| P2-A | `REV-R2-P2-01` | R3 approved with dependency | Scenario mapping, final NOT NULL, update/freeze/race and legacy quarantine retained | `C2-SCN-01`–`C2-SCN-05` |
| P2-B | `REV-R2-P2-02` | `REV-R3-P1-03` / `REV-R3-P2-03` | RuleSet status is event-derived; exact RuleSetRevision and policy revision bound | `C2-RULE-01`–`C2-RULE-10` |
| P2-C | `REV-R2-P2-03` | R3 approved with dependency | Conversation/actor/key/payload failure/commit-unknown semantics retained; adds exact source relations | `C2-IDEM-01`–`C2-IDEM-07` |
| P2-D | `REV-R2-P2-04` | R3 approved with dependency / P1 review state | Catalog and professional policy revisions are exact-bound; event policy is checked on every transition | `C2-RULE-03`, `C2-PRO-09`, policy/transition fixtures |
| P2-E | `REV-R2-P2-05` | `REV-R3-P2-04` | Direct DB tests, state/event tampering, source mismatch, 20+ basis vectors and two independent encoders added | all C2 test sections |

## 3. Other R3 Findings

| R3 finding | C2 disposition | Reason |
|---|---|---|
| `REV-R3-P2-01` actor/author identity | `DESIGN_ADDRESSED_PENDING_REVIEW` | Added message `authorUserId`, assertion creator/confirmation User FKs and server-derived actor rules; test `C2-SRC-11/14` |
| `REV-R3-P2-02` legacy requirement mapping | `DESIGN_ADDRESSED_PENDING_REVIEW` / `OPEN_DECISION_RETAINED` | Added `LegacyRequirementMapping` and quarantine path; actual legacy disposition remains `OD-R3-06` |
| `REV-R3-P2-03` Catalog/RuleSet append-only/state projection | `DESIGN_ADDRESSED_PENDING_REVIEW` | RuleSet state is event-only; CatalogReview requires function/permission but final archive/role decisions remain open |
| `REV-R3-P2-04` missing tests | `DESIGN_ADDRESSED_PENDING_REVIEW` | R3-C2 test plan adds direct DB, state/event, source and exact vector tests |
| `REV-R3-P3-01` trace overclaim | `DESIGN_ADDRESSED_PENDING_REVIEW` | This trace explicitly separates design, review, Open Decision and implementation |

## 4. Preserved R2/R3 Findings

The following remain preserved:

- `REV-P1-01` conditional/double-negation semantics;
- `REV-P1-02` scenario chain direction and `OD-R3-06` dependency;
- `REV-P1-04` separate review/data/commercial statuses;
- `REV-P1-07` technical/commercial/trust/overall separation;
- `REV-P2-01` exact project/head keys;
- `REV-P2-02` route inventory;
- `REV-P2-03` sales assignee User FK/scope;
- `REV-P2-04` requirement history;
- `REV-P2-05` UTC/as-of effective time;
- `REV-P2-06` idempotency response correlation;
- `REV-P2-07` initial conversation atomicity;
- `REV-P2-08` historical stale overlay;
- `REV-P2-09` failure assertions;
- `REV-P2-10` frozen-install/test infrastructure;
- `REV-R2-P1-02` independent catalog evidence direction;
- `REV-R2-P1-03` sales main ownership chain;
- `REV-R2-P1-04/05` technical and commercial separation;
- SQL-scoped sales filtering;
- DEMO classification immutability;
- P1-3 complete isolation.

No previously approved design is silently removed.

## 5. Open Dependencies

All `OD-R2-01`–`OD-R2-20` and `OD-R3-01`–`OD-R3-09` remain. The main
dependencies are:

- source archive provider, retention, encryption and Legal Hold;
- raw vs canonical evidence basis;
- professional role/qualification/event retention;
- policy continuity;
- snapshot retention/export;
- legacy scenario and JSON disposition;
- RuleSet creation/approval authority;
- failed idempotency replay retention;
- evidence loss/recovery;
- price/tax/region, sales visibility, Demo, formal rollout.

## 6. Traceability Conclusion

```text
R3 P1 design findings addressed in C2: 6 / 6
P2-A through P2-E addressed in C2: 5 / 5
Other R3 P2 findings addressed in design: 4 / 4
Open Decisions retained: YES
Independent R3-C2 review: PENDING
Implementation: NOT AUTHORIZED
Database behavior: NOT VERIFIED
Runtime: NOT VERIFIED
```
