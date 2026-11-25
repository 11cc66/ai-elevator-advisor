# Historical Finding Closure Matrix R4

## R2 Findings Reassessed

| Finding | R2 original issue | R4 status | Basis |
|---|---|---|---|
| `R2-P1-01` | Bootstrap recovery structure | `RESOLVED — DESIGN` | Immutable Generation history and R3 fixes preserved; R4 Attempt model adds ordered recovery |
| `R2-P1-02` | Catalog FK targets | `RESOLVED — DESIGN` | Exact Source/Binding keys and copy/verify Triggers retained |
| `R2-P1-03` | PUBLIC EXECUTE | `RESOLVED — DESIGN` | Final PUBLIC revoke plus explicit complete capability reassertion |
| `R2-P2-01` | Result Recovery duplication | `RESOLVED — DESIGN` | One recovery per original Request; replay-first retained |
| `R2-P2-02` | Bootstrap replay/interruption | `RESOLVED — DESIGN` | Committing expiry, replay-first, failed issuance recovery path and ordered new Attempt |
| `R2-P2-03` | Owner lock | `RESOLVED — DESIGN` | Advisory transaction lock retained |
| `R2-P2-04` | Principal ACTIVE | `RESOLVED — DESIGN` | Root and approvers remain rechecked under lock |
| `R2-P2-05` | Catalog actor Grant | `RESOLVED — DESIGN` | Exact Session/Grant/Principal composite FK retained |
| `R2-P2-06` | Validator insufficiency | `RESOLVED — DESIGN` | Final-definition semantics, exact key/ACL checks, 29/29 + 12/12 + 46/46 mutations |
| `R2-P3-01` | State/timestamp invariants | `RESOLVED — DESIGN` | R3 checks retained; terminal Attempt time/reason check added |
| `R2-P3-02` | Guard completion evidence | `RESOLVED — DESIGN` | Guard launcher records tool exit code and finish time |

## R3 Independent Review Findings

| Finding | Prior status | R4 status | Closure |
|---|---|---|---|
| `REV-R3-R3-P2-01` | FAIL | `RESOLVED — DESIGN` | No exception rollback of LOCKED |
| `REV-R3-R3-P2-02` | FAIL | `RESOLVED — DESIGN` | New Attempt after DENIED/LOCKED |
| `REV-R3-R3-P2-03` | FAIL | `RESOLVED — DESIGN` | Semantic Validator and mutations |
| `REV-R3-R3-P3-01` | FAIL | `RESOLVED — DESIGN` | Both Candidate columns NOT NULL |

## Earlier Historical Status

The following independent static closures are preserved and not weakened:

- C6-SNAP-01 exact 15 records / 4036 bytes.
- SourceKey maximum 362 bytes.
- Basis maximum 512 bytes.
- SK-R2 registry code 3.
- Request Ledger ordinary revocation deny.
- Append-only review/audit protections.
- Catalog source/target binding exact identity.
- Professional Review event/selection/snapshot provenance.
- Owner closure lock implementation.

Earlier `PARTIAL`, `NOT VERIFIED` and runtime-dependent items remain runtime
items unless the R4 change directly supplies the missing design control.

## Important Non-Promotions

`RESOLVED — DESIGN` is not `INDEPENDENTLY REVIEWED`, not `PASS`, and not
`RUNTIME VERIFIED`.

The following cannot be closed by this document:

- PostgreSQL syntax/compilation;
- real constraint and Trigger execution;
- real concurrent transaction outcome;
- real ACL/Catalog state;
- real migration against existing data;
- production deployment.
