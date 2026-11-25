# Finding-by-Finding Traceability R3-C8 Corrections R2

## Status Rules

- `RESOLVED STATIC`: the original static design defect is closed by the R2
  artifact; PostgreSQL execution is still unverified.
- `PARTIALLY RESOLVED`: the main mechanism exists, but a directly related
  security or correctness invariant remains open.
- `NOT RESOLVED`: the original attack/counterexample or an equivalent structural
  failure remains.
- `NOT VERIFIED`: evidence cannot distinguish success from failure.

## R3-C8 Original P1

| Finding | R2 status | Evidence |
|---|---|---|
| `REV-R3-C8-P1-01` Price content | RESOLVED STATIC | full Price fact/digest chain retained |
| `REV-R3-C8-P1-02` source/review provenance | NOT RESOLVED | Catalog FKs target non-unique keys; Professional result FKs use missing `candidate_id` |
| `REV-R3-C8-P1-03` role closure | PARTIALLY RESOLVED | Owner scans expanded, but claimed advisory lock is absent |
| `REV-R3-C8-P1-04` bootstrap/CONNECT | PARTIALLY RESOLVED | initial identities and CONNECT exist; recovery DDL is structurally invalid |

```text
P1: RESOLVED STATIC 1, PARTIAL 2, NOT RESOLVED 1
```

## R3-C8 Original P2

| Finding | R2 status | Evidence |
|---|---|---|
| `REV-R3-C8-P2-01` ledger session | PARTIALLY RESOLVED | ordinary revocation deny exists; controlled recovery is multi-instance/non-idempotent |
| `REV-R3-C8-P2-02` Review TRUNCATE | RESOLVED STATIC | named Review/Session guards retained |
| `REV-R3-C8-P2-03` validator overclaim | NOT RESOLVED | R2 validator reports PASS despite five FK errors and ACL/recovery gaps |
| `REV-R3-C8-P2-04` Source-Aux | RESOLVED STATIC | pre-Seal call retained |

```text
P2: RESOLVED STATIC 2, PARTIAL 1, NOT RESOLVED 1
```

## R3-C8 Original P3

| Finding | R2 status | Evidence |
|---|---|---|
| `REV-R3-C8-P3-01` tool overwrite | RESOLVED STATIC | fixed R2 paths |
| `REV-R3-C8-P3-02` Grant revocation | RESOLVED STATIC | missing/revoked target guards retained |
| `REV-R3-C8-P3-03` shell misrouting | PARTIALLY RESOLVED | guard exists, but routing mismatches still occur outside Guard and evidence lacks exit outcome |

```text
P3: RESOLVED STATIC 2, PARTIAL 1, NOT RESOLVED 0
```

## R3-C8 Corrections R1 Review

### P1

| Finding | R2 status | Evidence |
|---|---|---|
| Root Principal binding | RESOLVED STATIC | operator/state/session/grant equality now explicit |
| Database/protected Owner Closure | PARTIALLY RESOLVED | Owner checks present; lock/race closure missing |
| Catalog Source-Target Binding | NOT RESOLVED | core binding FKs target non-unique column sets |

### P2

| Finding | R2 status | Evidence |
|---|---|---|
| Bootstrap root recovery | NOT RESOLVED | invalid/mutable Lifecycle FKs; old-Generation lookup before ledger; stuck issuer state |
| Original Session revocation replay | PARTIALLY RESOLVED | ordinary replay denied, controlled recovery not one-time/idempotent |
| Validator blind spots | NOT RESOLVED | self-validator misses all independent structural findings |

### P3

| Finding | R2 status | Evidence |
|---|---|---|
| FieldValue domains | RESOLVED STATIC | shared function/triggers |
| Shell/process guard | PARTIALLY RESOLVED | process checks work for guarded tools; evidence/item exit handling incomplete |

## R3-C7

| Finding | R2 status | Reason |
|---|---|---|
| `P1-01` candidate binding | RESOLVED STATIC | retained |
| `P1-02` child/source completeness | NOT RESOLVED | invalid Catalog/Professional FKs |
| `P1-03` session binding | PARTIALLY RESOLVED | Owner race lock missing |
| `P1-04` privilege graph | PARTIALLY RESOLVED | Owner scans expanded; PUBLIC helper ACL gap |
| `P1-05` creation path | NOT RESOLVED | recovery/rotation DDL cannot compile |
| `P1-06` status view | RESOLVED STATIC | retained |
| `P2-01` R6 parity | RESOLVED STATIC | R6 23/14 evidence retained |
| `P2-02` SourceKey NFC | RESOLVED STATIC | retained |
| `P2-03` replay | PARTIALLY RESOLVED | recovery replay ordering defect |
| `P2-04` AuthorityGrant | PARTIALLY RESOLVED | root binding fixed; recovery lifecycle FKs invalid |
| `P2-05` policy lifecycle | RESOLVED STATIC | retained |
| `P2-06` TRUNCATE | RESOLVED STATIC | guards retained |
| `P3-01` duplicate assignment | RESOLVED STATIC | retained |

```text
R3-C7: RESOLVED STATIC 7/13, PARTIAL 4/13, NOT RESOLVED 2/13
```

## R3-C6

```text
P1: RESOLVED STATIC 3/4, PARTIAL 0/4, NOT RESOLVED 1/4
P2: RESOLVED STATIC 6/6, PARTIAL 0/6, NOT RESOLVED 0/6
```

The unresolved P1 remains provenance/source completeness because the Catalog
and Professional source relations are not valid final constraints.

## R3-C5

| Finding | R2 status |
|---|---|
| `P1-02` provenance | NOT RESOLVED — invalid source FKs |
| `P1-03` session lifecycle | PARTIALLY RESOLVED — Owner race |
| `P1-04` policy lifecycle | RESOLVED STATIC |
| `P2-02` deferred validation | PARTIALLY RESOLVED — structural source failures |
| `P2-04` privileges | PARTIALLY RESOLVED — PUBLIC helper ACL |

```text
R3-C5: RESOLVED STATIC 1/5, PARTIAL 3/5, NOT RESOLVED 1/5
```

## R3-C4

```text
RESOLVED STATIC 7/11
PARTIAL 1/11
NOT RESOLVED 3/11
```

The same Catalog, Professional source and privilege closure gaps retain the
prior non-resolution statuses.

## R2 New Findings

```text
P1-01 Bootstrap recovery structural incompatibility
P1-02 Catalog FK non-unique targets
P1-03 PUBLIC EXECUTE boundary not closed

P2-01 Result recovery uniqueness/idempotency
P2-02 Bootstrap recovery replay/interruption
P2-03 Owner Closure advisory lock absent
P2-04 Root Principal active-state check absent
P2-05 Catalog Binding creator Grant FK absent
P2-06 Validator/evidence overclaim

P3-01 lifecycle timestamp/state constraints
P3-02 Guard evidence lacks tool completion result
```

No R2 new item is promoted to independent PASS.
