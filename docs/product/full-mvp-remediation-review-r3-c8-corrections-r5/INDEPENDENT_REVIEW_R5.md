# FULL-MVP-REMEDIATION-REVIEW-R3-C8-CORRECTIONS-R5

Date: 2026-11-25
Review type: independent, read-only adversarial design review.

## Overall

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 0
P2: 4
P3: 2
```

R5 materially fixes the ROTATION Execute authorization gap and the blocked
expired Attempt. Candidate row audit coverage is also present. The package is
not review-ready because:

- the delivered Function Registry records 128 wrong security modes and 157 wrong
  or missing `search_path` values;
- the response-loss test still writes a hardcoded `"GENERATION:2"` and compares
  that value with itself rather than deriving a first result from the SQL
  transition contract;
- the Candidate backfill Actor tuple is caller-supplied and not bound to the
  executing session/backend;
- most R5 `IND-MUT-*` rows are static predicates, not traceable mutations, and
  the Open Decisions Validator check is not exact;
- documented R5 state-vector IDs do not match evidence IDs;
- Begin samples authoritative time before the final active-Attempt row lock,
  contrary to the design document's ordering.

## Skills Applied

The complete Skill bodies and referenced checklists were read:

- `$project-architecture` and `references/architecture-review.md`;
- `$prisma-db-safety` and `references/database-change-review.md`;
- `$security-audit` and `references/adversarial-review.md`;
- `$testing-and-verification` and `references/verification-matrix.md`;
- `$file-lifecycle` and `references/lifecycle-review.md`.

They were used for boundary preservation, database/transaction constraints,
adversarial authorization and replay analysis, verification separation and
fail-closed lifecycle evidence.

## Input Integrity

R5 Manifest:

```text
513F3CEAE561FD8FEB3A680B2853410BA6022675D24A4246C8C732833DA2239F
Records: 25
Unique paths: 25
Actual files excluding Manifest: 25
Errors: 0
```

Key hashes match the authorization:

```text
P1 design:            766C9D706FCA869351C182606E944411DC1D58A36DB6D9269FE7A7B67FC0E7D9
Complete DDL:         0B4ACA1AC260980741675D3FE87F62E520240263BDA78F20879E84A11C391D2A
Overlay:              9276ABE584F83E7016D57C4DB40887C5C5AC99ECFEFE9A7D9F941D2A03B5B81C
Function Registry:    B523227232D869122D9E346D874755B477C5462954813B3D5D9D6CF33E555B6E
Validation Evidence:  553992905A1A3BBF8465C9BF8D95A5D96790BFCDA3595F139E0966D14D40A97D
```

R4 Review Manifest:

```text
9B6084121907475A29D5C1FC7C9B53FDBD52D908F547741FD2C6730A3428F62C
Records: 16
Errors: 0
```

R4 main report and review evidence:

```text
Main report:      0BB94BED7CC0C1EB55ECF7D856B1B34DF0BE06FE1AEFA900EC8E9823154E147B
Review evidence:  5C7B393CBCCC90B70B8508F296DAF7ACA0F56C85D5CDBB1BADB4CBB2FFC88D6D
```

The earlier authorization transcription `1ADDB` is a transcription error; the
actual file and verified Manifest contain `1BADB`. No historical file was
changed.

## Independent Structural Result

```text
Tables:                         76
Foreign-key declarations:      127
FK structural errors:            0
Final function signatures:     168
Missing function owners:         0
Triggers:                      188
Trigger target/function errors:  0
Roles:                          26
Views:                          17
```

Complete DDL vs Overlay:

```text
Final function signatures match Registry: YES
Function Owners match Registry:           YES (0 mismatches)
Effective grants match Registry:          YES
Security mode matches Registry:            NO (128 mismatches)
search_path matches Registry:              NO (157 mismatches)
```

## Original Five Findings

| Finding | Independent status | Basis |
|---|---|---|
| `REV-R4-IND-P2-01` | `RESOLVED — INDEPENDENT STATIC REVIEW` | Execute current-Root gate, statement-level identity mutex Triggers and Generation insert guard are present in the final definitions |
| `REV-R4-IND-P2-02` | `RESOLVED — INDEPENDENT STATIC REVIEW` | Begin locks an expired Attempt, writes terminal evidence/Event and creates the next Attempt; P3 time-order warning remains |
| `REV-R4-IND-P2-03` | `PARTIALLY RESOLVED` | per-row audit exists and precedes exact updates, but actor identity is not bound to the executing session |
| `REV-R3-R3-P2-03` | `PARTIALLY RESOLVED` | 29/12/46 literal target replay succeeds, but independent replay is 21/22 and response-loss remains hardcoded |
| `REV-R4-IND-P3-01` | `PARTIALLY RESOLVED` | Candidate range and TX-09 repaired, but state-vector IDs still drift |

## New Findings

### P2-01 — Function Registry Security Metadata Is Wrong

The Registry reports `INVOKER` for 128 functions whose final DDL is
`SECURITY DEFINER`, and `search_path=NULL` for 157 functions with an explicit
fixed search path. This is caused by applying an absolute regex match offset to
a sliced segment in `tools/build_function_registry_r5.py`.

Impact: an implementation or security review consuming the Registry would
misclassify function execution identity and search-path hardening. The DDL
source itself contains the intended attributes.

### P2-02 — Response-Loss Evidence Remains Hardcoded

`tools/validate_r5.py` executes:

```python
self.ledger[request_id] = "GENERATION:2"
```

The replay then reads the same string. This violates the explicit requirement
not to substitute a hardcoded result for a state-derived business result.

### P2-03 — Candidate Backfill Actor Is Not Bound to the Executor

`app_private.execute_candidate_backfill_r5` accepts
`p_actor_principal_id`, `p_actor_session_id` and
`p_actor_authority_grant_id`, but never compares them with `session_user`,
`lock_current_session()`, a backend PID/start tuple, or another bound execution
identity. It verifies only that the supplied rows are active.

Current PUBLIC/role access is revoked, so the operation is fail-closed today.
Any future maintenance grant could attribute immutable-row changes to another
valid actor.

### P2-04 — Independent Negative Evidence Is Not Mutation-Traceable

The 22 `IND-MUT-*` rows expose only ID, basis and boolean result. They do not
record a target mutation, expected changed result, or observed fail-to-pass
transition. In addition, the R5 Validator's Open Decisions check accepts
`>=57` regex matches rather than exactly 57 unique OPEN IDs with zero approvals.

### P3-01 — R5 State-Vector IDs Drift

Documented IDs:

```text
R5-STATE-EXPIRED-REPLACED
R5-STATE-RESPONSE-LOSS
R5-STATE-REVOKED-APPROVAL
R5-STATE-REVOKED-ROOT
R5-STATE-SINGLE-ACTIVE
```

Evidence IDs:

```text
expired_active_attempt_replaced
response_loss_replay_non_vacuous
revoked_approval_cannot_execute
revoked_root_cannot_execute
single_active_attempt
```

No exact ID mapping exists in either registry.

### P3-02 — Begin Time Is Sampled Before the Final Attempt Lock

Begin evaluates `v_now:=clock_timestamp()` before:

```sql
SELECT * INTO v_active ... FOR UPDATE;
```

The shared identity mutex currently serializes the public Recovery commands,
so no reachable public race was found. The documented lock/time order is still
false, and a future direct-DML or lock-order change could preserve a stale
expiry decision.

## Mutation Results

```text
R3 formal literal target mutations:      29/29 applied to final document
R2 historical literal target mutations:  12/12 applied to final document
R4 semantic literal target mutations:    46/46 applied to final document
Independent negative checks:             21/22 passed
```

These are not PostgreSQL execution results. `IND-MUT-22` fails because the
provided replay vector is hardcoded.

## Historical and Open Decisions

All R2/R3/R4 findings were traced. Earlier V1/V2/V3 issues remain resolved only
within their documented static scope.

```text
Open Decision IDs: 57
Unique:            57
User-approved:     0
Still OPEN:        57
```

Identity Broker, role topology, Root provisioning, credential custody,
recovery retry policy, break-glass, Candidate maintenance identity and evidence
retention remain implementation blockers.

## Runtime Boundary

```text
Static Structural Review: COMPLETED
State Machine Simulation: COMPLETED (OFFLINE ONLY)
PostgreSQL Grammar:       NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER
PostgreSQL Compilation:   NOT VERIFIED — DATABASE NOT AUTHORIZED
Catalog Introspection:    NOT VERIFIED — DATABASE NOT AUTHORIZED
Migration Lock Behavior:  NOT VERIFIED — DATABASE NOT AUTHORIZED
Runtime Concurrency:      NOT VERIFIED — RUNTIME NOT AUTHORIZED
```

## Decision

`FAIL — DESIGN CORRECTIONS REQUIRED`

Only separately authorized design corrections may follow. This review does not
authorize R6, Schema, Prisma, Migration, SQL, Build, Runtime, Storage or
deployment.

