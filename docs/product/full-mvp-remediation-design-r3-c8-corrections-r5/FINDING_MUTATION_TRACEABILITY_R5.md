# Finding and Mutation Traceability R5

## Canonical Finding Registry

| Canonical ID | Original source | Severity | R5 status | Primary evidence |
|---|---|---|---|---|
| `REV-R4-IND-P2-01` | R4 independent review | P2 | `RESOLVED — DESIGN` | current-Root Execute gate and Generation Trigger |
| `REV-R4-IND-P2-02` | R4 independent review | P2 | `RESOLVED — DESIGN` | Begin expired-Attempt sweep and terminal record |
| `REV-R4-IND-P2-03` | R4 independent review | P2 | `RESOLVED — DESIGN` | controlled Candidate batch and per-row audit |
| `REV-R3-R3-P2-03` | R3 independent review | P2 | `RESOLVED — DESIGN` | 29/12/46 mutation replay plus 22 independent rules |
| `REV-R4-IND-P3-01` | R4 independent review | P3 | `RESOLVED — DESIGN` | unique R5 registry and repaired ranges |

## Historical Duplicate-ID Resolution

R4 used the same label `R4-DESIGN-P3-01` for two distinct historical findings.
R5 preserves the old label as a historical alias and assigns unambiguous
canonical IDs:

| Historical reference | Canonical R5 ID | Meaning |
|---|---|---|
| `R4-DESIGN-P3-01` (first occurrence) | `R4-HIST-P3-01A` | expiry Event actor pair |
| `R4-DESIGN-P3-01` (second occurrence) | `R4-HIST-P3-01B` | legacy Attempt sequence backfill |

No historical text was edited. Any future reference must use the canonical ID
and may include the old label only as an alias.

## Mutation Registry

The formal ranges are complete:

```text
R3 formal mutations:
  root1_operator_principal ... root8_single_root_grant
  owner1_database_self ... owner12_admin
  cat1_binding_table ... cat9_snapshot_binding

R2 historical mutations:
  12 exact historical keys

R4 semantic mutations:
  R4-TX-01 ... R4-TX-09
  R4-ATT-01 ... R4-ATT-10
  R4-REC-01 ... R4-REC-12
  R4-CAND-01 ... R4-CAND-11
  R4-ACL-01 ... R4-ACL-04

Independent negative rules:
  IND-MUT-01 ... IND-MUT-22
```

There are 46 R4 semantic mutations: 9 + 10 + 12 + 11 + 4. The Candidate range
therefore ends at `R4-CAND-11`, not `R4-CAND-09`.

```text
R4-CAND-01 R4-CAND-02 R4-CAND-03 R4-CAND-04 R4-CAND-05 R4-CAND-06
R4-CAND-07 R4-CAND-08 R4-CAND-09 R4-CAND-10 R4-CAND-11
```

## R5 Test Vectors

| Vector ID | Scope | Evidence |
|---|---|---|
| `R5-STATE-REVOKED-APPROVAL` | revoked approval cannot Execute | `VALIDATION_EVIDENCE_R5.json` |
| `R5-STATE-REVOKED-ROOT` | revoked Root cannot Execute | same |
| `R5-STATE-EXPIRED-REPLACED` | expired active Attempt replaced | same |
| `R5-STATE-SINGLE-ACTIVE` | no second active Attempt | same |
| `R5-STATE-RESPONSE-LOSS` | non-NULL durable replay | same |

## Cross-reference Rules

1. A Finding must name at least one DDL object and one validation ID.
2. A Mutation must name an existing final function or SQL statement and one
   semantic check.
3. A Test Vector must be non-empty and be evaluated by executable offline logic.
4. Validation evidence may not contain unknown Finding, Mutation or Vector IDs.
5. No formal mutation may target a historical body that is not the final
   definition.
6. No Candidate test may stop at CAND-09 while CAND-10/11 exist.

## Result

```text
Finding IDs unique: YES
Mutation IDs unique: YES
Test Vector IDs unique: YES
Unknown evidence IDs: 0
Orphan Candidate range entries: 0
```

This registry is design evidence, not independent approval.

