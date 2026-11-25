# R2 Finding-by-Finding Reassessment

| R2 Finding | Independent status | Reason |
|---|---|---|
| R2-P1-01 Bootstrap structure | RESOLVED — INDEPENDENT STATIC REVIEW | bad old FK removed; history FKs use immutable Generation; FK validation passes |
| R2-P1-02 Catalog FK targets | RESOLVED — INDEPENDENT STATIC REVIEW | exact Source/Binding PK relations and copy triggers present |
| R2-P1-03 PUBLIC ACL | RESOLVED — INDEPENDENT STATIC REVIEW | final PUBLIC revoke after all function definitions |
| R2-P2-01 Recovery duplication | RESOLVED — INDEPENDENT STATIC REVIEW | unique per original Request; replay before terminal check |
| R2-P2-02 Bootstrap replay/failure | PARTIALLY RESOLVED | replay-first present, but expiry rollback and locked-Generation uniqueness remain |
| R2-P2-03 Owner lock | RESOLVED — INDEPENDENT STATIC REVIEW | advisory xact lock implemented and called by closure validator |
| R2-P2-04 ACTIVE Principal | RESOLVED — INDEPENDENT STATIC REVIEW | Root and Approvers locked/checked at completion |
| R2-P2-05 Catalog Actor Grant | RESOLVED — INDEPENDENT STATIC REVIEW | exact Session/Grant/Principal FK exists |
| R2-P2-06 Validator | PARTIALLY RESOLVED | structural FK checks improved; expiry and locked-recovery semantics missed |
| R2-P3-01 Timestamp/state | PARTIALLY RESOLVED | checks added; expiry state still rolls back |
| R2-P3-02 Guard outcome | RESOLVED — INDEPENDENT STATIC REVIEW | R3 launcher records child exit and finish |

```text
P1: RESOLVED STATIC 3/3
P2: RESOLVED STATIC 4/6, PARTIAL 2/6
P3: RESOLVED STATIC 1/2, PARTIAL 1/2
```

No static closure is treated as PostgreSQL Runtime verification.
