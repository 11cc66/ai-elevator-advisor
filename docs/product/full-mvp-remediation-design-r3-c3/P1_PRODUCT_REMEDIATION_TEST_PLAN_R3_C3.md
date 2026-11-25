# P1 Product Remediation Test Plan R3-C3

Status:

```text
DESIGN-TIME TEST PLAN
NO TEST, DATABASE OR RUNTIME EXECUTED
```

## 1. Test Rules

- Database tests run only on an isolated authorized clone after identity and
  reset gates pass.
- Direct DB negative tests use a transaction/savepoint and assert the exact
  rejection point and final rollback state.
- Each concurrency test uses two real connections and records the winner,
  loser, event sequence, pointer and absence of side effects.
- `R3_BASIS_V3_FIXED_VECTORS.md` supplies the byte-level expected values.
- A vector that is not byte-identical is `NOT REPRODUCIBLE`, never a partial
  pass.
- All tests are design claims until independently executed.

## 2. Requirement and Typed Values

| ID | Finding | Preconditions / input | Operation | Expected DB result | Failure assertion |
|---|---|---|---|---|---|
| `C3-SRC-01` | exact parent key | V1 RequirementVersion with exact 4/5-column keys | insert Assertion and FieldValue with mismatched version/requirement | composite FK rejection; no row | accepted mismatched row |
| `C3-SRC-02` | user source ownership | C1/M1/F1, C2/M2/F2 | FieldValue C1 with M2 assertion | FK rejection | cross-conversation accepted |
| `C3-SRC-03` | typed value | BOOLEAN/TEXT/INTEGER | set wrong typed column or two columns | CHECK rejection | mixed value accepted |
| `C3-SRC-04` | conditional | conditionJson NULL | set `fieldStatus=CONDITIONAL` | CHECK rejection | conditionless value accepted |
| `C3-SRC-05` | confirmation | CONFIRMED without confirmationEventId | direct insert/update | CHECK failure | confirmed without evidence |
| `C3-SRC-06` | sourceKey | USER_ASSERTION A1 | sourceKey points A2 | exact parent/CHECK failure | wrong sourceKey accepted |
| `C3-SRC-07` | correction history | old assertion SUPERSEDED | reuse it | resolution/trigger rejects | old source reused |
| `C3-SRC-08` | JSON projection | authoritative v | direct update legacy JSON | projection rejected/ignored | selection reads JSON |
| `C3-SRC-09` | CUID source | current CUID IDs | insert sourceKey `assertion:<cuid>` | exact FK success | UUID-cast accepted |
| `C3-SRC-10` | actor spoof | request contains actor ID | normal command | server actor stored | client actor accepted |
| `C3-SRC-11` | legacy quarantine | unknown source | import attempt | quarantine row, no FieldValue | silently mapped |

## 3. ProfessionalReview Source and State

| ID | Finding | Preconditions | Operation | Expected DB result | Failure assertion |
|---|---|---|---|---|---|
| `C3-PRO-01` | same requirement event | P1/R1/V1 event E | FieldValue R2 references E | six-column FK failure | cross-requirement event |
| `C3-PRO-02` | same version | V1 event | V2 FieldValue references it | FK failure | cross-version event |
| `C3-PRO-03` | exact review parent | Event reviewR | event claims wrong project/request | composite/function failure | mismatched parent |
| `C3-PRO-04` | policy | event P1 | FieldValue/review basis P2 | policy FK/transition failure | stale policy accepted |
| `C3-PRO-05` | direct state | active event | UPDATE/DELETE event | append-only rejection | event changed |
| `C3-PRO-06` | sequence | sequence 3 exists | insert sequence 3 | unique rejection | branch created |
| `C3-PRO-07` | predecessor | latest IN_REVIEW | event claims SUBMITTED previous | function/trigger failure | invalid history |
| `C3-PRO-08` | two approvers | SUBMITTED | concurrent APPROVE | one event; one conflict | two approvals |
| `C3-PRO-09` | approve/invalidate | IN_REVIEW | concurrent approve/source withdrawal | one legal final event; no stale approval | stale approval survives |
| `C3-PRO-10` | commit unknown | transition committed, response lost | new connection read | exact prior event | duplicate/uncertain state |

## 4. RuleSet Event and Identity

| ID | Finding | Preconditions | Operation | Expected DB result | Failure assertion |
|---|---|---|---|---|---|
| `C3-RULE-01` | no-event approval | R1 | direct insert approval event/status bypass | event-only view remains non-approved | direct APPROVED |
| `C3-RULE-02` | wrong revision | R1/R2 | event R2 with R1 key | composite FK failure | cross-revision approval |
| `C3-RULE-03` | wrong policy | R1 | event with P2 | policy/function failure | policy drift |
| `C3-RULE-04` | concurrent status | R1 | approve/revoke concurrent | one event sequence winner | conflicting current state |
| `C3-RULE-05` | direct event mutate | event exists | UPDATE/DELETE | append-only rejection | event modified |
| `C3-RULE-06` | old run | run R1, rule R2 | read run | R1 remains exact | current rule substituted |

## 5. Snapshot and Completeness

| ID | Finding | Preconditions | Operation | Expected DB result | Failure assertion |
|---|---|---|---|---|---|
| `C3-SNP-01` | source FieldValue | FieldValue F source A1 | Snapshot uses F + A2 | exact sourceKey FK failure | wrong assertion |
| `C3-SNP-02` | source kind | USER_ASSERTION | submit catalog evidence source | CHECK/FK failure | mixed source |
| `C3-SNP-03` | event inheritance | professional event E1 | Snapshot uses another event | event source FK failure | cross-version event |
| `C3-SNP-04` | candidate completeness | run 3 candidates | omit one candidate | deferred COMMIT failure | partial snapshot |
| `C3-SNP-05` | duplicate candidate | run candidate | insert twice | unique failure | duplicate item |
| `C3-SNP-06` | exact case | case P1 | snapshot P2 | composite FK failure | cross-project snapshot |
| `C3-SNP-07` | exact run/version | run V1 | snapshot labels V2 | FK failure | mixed versions |
| `C3-SNP-08` | sole authority | valid snapshot | direct payload write | no payload authority | dual payload truth |
| `C3-SNP-09` | digest | valid normalized rows | alter basisDigest | deferred digest failure | forged digest |
| `C3-SNP-10` | immutable | snapshot | update/delete child | trigger/privilege failure | history mutated |
| `C3-SNP-11` | source withdrawal | snapshot v1 | withdraw source | snapshot unchanged; stale diff | snapshot changed |
| `C3-SNP-12` | source/snapshot race | run/source | create/withdraw concurrent | complete or fail, no mixed basis | partial evidence |
| `C3-SNP-13` | failed create | run/case | inject child failure | no header/items/pointer/audit | partial commit |

## 6. ID Migration and Identity

| ID | Finding | Preconditions | Operation | Expected DB result | Failure assertion |
|---|---|---|---|---|---|
| `C3-ID-01` | CUID preservation | existing CUID row | migrate | same ID and sourceKey prefix | UUID conversion |
| `C3-ID-02` | sourceKey prefix | all source kinds | insert wrong prefix | CHECK/FK failure | mismatched source |
| `C3-ID-03` | legacy ambiguous | unknown source | preflight | quarantine row, no typed fact | guessed source |
| `C3-ID-04` | rollback boundary | real backfill committed | simulate rollback | no inferred old JSON; quarantine retained | data loss |
| `C3-ID-05` | ID collision | existing CUID | import same ID different record | unique/identity failure | duplicate identity |
| `C3-ID-06` | CUID vs UUID | CUID source | attempt UUID equality path | text FK succeeds only canonical prefix; no cast bypass | implicit cast |

## 7. R3-BASIS-1 Revision 3

### 7.1 Valid vectors

Execute V01–V23 in `R3_BASIS_V3_FIXED_VECTORS.md`. For each:

```text
input -> canonical typed values -> field bytes -> record bytes
      -> complete basis bytes -> SHA-256
```

Assert exact field/record/basis hex and expected hash. V22/V23 must be
byte-identical despite opposite input record order. V21 must canonicalize
fields to tag order.

### 7.2 Rejection vectors

| ID | Finding | Input | Required result |
|---|---|---|---|
| `C3-BASIS-24` | invalid UTF-8 | `C3 28` | reject before hash |
| `C3-BASIS-25` | oversized text | 1,048,577 bytes | reject before hash |
| `C3-BASIS-26` | duplicate stableKey | same record stable key | reject before hash |

### 7.3 Independent implementations

Implementation A and B must be separately coded and use different languages:

- A: application-side encoder;
- B: independent protocol parser/encoder or database-side verifier.

Assert:

```text
VALID_VECTOR_COUNT >= 23
ALL_VALID_BYTE_IDENTICAL = TRUE
ALL_REJECTIONS = TRUE
MULTI_RECORD = TRUE
MULTI_FIELD = TRUE
```

## 8. Concurrency, Idempotency and COMMIT Unknown

| ID | Finding | Test | Expected final state |
|---|---|---|---|
| `C3-CT-01` | requirement CAS | two PATCH same version | one version, one 409 |
| `C3-CT-02` | scenario race | project update vs conversation create | no mixed scenario |
| `C3-CT-03` | review race | two reviewers claim/decide | one event, one conflict |
| `C3-CT-04` | policy race | approve vs policy change | no stale approval |
| `C3-CT-05` | snapshot race | create vs withdrawal | complete basis or rollback |
| `C3-CT-06` | idempotent success | same key retry | exact prior response |
| `C3-CT-07` | idempotent conflict | same key different payload | 409, no second mutation |
| `C3-CT-08` | commit unknown | request/transition commit response lost | new connection re-read, no duplicate |
| `C3-CT-09` | unexpected rollback | injected DB failure | no request/business rows |
| `C3-CT-10` | failed record | deterministic rejection | one explicit failure record, no effect |

## 9. Completion Gate

```text
P1-01 basis protocol and vectors: PASS REQUIRED
P1-02 ProfessionalReview ownership: PASS REQUIRED
P1-03 canonical Text/CUID identity: PASS REQUIRED
P2-01 typed SQL catalogue: PASS REQUIRED
P2-02 multi-record/multi-field vectors: PASS REQUIRED
P2-03 quarantine: PASS REQUIRED
P2-04 transition permissions: PASS REQUIRED
Direct DB negative tests: PASS REQUIRED
Two independent implementations: PASS REQUIRED
P1-3 isolation: REQUIRED
No implementation authorization: REMAINS
```
