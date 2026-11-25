# P1 Product Remediation Test Plan R3-C7

Artifact: `P1_PRODUCT_REMEDIATION_TEST_PLAN_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Executed in R3-C7

| Suite | Count | Evidence | Result |
|---|---:|---|---|
| Scalar/source-aux Node/Python parity | 23 | `R6_SCALAR_NEGATIVE_VECTOR_EXECUTION_R3_C7.md` | PASS |
| SourceKey Node/Python boundary parity | 19 | `SOURCEKEY_REAL_ENCODER_BOUNDARY_EXECUTION_R3_C7.md` | PASS |
| Basis resource-limit Node/Python parity | 14 | `R6_BASIS_LIMIT_ACCEPT_REJECT_VECTORS_R3_C7.md` | PASS |
| C6-SNAP-01 compatibility | 1 | 4036 bytes / original SHA-256 | PASS |
| DDL static lexical/reference check | 44 functions | `DATABASE_DDL_STATIC_REFERENCE_VALIDATION_R3_C7.md` | PASS |

No database, product application or Storage was executed.

## 2. Provenance Database Tests

All tests run only in a future authorized isolated PostgreSQL 18 database.

| ID | Mutation | Required rejection |
|---|---|---|
| `C7-PROV-01` | Product revision from Product B used by Product A candidate | FK `selection_candidate_product_fkey` |
| `C7-PROV-02` | Specification revision from another product revision | FK `selection_candidate_specification_fkey` |
| `C7-PROV-03` | Price belongs to another candidate/product/specification | candidate-price composite FK |
| `C7-PROV-04` | Result candidate/run mismatch | result-to-candidate exact FK |
| `C7-PROV-05` | Run RequirementVersion differs from Case | Run/Case exact FK |
| `C7-PROV-06` | Parameter revision from another product revision | catalog-parameter composite FK |
| `C7-PROV-07` | Parameter result belongs to another candidate | candidate-parameter composite FK |
| `C7-PROV-08` | Snapshot created from RUNNING, unsealed run | FK to `selection_run_seal` |
| `C7-PROV-09` | Candidate/Snapshot RuleSet differs | exact RuleSet FK/trigger |
| `C7-PROV-10` | Insert/update/delete after seal | `guard_sealed_result_r3` |
| `C7-PROV-11` | Cross-project tuple | project-inclusive composite FK |
| `C7-PROV-12` | Cross-requirement tuple | requirement-inclusive composite FK |

## 3. Session/Revocation Tests

| ID | Scenario | Expected |
|---|---|---|
| `RACE-01` | Transition gets shared locks before revoke | transition completes; revoke waits |
| `RACE-02` | Revoke commits before new transition | transition rejects |
| `RACE-03` | Epoch changes before transition | stale session rejects |
| `RACE-04` | Logout races policy approval | one serial order, no post-revoke event |
| `RACE-05` | Open old connection after logout | active-session lock/recheck rejects |
| `RACE-06` | Old transaction snapshot after revoke | share lock serializes or recheck rejects |
| `RACE-07` | Expiry during long transaction | expiry boundary has deterministic outcome |
| `RACE-08` | Same request ID/hash | original event returned |
| `RACE-09` | Same request ID/different hash | conflict |
| `RACE-10` | Idempotent retry with stale expected sequence | original event returned |
| `RACE-11` | Opposite lock-order attempt | deadlock detector chooses one; retry policy applies only to deadlock |
| `RACE-12` | Authority revoked concurrently | transition completes first or rejects |

## 4. Policy Tests

| ID | Scenario | Expected |
|---|---|---|
| `C7-POL-01` | Canonical content byte changes, old digest retained | insert/trigger digest mismatch |
| `C7-POL-02` | Revision UPDATE/DELETE | rejected |
| `C7-POL-03` | Event UPDATE/DELETE | rejected |
| `C7-POL-04` | Policy Revision/Event TRUNCATE | rejected |
| `C7-POL-05` | Author approves own revision | rejected |
| `C7-POL-06` | Unauthorized principal approves | rejected |
| `C7-POL-07` | Duplicate request same hash | replay |
| `C7-POL-08` | Duplicate request different hash | conflict |
| `C7-POL-09` | Concurrent approvals | one CAS winner/event sequence |
| `C7-POL-10` | Invalidated/superseded effective policy | absent from current view |
| `C7-POL-11` | Professional review uses ineffective policy | rejected |
| `C7-POL-12` | Cross-project policy read | filtered by view/authority |

## 5. Snapshot Tests

| ID | Scenario | Expected |
|---|---|---|
| `C7-SNAP-01` | Incomplete DRAFT committed | deferred validation reject |
| `C7-SNAP-02` | Finalized child insert/update/delete | reject |
| `C7-SNAP-03` | Snapshot/child TRUNCATE | reject |
| `C7-SNAP-04` | Price basis-as-of mismatch | reject unless non-operational status |
| `C7-SNAP-05` | Warning order not canonical | reject |
| `C7-SNAP-06` | RuleSet candidate mismatch | reject |
| `C7-SNAP-07` | Stored Basis differs from DB projection | reject |
| `C7-SNAP-08` | Two finalizers, same version | one CAS winner |
| `C7-SNAP-09` | Child changes during finalization | parent lock serializes |
| `C7-SNAP-10` | COMMIT unknown | durable fresh re-read required |

## 6. PostgreSQL Privilege Tests

Use future Catalog introspection, not application behavior:

- exact function OID, `proowner`, `prosecdef`, `proconfig`;
- exact ACL for each table, sequence, function and view;
- PUBLIC has no object privilege;
- runtime roles cannot use owner/migrator roles;
- default privileges for all creator roles;
- trigger functions have no runtime EXECUTE;
- protected views use owner and security semantics stated in design;
- revoked/expired TrustedSession is absent from current views;
- `REFERENCES` and `TRIGGER` privileges are revoked from runtime.

## 7. Classification

All database tests above are `NOT EXECUTED — DATABASE NOT AUTHORIZED`. Node,
Python and static-DDL evidence is `PASS` only for the stated offline scope.
