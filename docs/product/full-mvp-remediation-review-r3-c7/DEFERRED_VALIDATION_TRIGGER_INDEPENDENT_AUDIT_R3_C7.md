# Deferred Validation / Trigger Independent Audit R3-C7

## Result

```text
Trigger DDL coverage: PASS
Deferred timing design: PASS — static
Final-state validation completeness: FAIL — P1-02
Trigger runtime behavior: NOT VERIFIED
```

## Trigger Matrix

| Table class | Row guard | DELETE | TRUNCATE | Deferred validation |
|---|---|---|---|---|
| Snapshot Header | UPDATE/no INSERT guard | yes | yes | yes |
| Snapshot canonical children | INSERT/UPDATE/DELETE | yes | yes | yes |
| Basis metadata/records | INSERT/UPDATE/DELETE | yes | yes | yes |
| PolicyRevision | INSERT/UPDATE/DELETE | yes | yes | digest check on insert |
| PolicyReviewEvent | UPDATE/DELETE | yes | yes | append-only |
| SelectionRun | UPDATE/DELETE | yes | yes | seal trigger |
| SelectionCandidate/Result/Price/Parameter | sealed-result guard | yes | **no** | no |
| SelectionRunSeal | sealed-result guard | yes | **no** | no |

The exact Snapshot table set is covered by both immediate and deferred triggers.
The `AFTER ... DEFERRABLE INITIALLY DEFERRED` form is correct in design.

## Trigger Recursion / Order

No direct recursion is visible: the validator queries tables but does not
update them. Child insert/update during a DRAFT is allowed, and finalization
calls the validator again inside the same transaction.

## P1-02 Finding

`validate_snapshot_r3` checks candidate completeness, price validity, warning
order, candidate RuleSet, source-key syntax and exact Basis re-computation. It
does not verify:

- all sealed requirement fields are present with equal values;
- all source/review/warning/missing rows are present;
- copied source/review/warning/review content equals sealed inputs.

## P2-06 Finding

Selection candidate/result/price/parameter/seal tables have sealed-row triggers
but no TRUNCATE triggers. A table owner or migration mistake can erase sealed
selection evidence without triggering row-level guards.

## Runtime Boundary

No trigger was executed. PostgreSQL constraint-trigger timing and error
propagation remain `NOT VERIFIED — DATABASE NOT AUTHORIZED`.
