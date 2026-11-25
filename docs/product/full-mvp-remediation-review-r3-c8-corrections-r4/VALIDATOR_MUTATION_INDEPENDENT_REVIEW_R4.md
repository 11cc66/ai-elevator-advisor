# Validator and Mutation Independent Review R4

## Submitted Suite Reproduction

The literal submitted mutations were independently applied to isolated
temporary copies:

```text
R3 formal mutations:     29/29 reproduced
R2 historical mutations: 12/12 reproduced
R4 semantic mutations:   46/46 reproduced
```

Reproduction does not make the Validator independent. Per-item target and
result data is in `VALIDATION_EVIDENCE_REVIEW_R4.json`.

## Validator Implementation Review

Positive:

- final definitions replace historical overload bodies;
- FK target-key structure is checked;
- effective GRANT/REVOKE state is reconstructed;
- Candidate NOT NULL and composite FK are checked;
- public revoke ordering is checked;
- mutations are tied to named checks;
- input Manifests fail closed.

Limitations:

- transaction vectors are declarative rows, not an executable transaction
  model;
- `AttemptModel` does not model `approval_expires_at`;
- no mutation covers new Begin after an expired active Attempt;
- no independent check verifies current Root reauthorization in Execute;
- no mutation requires Candidate backfill audit evidence;
- the response-loss vector compares `None` with `None`;
- a green self-Validator cannot replace real PostgreSQL behavior.

## Independent Negative Suite

```text
Required independent checks: 22
Passed:                      18
Missed:                       4
```

| ID | Risk | Result |
|---|---|---|
| `IND-MUT-01` | LOCKED update then exception rollback | `DETECTED` |
| `IND-MUT-02` | Expiry Ledger operation mismatch | `DETECTED` |
| `IND-MUT-03` | Denied then new Attempt | `DETECTED` |
| `IND-MUT-04` | Locked then new Attempt | `DETECTED` |
| `IND-MUT-05` | Sequence concurrency duplicate | `DETECTED` |
| `IND-MUT-06` | Two Active Attempts | `DETECTED` |
| `IND-MUT-07` | Old Approval reused | `DETECTED` |
| `IND-MUT-08` | Old Attempt delayed Execute | `DETECTED` |
| `IND-MUT-09` | Sequence Function Owner lacks DML | `DETECTED` |
| `IND-MUT-10` | ROTATION Execute current Root recheck | `MISSED` |
| `IND-MUT-11` | Revoked Initiator eligible | `DETECTED` |
| `IND-MUT-12` | Revoked Approver can Execute | `DETECTED` |
| `IND-MUT-13` | Execute creates Principal | `DETECTED` |
| `IND-MUT-14` | Execute creates Epoch | `DETECTED` |
| `IND-MUT-15` | Candidate nullable | `DETECTED` |
| `IND-MUT-16` | Candidate backfill changes another field | `DETECTED` |
| `IND-MUT-17` | Candidate source non-unique | `DETECTED` |
| `IND-MUT-18` | Source rows mutate during backfill | `DETECTED` |
| `IND-MUT-19` | Sealed Snapshot digest mismatch | `DETECTED` |
| `IND-MUT-20` | Expired active Attempt replacement | `MISSED` |
| `IND-MUT-21` | Candidate backfill durable audit | `MISSED` |
| `IND-MUT-22` | Non-vacuous response-loss replay | `MISSED` |

## Exact Evidence

`VALIDATION_EVIDENCE_REVIEW_R4.json` contains:

- all input Manifest results;
- all key hashes;
- all 29 R3 mutation rows;
- all 12 R2 mutation rows;
- all 46 R4 mutation rows;
- all 22 independent negative checks;
- independent object counts and ACL checks.

## Verification Boundary

No SQL was executed. PostgreSQL grammar, compilation, constraints, Triggers,
ACL Catalog, migration locks and concurrency remain `NOT VERIFIED`.
