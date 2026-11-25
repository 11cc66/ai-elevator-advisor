# Historical Finding Closure Matrix R3-C8 Corrections R2

## Rule

No R2 item is marked independently resolved. R2 corrections are
`DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW`.

## Previous R3-C8 Corrections Review P1

| Finding | R2 status | Reason |
|---|---|---|
| Root Principal binding | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | exact identity plus composite FKs |
| Owner Closure | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | database/schema/relation/function/type Owners |
| Catalog Source-Target | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | immutable binding and Event V2 digest |

## Previous R3-C8 Corrections Review P2

| Finding | R2 status | Reason |
|---|---|---|
| Bootstrap Recovery | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | recovery/rotation state machine |
| Original Session revocation | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | termination classification and recovery separation |
| Validator blind spots | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | semantic checks and targeted mutations |

## Previous R3-C8 Corrections Review P3

| Finding | R2 status | Reason |
|---|---|---|
| FieldValue domains | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | shared domain function/triggers |
| Shell/process guard | DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW | guarded launcher and Python child verification |

## Original R3-C8 P1/P2/P3

The original C8 review had:

```text
P1: 4 (1 static RESOLVED by R1, 3 PARTIAL after R1)
P2: 4 (2 static RESOLVED by R1, 1 PARTIAL, 1 NOT RESOLVED)
P3: 3 (2 static RESOLVED by R1, 1 PARTIAL)
```

R2 addresses the remaining P1/P2/P3 items above. Historical partial status is
not promoted until the next independent review.

## R3-C7

Prior independent baseline:

```text
RESOLVED 7/13
PARTIAL 6/13
NOT RESOLVED 0/13
```

Pending R2 review targets:

- source completeness;
- session binding and privilege graph;
- clean creation/recovery path;
- original-Session replay;
- AuthorityGrant root identity.

## R3-C6

Prior independent baseline:

```text
P1: RESOLVED 3/4, PARTIAL 0/4, NOT RESOLVED 1/4
P2: RESOLVED 6/6, PARTIAL 0/6, NOT RESOLVED 0/6
```

R2 directly targets the remaining P1 provenance and identity paths.

## R3-C4 / R3-C5

Prior independent baselines:

```text
R3-C4: RESOLVED 7/11, PARTIAL 1/11, NOT RESOLVED 3/11
R3-C5: RESOLVED 1/5, PARTIAL 4/5, NOT RESOLVED 0/5
```

R2 retains the independently reproduced C6 vector and improves the unresolved
Source, Owner and identity chains. It does not self-promote any historical
status.

## Unchanged Constraints

```text
C6-SNAP-01 bytes/hash unchanged
SourceKey maximum 362 bytes unchanged
Basis maximum 512 bytes unchanged
SK-R2 registry code 3 unchanged
57 Open Decisions unchanged
```
