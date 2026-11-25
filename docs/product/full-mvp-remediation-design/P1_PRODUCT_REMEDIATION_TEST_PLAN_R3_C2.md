# P1 Product Remediation Test Plan R3-C2

Status:

```text
DESIGN-TIME TEST PLAN
NO TEST EXECUTED
NO DATABASE CONNECTED
NO RUNTIME AUTHORIZED
```

All tests are future, isolated-test-database or fixture tests. The test plan
does not authorize implementation.

## 1. Execution Rules

- Test DB operations only on an explicitly authorized isolated clone after the
  project test database identity, role, marker and reset gates pass.
- Use separate database connections for concurrency and deferred checks.
- Every database invariant gets a direct SQL negative test where possible.
- Assert rejected row, final state, pointer state and absence of audit/effect
  side effects.
- For event-only states, compare the current view with the latest event.
- For `R3-BASIS-1`, compare exact bytes and SHA-256, not only a boolean
  equality.
- Invalid UTF-8, oversized values, duplicate stable keys and type mismatches
  must be rejected before hashing.
- Do not execute tests, SQL, migrations, builds, Storage or Runtime in this
  phase.

## 2. Requirement and Typed Value Tests

| ID | Finding | Preconditions and input | Operation / expected DB result | Acceptance |
|---|---|---|---|---|
| `C2-SRC-01` | Parent key | RequirementVersion with `UNIQUE(id,requirementId,projectId,conversationId)` and scenario variant | create Assertion and FieldValue using that exact key | both FKs validate; migration on empty clone succeeds |
| `C2-SRC-02` | Cross-requirement assertion | Requirements R1/R2, versions V1/V2 | insert V1 FieldValue with V2 Assertion | composite FK failure; no value row |
| `C2-SRC-03` | Cross-conversation message | C1/C2, messages M1/M2 | insert C1 assertion with M2 | composite FK failure; no assertion |
| `C2-SRC-04` | Typed value mismatch | BOOLEAN field | write text value into BOOLEAN column/type | CHECK failure; no FieldValue |
| `C2-SRC-05` | Multiple typed columns | one assertion row | set BOOLEAN and INTEGER values together | CHECK failure |
| `C2-SRC-06` | Conditional without condition | conditional assertion | omit conditionJson | CHECK failure |
| `C2-SRC-07` | Confirmed without evidence | field status CONFIRMED | omit confirmation event/source | CHECK/trigger failure |
| `C2-SRC-08` | Superseded reuse | old assertion SUPERSEDED | resolve new value from old assertion | trigger/function rejects or resolves only current |
| `C2-SRC-09` | JSON override | valid FieldValue | direct write legacy JSON projection different value | trigger failure; selection uses FieldValue |
| `C2-SRC-10` | Scenario mismatch | P1/C1/R1 | insert v2 with P2 scenario | composite key/FK failure |
| `C2-SRC-11` | Wrong message author | user U1, message authored U2 | insert assertion createdBy U1 | equality trigger/user FK failure |
| `C2-SRC-12` | NULL source bypass | USER_ASSERTION | omit sourceMessageId/sourceAssertionId/sourceKey | NOT NULL/CHECK failure |
| `C2-SRC-13` | SourceKey mismatch | FieldValue F source A1 | write sourceKey=A2 | CHECK/composite FK failure |
| `C2-SRC-14` | Actor spoofing | request body claims another actor | normal command | server actor wins; trusted column unchanged |
| `C2-SRC-15` | Correction history | confirmed v1 | correct value in v2 | v1 unchanged; v2 source and confirmation valid |

## 3. RuleSet Review Tests

| ID | Finding | Preconditions and input | Operation / expected DB result | Acceptance |
|---|---|---|---|---|
| `C2-RULE-01` | No-event approval | R1 content, policy P1 | direct SQL sets any status field to APPROVED | no status truth column; event view remains non-approved |
| `C2-RULE-02` | Event wrong revision | R1/R2 | insert event for R2 with R1 key | composite FK/trigger failure |
| `C2-RULE-03` | Policy mismatch | event P1 | bind review to P2 policy | FK/check/function failure |
| `C2-RULE-04` | Direct status mutation | approved event exists | update/delete event or current view | privilege/trigger rejection |
| `C2-RULE-05` | Concurrent approve/revoke | one revision, two reviewers | concurrent transition calls | one winner; one conflict; one final event |
| `C2-RULE-06` | Duplicate sequence | event sequence 1 | insert same sequence | unique failure |
| `C2-RULE-07` | Duplicate approval | concurrent APPROVE requests with same request id | one event; replay returns same result | no second event |
| `C2-RULE-08` | Old run immutable | run R1 | create R2 | R1 run still references R1 |
| `C2-RULE-09` | No event formal | R1 unapproved | formal evaluate | `REQUIRES_PROFESSIONAL_REVIEW`; no Operational |
| `C2-RULE-10` | Source verification | R1 source S1 | subsequent negative verification | formal resolver excludes R1 |

## 4. ProfessionalReview Tests

| ID | Finding | Preconditions and input | Operation / expected DB result | Acceptance |
|---|---|---|---|---|
| `C2-PRO-01` | Direct state overwrite | current event IN_REVIEW | direct SQL attempts to update a state field | no mutable state field; event view remains IN_REVIEW |
| `C2-PRO-02` | Current/event divergence | event sequence 2 | compare `professional_review_current` to latest event | exact state/version match |
| `C2-PRO-03` | Delete last event | APPROVED event | direct DELETE | append-only rejection |
| `C2-PRO-04` | Previous-state mismatch | latest state IN_REVIEW | insert event claiming SUBMITTED previous | function/trigger rejection |
| `C2-PRO-05` | Duplicate sequence | sequence 3 | insert sequence 3 | unique rejection |
| `C2-PRO-06` | Event no projection | IN_REVIEW | inject failure after event insert simulation | transaction rollback; no event/view state |
| `C2-PRO-07` | Two approvers | SUBMITTED | concurrent approve operations | one event sequence; one conflict |
| `C2-PRO-08` | Approve vs invalidate | IN_REVIEW | concurrent approve and source withdrawal | no approved stale basis; exactly one legal result |
| `C2-PRO-09` | Policy change race | review P1 | P2 effective while approving | P2 cannot silently approve P1; review invalidated/blocked |
| `C2-PRO-10` | Commit unknown | transition committed, response lost | query new connection | exact prior event; no duplicate |
| `C2-PRO-11` | Basis mismatch | candidate C1 | review event uses C2 basis | composite FK/trigger failure |
| `C2-PRO-12` | Source set mismatch | candidate source set S1 | review source basis S2 | deferred set-equality failure |

## 5. Snapshot Source and Completeness Tests

| ID | Finding | Preconditions and input | Operation / expected DB result | Acceptance |
|---|---|---|---|---|
| `C2-SNP-01` | Source assertion mismatch | FieldValue F source A1; A2 valid same version | snapshot row F + A2/sourceKey A2 | exact parent key/CHECK failure |
| `C2-SNP-02` | NULL source bypass | USER_ASSERTION F | snapshot sourceKey NULL | NOT NULL failure |
| `C2-SNP-03` | Wrong source kind | sourceKind USER_ASSERTION | fill only catalog evidence source | CHECK failure |
| `C2-SNP-04` | Copied field mismatch | source FieldValue v=true | snapshot copies false/status changed | deferred copy/check failure |
| `C2-SNP-05` | Candidate completeness | SelectionRun with 3 candidates | create snapshot omitting one | deferred completeness failure |
| `C2-SNP-06` | Duplicate candidate | same run/candidate | insert second snapshot item | unique failure |
| `C2-SNP-07` | Case/project mismatch | Case P1, snapshot P2 | direct insert | composite FK failure |
| `C2-SNP-08` | Requirement/version mismatch | run based V2, label V1 | direct insert | composite FK failure |
| `C2-SNP-09` | Price/product mismatch | product A, price B | insert item | FK/check failure |
| `C2-SNP-10` | Source/product mismatch | candidate A, source B | insert snapshot source | FK/trigger failure |
| `C2-SNP-11` | Forged basis digest | valid rows | set wrong digest | deferred digest failure |
| `C2-SNP-12` | Payload dual write | valid snapshot | direct payload insert/update | no payload authority; rejected/ignored |
| `C2-SNP-13` | Snapshot immutability | snapshot exists | update/delete header/item/source | trigger/privilege failure |
| `C2-SNP-14` | Source withdrawal | snapshot v1 | withdraw source | snapshot unchanged; stale diff only |
| `C2-SNP-15` | Snapshot/source race | active run/source | create snapshot and withdraw concurrently | one complete basis or failure |
| `C2-SNP-16` | Failed snapshot | run/case valid | inject item failure | no header/items/pointer/audit |

## 6. Scenario and Idempotency Tests

| ID | Finding | Preconditions | Input and expected DB result | Acceptance |
|---|---|---|---|---|
| `C2-SCN-01` | NULL scenario | migrated Project | NULL installationScenario | NOT NULL/CHECK failure |
| `C2-SCN-02` | Mapping mismatch | legacy ProjectType | wrong scenario pair | CHECK failure |
| `C2-SCN-03` | Update after conversation | project with conversation | scenario update | trigger failure; history unchanged |
| `C2-SCN-04` | Change/create race | no conversation | update and create concurrently | one wins; no mixed child |
| `C2-SCN-05` | Unmappable legacy | ambiguous row | preflight/backfill | quarantine row; no guessed chain |
| `C2-IDEM-01` | Same key same conversation | committed request | retry after lost response | exact prior response; one request |
| `C2-IDEM-02` | Same key different payload | committed request | changed content | 409; no second mutation |
| `C2-IDEM-03` | Same key different actor | committed request | other actor | deny/404; no response leak |
| `C2-IDEM-04` | Same key different conversation | C1 request | replay in C2 | no cross-conversation resolution |
| `C2-IDEM-05` | Business failure | deterministic rejection | write failure-recording transaction | one explicit FAILED row; no business IDs |
| `C2-IDEM-06` | Rollback | injected DB failure | whole operation | no request/message/version rows |
| `C2-IDEM-07` | Commit unknown | response lost after commit | query new connection | exact prior key; no duplicate |

## 7. R3-BASIS-1 Vector Tests

The following are **valid fixed vectors**. `Field`, `Record` and `Basis` are
hexadecimal bytes. Every record uses record type `0001`, row UUID
`00000000000000000000000000000001` except V21–V23 use row UUID ending `02`.
The basis header is the exact format in the main design.

```text
V01 input=NULL canonical=NULL field=0001000000000000 record=0000002900010000000000000000000000000000000100000005766563303100010001000000000000 basis=5233424153495300000200010000001C0000000100000000000000290000002900010000000000000000000000000000000100000005766563303100010001000000000000 sha=711926F9476841CD9A688680BF8E7CA7E4D77BD212C46955D0A96C3EFE5233EC
V02 input="" canonical="" field=0001040000000000 record=0000002900010000000000000000000000000000000100000005766563303200010001040000000000 basis=5233424153495300000200010000001C0000000100000000000000290000002900010000000000000000000000000000000100000005766563303200010001040000000000 sha=DDE3F6F0A7B873AC7D95F82E51F5D66138F2C781E795BABE1103D7AC6BFF5674
V03 input=empty-bytes canonical=empty-bytes field=0001080100000000 record=0000002900010000000000000000000000000000000100000005766563303300010001080100000000 basis=5233424153495300000200010000001C0000000100000000000000290000002900010000000000000000000000000000000100000005766563303300010001080100000000 sha=542D2E6CC6490393D7774B498FF21E0CEDF79CC0247D52D59F2EF36695A271C8
V04 input=true canonical=true field=000101010000000101 record=0000002A0001000000000000000000000000000000010000000576656330340001000101010000000101 basis=5233424153495300000200010000001C00000001000000000000002A0000002A0001000000000000000000000000000000010000000576656330340001000101010000000101 sha=B89405D3564EE4657E4270EC081DEFB7A4BA8783E8F4001BADE2B5F901E09D6C
V05 input=false canonical=false field=000101010000000100 record=0000002A0001000000000000000000000000000000010000000576656330350001000101010000000100 basis=5233424153495300000200010000001C00000001000000000000002A0000002A0001000000000000000000000000000000010000000576656330350001000101010000000100 sha=01F58F9C2AB6C59BE23C48157F19DF430FF0B7695C47F9D27DC34B9BEA3E5AF0
V06 input=42 canonical=42 field=0001020100000008000000000000002A record=0000003100010000000000000000000000000000000100000005766563303600010001020100000008000000000000002A basis=5233424153495300000200010000001C0000000100000000000000310000003100010000000000000000000000000000000100000005766563303600010001020100000008000000000000002A sha=73652371EC27EF37B145E138D4E3FCBB5164CE4AF886D520B40A3E24B3F8395D
V07 input=-42 canonical=-42 field=0001020100000008FFFFFFFFFFFFFFD6 record=0000003100010000000000000000000000000000000100000005766563303700010001020100000008FFFFFFFFFFFFFFD6 basis=5233424153495300000200010000001C0000000100000000000000310000003100010000000000000000000000000000000100000005766563303700010001020100000008FFFFFFFFFFFFFFD6 sha=B5FB4A69A9563E8010F61AE548D0F6BDC3754AE2F2E309B46ABB8582788CC143
V08 input=9223372036854775807 canonical=same field=00010201000000087FFFFFFFFFFFFFFF record=00000031000100000000000000000000000000000001000000057665633038000100010201000000087FFFFFFFFFFFFFFF basis=5233424153495300000200010000001C00000001000000000000003100000031000100000000000000000000000000000001000000057665633038000100010201000000087FFFFFFFFFFFFFFF sha=3902FE74396193EEECF63F9729D388C457C8F4052B2F67FE9E6EBADE86632394
V09 input=-9223372036854775808 canonical=same field=00010201000000088000000000000000 record=00000031000100000000000000000000000000000001000000057665633039000100010201000000088000000000000000 basis=5233424153495300000200010000001C00000001000000000000003100000031000100000000000000000000000000000001000000057665633039000100010201000000088000000000000000 sha=40DF98F028EC2334EB9AB6EBD6F3F82F7109D9D13E85B0A0D3820C5E9EE6BB41
V10 input=0.0 canonical=0 field=000103010000000130 record=0000002A0001000000000000000000000000000000010000000576656331300001000103010000000130 basis=5233424153495300000200010000001C00000001000000000000002A0000002A0001000000000000000000000000000000010000000576656331300001000103010000000130 sha=7D67B84A32AF8A19B6962ACF29FC843169F6925D72BB143D43BC8109BC509921
V11 input=12.5 canonical=12.5 field=000103010000000431322E35 record=0000002D0001000000000000000000000000000000010000000576656331310001000103010000000431322E35 basis=5233424153495300000200010000001C00000001000000000000002D0000002D0001000000000000000000000000000000010000000576656331310001000103010000000431322E35 sha=B177CBD35F96C678B42BCE168744C8D6D1E521CA3D345D7E5167C0953BAD1F54
V12 input=-12.5 canonical=-12.5 field=00010301000000052D31322E35 record=0000002E000100000000000000000000000000000001000000057665633132000100010301000000052D31322E35 basis=5233424153495300000200010000001C00000001000000000000002E0000002E000100000000000000000000000000000001000000057665633132000100010301000000052D31322E35 sha=20D5FBE51F0A9D33CE374586452036D8D1A6036CA8EE4499C87C00E603752933
V13 input=12.50 canonical=12.5 field=000103010000000431322E35 record=0000002D0001000000000000000000000000000000010000000576656331330001000103010000000431322E35 basis=5233424153495300000200010000001C00000001000000000000002D0000002D0001000000000000000000000000000000010000000576656331330001000103010000000431322E35 sha=F433B2C4935CCFEB42E4A747E0ADF06723625B85DC69CB65F13E8D1C2D87281D
V14 input=abc canonical=abc field=0001040100000003616263 record=0000002C00010000000000000000000000000000000100000005766563313400010001040100000003616263 basis=5233424153495300000200010000001C00000001000000000000002C0000002C00010000000000000000000000000000000100000005766563313400010001040100000003616263 sha=5A3DA85B005DD01733F2EB485D8B624E69A5E26AE100F77113C20C667604C799
V15 input=电梯 canonical=电梯 field=0001040100000006E794B5E6A2AF record=0000002F00010000000000000000000000000000000100000005766563313500010001040100000006E794B5E6A2AF basis=5233424153495300000200010000001C00000001000000000000002F0000002F00010000000000000000000000000000000100000005766563313500010001040100000006E794B5E6A2AF sha=1A070F9E4709C571A00F8D8746D39A93F4D76033E392E87A2F2DC0DAAE042B55
V16 input=00000000-0000-0000-0000-000000000001 canonical=UUID-bytes field=000106010000001000000000000000000000000000000001 record=000000390001000000000000000000000000000000010000000576656331360001000106010000001000000000000000000000000000000001 basis=5233424153495300000200010000001C000000010000000000000039000000390001000000000000000000000000000000010000000576656331360001000106010000001000000000000000000000000000000001 sha=C4F70292859E1467A86A3458495286B42F89B9F8AD30263B0384B6A2D47CDEE4
V17 input=1970-01-01T00:00:00.000Z canonical=epoch-ms-0 field=00010701000000080000000000000000 record=00000031000100000000000000000000000000000001000000057665633137000100010701000000080000000000000000 basis=5233424153495300000200010000001C00000001000000000000003100000031000100000000000000000000000000000001000000057665633137000100010701000000080000000000000000 sha=60E0389D0297FD44502E3FE836244AE40DB237C557EBF219F88D64EF099C480E
V18 input=1970-01-01T00:00:00.001Z canonical=epoch-ms-1 field=00010701000000080000000000000001 record=00000031000100000000000000000000000000000001000000057665633138000100010701000000080000000000000001 basis=5233424153495300000200010000001C000000010000000000000031000000310001000000000000000000000000000001000000057665633138000100010701000000080000000000000001 sha=12C8F7CDC5AC381EC0A5D9E807B04CD0C666D11675EE1F53131208B71A2D344D
V19 input=[] canonical=empty-list field=00010901000000050100000000 record=0000002E000100000000000000000000000000000001000000057665633139000100010901000000050100000000 basis=5233424153495300000200010000001C00000001000000000000002E0000002E000100000000000000000000000000000001000000057665633139000100010901000000050100000000 sha=48A8F839131D1B65D26F39AA932A597FB228A439D9B691E913D03E0B54BE056A
V20 input=[2,1] canonical=[1,2] field=000109010000000F010000000200000001010000000102 record=000000380001000000000000000000000000000000010000000576656332300001000109010000000F010000000200000001010000000102 basis=5233424153495300000200010000001C000000010000000000000038000000380001000000000000000000000000000000010000000576656332300001000109010000000F010000000200000001010000000102 sha=5AB694C81D63B4B3C3BA2DFA2890FFF3AD6AAA654E42DB4E3D428BCD3985A352
V21 input=integer 1 canonical=integer 1 field=000102010000000131 record=00000028000100000000000000000000000000000002000576656332310001000102010000000131 basis=5233424153495300000200010000001C00000001000000000000002800000028000100000000000000000000000000000002000576656332310001000102010000000131 sha=52BCF54A32DA790BC8963DD66D20AC9CF64148446AC38AEA485B6342E9779433
V22 input=text "1" canonical=text 1 field=000104010000000131 record=00000028000100000000000000000000000000000002000576656332320001000104010000000131 basis=5233424153495300000200010000001C00000001000000000000002800000028000100000000000000000000000000000002000576656332320001000104010000000131 sha=EB85342534322F2761AD81E163893A8438632CC5B050F9E726C4EAC113154FDB
V23 input=decimal 1 canonical=decimal 1 field=000103010000000131 record=00000028000100000000000000000000000000000002000576656332330001000103010000000131 basis=5233424153495300000200010000001C00000001000000000000002800000028000100000000000000000000000000000002000576656332330001000103010000000131 sha=1D6D13B6F7528F6B115C15ECE11E68B7EFFD1303DE72537EF346EE56B1EFF040
V24 input=invalid UTF-8 C3 28 canonical=REJECT | no field/record/basis bytes | expected failure: invalid UTF-8 before hashing
V25 input=text length 1,048,577 bytes canonical=REJECT | expected failure: length exceeds 1 MiB
V26 input=duplicate (recordType=0001,stableKey=vec01) canonical=REJECT | expected failure: duplicate stable key
```

For each valid vector, an application encoder and an independent database-side
encoder must produce identical `field`, `record`, `basis` and SHA-256 bytes.
Invalid vectors must be rejected before a digest is created.

## 8. P2-A through P2-E Coverage

| Group | Test coverage |
|---|---|
| P2-A `REV-R2-P2-01` | `C2-SCN-01`–`C2-SCN-05`; direct SQL checks NOT NULL, mapping, immutable scenario and race behavior |
| P2-B `REV-R2-P2-02` | `C2-RULE-01`–`C2-RULE-10`; event-only status and exact revision binding |
| P2-C `REV-R2-P2-03` | `C2-IDEM-01`–`C2-IDEM-07`; conversation/actor/message/version and failed/commit-unknown semantics |
| P2-D `REV-R2-P2-04` | `C2-PRO-09`, `C2-RULE-03`, vector policy inputs; exact immutable policy revision |
| P2-E `REV-R2-P2-05` | All direct DB tests plus V01–V26; no test is API-only |

## 9. Completion Gate

```text
Every composite FK has a verified exact parent UNIQUE/PK: REQUIRED
Every typed value has one typed column and an explicit null rule: REQUIRED
RuleSet current status is event-derived only: REQUIRED
ProfessionalReview current state is event-derived only: REQUIRED
All valid R3-BASIS-1 vectors produce exact expected bytes/hash: REQUIRED
Two independent encoders match: REQUIRED
Snapshot sourceKey/FieldValue relation is exact: REQUIRED
No source/Storage/P1-3 operation is mixed into these tests: REQUIRED
No database/Runtime test may run without separate authorization: REQUIRED
```
