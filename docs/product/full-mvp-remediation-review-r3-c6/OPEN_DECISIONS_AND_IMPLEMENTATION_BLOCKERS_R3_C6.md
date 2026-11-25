# Open Decisions and Implementation Blockers R3-C6

Date: 2026-11-24

## 1. Result

```text
Existing Open Decisions: 46 PRESENT / 46 OPEN
R3-C6 Open Decisions:    5 PRESENT / 5 OPEN
Approvals added:         0
Implementation authorization: NOT GRANTED
```

No approval evidence was found. A design proposal or independent review is not
an owner approval and does not close an Open Decision.

## 2. Existing Decisions

The C6 Open Decisions file preserves the following 46 identifiers exactly:

| Family | IDs | Count | State |
|---|---|---:|---|
| R2 business/security/rollout | `OD-R2-01`..`OD-R2-20` | 20 | OPEN |
| R3 archive/review/evidence | `OD-R3-01`..`OD-R3-09` | 9 | OPEN |
| R3-C2 database/archive/vector authority | `OD-R3-C2-01`..`OD-R3-C2-04` | 4 | OPEN |
| R3-C3 identity/catalogue/transition/archive | `OD-R3-C3-01`..`OD-R3-C3-04` | 4 | OPEN |
| R3-C4 registry/catalogue/event/rollout | `OD-R3-C4-01`..`OD-R3-C4-04` | 4 | OPEN |
| R3-C5 identity/basis/review/break-glass | `OD-R3-C5-01`..`OD-R3-C5-05` | 5 | OPEN |
| Total |  | **46** | **OPEN** |

The R3-C5 design record states 41 historical decisions plus five new C5
decisions, all open. The C6 record retains those same 46 identifiers and adds
none by renumbering.

## 3. New C6 Decisions

| ID | Topic | Required owner | Implementation effect |
|---|---|---|---|
| `OD-R3-C6-01` | Session assertion, broker, key custody, nonce and HA mechanism | security architecture / identity / platform | blocks session and transition implementation |
| `OD-R3-C6-02` | SNAPSHOT-R3 / R3-BASIS-1-R6 rollout | product / security / database architecture | blocks Snapshot migration |
| `OD-R3-C6-03` | Price provenance and historical validity policy | commercial / product / security | blocks Price schema/import/quotation |
| `OD-R3-C6-04` | Per-session DB login provisioning and connection topology | database platform / security / operations | blocks production session deployment |
| `OD-R3-C6-05` | Policy author/approver split and effective-policy process | technical authority / security | blocks PolicyEvent implementation |

All five are explicitly `OPEN`. No owner approval, signed decision, deployment
authorization or accepted-risk record is present in the reviewed inputs.

## 4. Implementation Blockers From Findings

| Finding | Blocks |
|---|---|
| `REV-R3-C6-P1-01` | Selection provenance, Snapshot schema, Snapshot creation and finalization |
| `REV-R3-C6-P1-02` | Snapshot DDL parse, materialization, deferred validation and Basis finalization |
| `REV-R3-C6-P1-03` | TrustedSession, Policy transition, ProfessionalReview transition and old-connection safety |
| `REV-R3-C6-P1-04` | Policy content/digest, Review Event DDL, effective policy and professional review transition |
| `REV-R3-C6-P2-01` | protected policy/snapshot/audit read views |
| `REV-R3-C6-P2-02` | PostgreSQL function ownership and runtime EXECUTE |
| `REV-R3-C6-P2-03` | idempotent Policy/ProfessionalReview retry |
| `REV-R3-C6-P2-04` | Basis resource bounds and finalization admission |
| `REV-R3-C6-P2-05` | negative scalar validation evidence |
| `REV-R3-C6-P2-06` | SourceKey encoder boundary evidence |

## 5. Decision-State Discipline

The following states are distinct:

| Claim | Current state |
|---|---|
| A design option is written | PRESENT |
| An independent review examines it | REVIEWED |
| A responsible owner approves it | NOT EVIDENCED |
| Deployment prerequisites exist | NOT VERIFIED |
| Schema/Migration is authorized | NOT AUTHORIZED |
| Runtime is authorized | NOT AUTHORIZED |
| Production is authorized | NOT AUTHORIZED |

No Open Decision can waive source provenance, exact composite FKs, Session
revocation, canonical Basis bytes, append-only evidence, deferred validation or
P1-3 isolation.

## 6. Gate

R3-C6 requires a separately authorized R3-C7 design correction. Even a
successful R3-C7 review would not automatically close the 51 decisions or
authorize implementation. The responsible owners must approve the decisions in
their stated governance process.
