# Historical Finding Closure Matrix R3

## R3-C8 R2 Review

```text
P1-01 Bootstrap Recovery: RESOLVED — DESIGN
P1-02 Catalog FK Targets: RESOLVED — DESIGN
P1-03 PUBLIC ACL: RESOLVED — DESIGN
P2-01 Result Recovery: RESOLVED — DESIGN
P2-02 Bootstrap Replay: RESOLVED — DESIGN
P2-03 Owner Lock: RESOLVED — DESIGN
P2-04 Active Principal: RESOLVED — DESIGN
P2-05 Catalog Actor Grant: RESOLVED — DESIGN
P2-06 Validator: RESOLVED — DESIGN
P3-01 State Timestamps: RESOLVED — DESIGN
P3-02 Guard Evidence: RESOLVED — DESIGN
```

## R3-C8 Original

| Severity | R3 state | Basis |
|---|---|---|
| P1 | 2 RESOLVED — DESIGN, 1 PARTIAL, 1 NOT VERIFIED | Price/root identity fixed; Catalog and runtime remain |
| P2 | 2 RESOLVED — DESIGN, 1 PARTIAL, 1 NOT VERIFIED | ledger semantics/runtime remain |
| P3 | 2 RESOLVED — DESIGN, 1 PARTIAL | shell guard process remains external |

Original historical statuses are not reduced merely because R2/R3 added text.

## R3-C7

Prior counts:

```text
RESOLVED STATIC 7
PARTIAL 4
NOT RESOLVED 2
```

R3 closes the prior source-FK and recovery structural defects at design level.
The following still require independent review:

- actual PostgreSQL FK acceptance;
- Role/ACL Catalog closure;
- concurrent recovery and lock ordering;
- runtime replay/revocation races.

## R3-C6

```text
P1: 3 previously resolved static, 1 now design-targeted
P2: 6 previously resolved static
```

R3 repairs the remaining P1 structural source relations; runtime remains
unverified.

## R3-C5 / R3-C4

R3 preserves prior fixed vectors and targets the remaining FK, Owner, recovery
and ACL gaps. No historical item is promoted to independent PASS.

## Preserved

- C6-SNAP-01 exact bytes/hash.
- SourceKey maximum 362 bytes.
- Basis maximum 512 bytes.
- SK-R2 registry code 3.
- All 57 Open Decision IDs.
