# Validator Mutation Coverage R4

## Replayed R3 Formal Mutations

All 29 original classes were re-executed against the R4 final DDL:

```text
Root Principal: 8/8
Owner Closure: 12/12
Catalog Binding: 9/9
Result: 29/29
```

Each result is detected only when its named requirement changes from PASS to
FAIL. `VALIDATION_EVIDENCE_R4.json` stores the changed failures.

## Replayed R2 Historical Mutations

```text
root principal
root grant recipient
recovery functions
database owner
Schema owner
relation owner
function owner
catalog binding table
catalog Event Binding digest
original Session state
selection FieldValue Trigger
bootstrap audit guard

Result: 12/12
```

## R4 Transaction Mutations

| ID | Mutation | Expected detection |
|---|---|---|
| `R4-TX-01` | LOCKED update then uncaught RAISE | no unhandled expiry RAISE |
| `R4-TX-02` | update inside swallowed exception | no exception swallow |
| `R4-TX-03` | exception replaces committing helper | Approve calls helper |
| `R4-TX-04` | Audit omitted | Event required |
| `R4-TX-05` | Ledger completed by helper | helper Ledger-free |
| `R4-TX-06` | replay branch removed | replay result preserved |
| `R4-TX-07` | business exception swallowed | no exception swallow |
| `R4-TX-08` | real DB error masked | no exception swallow |
| `R4-TX-09` | expiry Event has mismatched actor role/Principal | Attempt actor pair |

## R4 Attempt Mutations

| ID | Mutation | Expected detection |
|---|---|---|
| `R4-ATT-01` | old one-per-Generation unique retained | legacy unique drop required |
| `R4-ATT-02` | sequence uniqueness removed | exact sequence key |
| `R4-ATT-03` | caller supplies sequence | Begin signature unchanged |
| `R4-ATT-04` | terminal Attempt reopened | no state reset to PENDING |
| `R4-ATT-05` | DENIED state cannot recover | LOCKED/REVOKED allowed |
| `R4-ATT-06` | LOCKED state cannot recover | LOCKED allowed |
| `R4-ATT-07` | two active Attempts | exact partial unique predicate |
| `R4-ATT-08` | approval not scoped to recovery | both approvals scoped |
| `R4-ATT-09` | delayed Execute accepted | APPROVED required |
| `R4-ATT-10` | Begin omits Lifecycle lock | row lock required |

## R4 Recovery Authorization Mutations

| ID | Mutation | Expected detection |
|---|---|---|
| `R4-REC-01` | ROTATION omits active root authority | active session/grant required |
| `R4-REC-02` | target role equals current role | new role/Principal required |
| `R4-REC-03` | backend identity omitted | strict backend lookup |
| `R4-REC-04` | replay target missing | replay row required |
| `R4-REC-05` | root acts as Deny approver | root identities excluded |
| `R4-REC-06` | Execute identity mismatch accepted | Lifecycle/Recovery equality |
| `R4-REC-07` | disabled Initiator remains eligible | ACTIVE Principal required |
| `R4-REC-08` | target identity was used/inactive | fresh target identity |
| `R4-REC-09` | disabled Approver remains eligible | ACTIVE Approver Principal |
| `R4-REC-10` | inactive/noninitial target advances Generation | ACTIVE + Epoch 1 |
| `R4-REC-11` | Execute auto-provisions Principal/Epoch | pre-provisioned identity only |
| `R4-REC-12` | disabled approval Operator remains executable | Operator enabled recheck |

## R4 Candidate Mutations

| ID | Mutation | Expected detection |
|---|---|---|
| `R4-CAND-01` | Selection Candidate nullable | both NOT NULL |
| `R4-CAND-02` | backfill without NOT NULL | both NOT NULL |
| `R4-CAND-03` | Trigger bypass can write NULL | both NOT NULL |
| `R4-CAND-04` | composite FK nullable escape | NOT NULL plus FK |
| `R4-CAND-05` | invented Candidate | authoritative source only |
| `R4-CAND-06` | unresolved history allowed | fail-closed preflight |
| `R4-CAND-07` | sealed Selection guard blocks backfill | narrow exception present |
| `R4-CAND-08` | finalized Snapshot exception is over-broad | exact helper call |
| `R4-CAND-09` | helper permits another field change | full row equality |
| `R4-CAND-10` | helper Owner assigned too late | early Owner + PUBLIC revoke |
| `R4-CAND-11` | source rows change during backfill | source-table freeze |

## R4 ACL Mutations

| ID | Mutation | Expected detection |
|---|---|---|
| `R4-ACL-01` | root completion omitted | final capability exactness |
| `R4-ACL-02` | old unsafe Recovery grant remains | old grants absent |
| `R4-ACL-03` | PUBLIC grant reintroduced | no PUBLIC in final tail |
| `R4-ACL-04` | new sequence table lacks function-owner DML | exact table privilege |

## Totals

```text
R3 formal: 29/29
R2 historical: 12/12
R4 semantic: 46/46
Overall mutation result: PASS
```

PASS means the offline Validator detected every selected negative mutation. It
does not prove PostgreSQL execution.
