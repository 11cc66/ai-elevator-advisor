# P1 Product Remediation Test Plan R3

Status:

```text
DESIGN-TIME TEST PLAN
NO TEST EXECUTED
DATABASE AUTHENTICATION: NOT CONNECTED
RUNTIME: NOT AUTHORIZED
```

## 1. Execution Rules

- Run database tests only on an explicitly authorized isolated clone after the
  existing test database identity, role, marker and `ALLOW_TEST_DB_RESET` gates
  pass.
- Use separate connections for concurrency and deferred-constraint tests.
- Assert the final database rows and absence of side effects, not only HTTP 200.
- Treat trigger, deferred constraint, isolation-level and COMMIT behavior as
  database behavior requiring real DB evidence.
- Use synthetic `DEMO_MOCK` evidence and test data only.
- Do not use the P1-3 lifecycle, test storage, real Storage or customer files.
- Do not mark a test passed until the stated stop condition and final-state
  assertions are observed.
- P1-3 tests are outside this plan and cannot close product findings.

## 2. Requirement Provenance

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-SRC-01` | Value cannot source another requirement | project P, conversations C1/C2, requirements R1/R2 | insert FieldValue in R1 with `sourceAssertionId` from R2 under direct DB role | N/A | FK violation; no value row | row accepted | `REV-R2-P1-01` |
| `R3-SRC-02` | Assertion message must be same conversation | valid C1/C2 and messages M1/M2 | insert assertion in C1 with M2 | N/A | composite FK violation | accepted | `REV-R2-P1-01` |
| `R3-SRC-03` | RequirementVersion cannot cross stable Requirement | R1/R2 | insert version with R1 requirementId and version fields from R2 | N/A | composite FK violation | accepted | `REV-R2-P1-01` |
| `R3-SRC-04` | Project A conversation cannot reference Project B requirement | P1/C1/R1, P2/R2 | update C1 current pointer to R2 version | N/A | pointer FK violation; old pointer unchanged | accepted | `REV-P1-02` |
| `R3-SRC-05` | Correct IDs with wrong combination rejected | all entities exist | direct SQL insert/update with individually valid IDs from different parents | N/A | exact composite FK failure | accepted | `REV-R2-P1-01` |
| `R3-SRC-06` | NULL cannot bypass message ownership | message-source assertion | attempt NULL sourceMessageId and a non-message type with message ID | N/A | CHECK violation; no assertion | accepted | `REV-R2-P1-01` |
| `R3-SRC-07` | Correction appends and preserves old source | confirmed v1 | correct external installation in v2 | 200/new version | v1 rows unchanged; v2 points to new message; pointer v2 | old assertion overwritten or reused | `REV-P1-01/03` |
| `R3-SRC-08` | Confirmed value only uses resolved assertion | unresolved condition | try confirm/resolve field | structured confirmation state | no resolved FieldValue; old version remains | value created | `REV-P1-01` |
| `R3-SRC-09` | Conflict retains all candidate assertions | two contradictory messages | parse both | conflict response | conflict + normalized candidate joins; no value | one candidate deleted | `REV-P1-01` |
| `R3-SRC-10` | Client cannot supply trusted provenance | customer edit request | send source IDs/actor fields in payload | rejected/ignored | no trusted source columns changed | client source accepted | `REV-P1-03` |
| `R3-SRC-11` | Concurrent requirement edits serialize | current v3 | two clients PATCH expected v3 | one 200, one 409 | one new version and request row; loser no side effects | both commit | `REV-P2-06/07` |
| `R3-SRC-12` | Direct JSON projection edit cannot change selection | valid v1 | update legacy JSON projection | 409/error or trigger rebuild | selection reads immutable FieldValue; projection cannot diverge | selection uses JSON | `REV-P1-03` |
| `R3-SRC-13` | FieldValue cannot attach to another version's field | versions V1/V2 | insert value in V1 with V2 assertion and copied field key | N/A | composite FK failure | row accepted | `REV-R2-P1-01` |

## 3. Catalog Evidence

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-EVID-01` | Same locator with changed content creates new evidence | S1 captured from URL L | capture L with changed bytes | accepted new revision only if new evidence object | S1 unchanged; S2/evidence object 2 created | S1 updated | `REV-R2-P1-02` |
| `R3-EVID-02` | Reviewed content replacement cannot reuse review | approved S1/R1 | replace archive bytes for S1 object identity | archive conflict/reject | object and S1 unchanged | old review remains on changed bytes | `REV-R2-P1-02` |
| `R3-EVID-03` | Digest without retained content is not accepted | source metadata only | create formal review requiring archive verification | 422/blocked | no approval; source marked unavailable | approval created | `REV-R2-P1-02` |
| `R3-EVID-04` | Digest mismatch fails closed | archive object exists, wrong bytes injected | verifier reads exact object | verification failure | `MISMATCH` append-only event; no approval | source remains trusted | `REV-R2-P1-02` |
| `R3-EVID-05` | Archive inaccessible fails closed | valid reviewed source | make test archive adapter unavailable | 503/blocked | `INACCESSIBLE` event; no current trust | old MATCH reused | `REV-R2-P1-02` |
| `R3-EVID-06` | Source withdrawal invalidates formal use | approved source/revision | append withdrawal | formal exclusion | withdrawal event; historical review retained | Operational result | `REV-P1-05` |
| `R3-EVID-07` | New revision cannot inherit old review | reviewed S1 | create S2 with different digest | review required | no review FK to S2 | old review resolves S2 | `REV-P1-05` |
| `R3-EVID-08` | Archive object identity is write-once | object O exists | write different bytes under O | conflict | original bytes/digest unchanged | overwrite succeeds | `REV-R2-P1-02` |
| `R3-EVID-09` | Exact URL redirect is metadata only | old/new locator values | update locator without new evidence | administrative change allowed only as metadata | no change to content identity/review | content substitution accepted | `REV-R2-P1-02` |
| `R3-EVID-10` | MATCH verification is required at review creation | source with only negative verification | submit catalog review | rejected | no ReviewSourceEvidence row | approved | `REV-R2-P1-02` |
| `R3-EVID-11` | Review basis includes raw and canonical digests | source text and PDF bytes | capture both; mutate canonical text only | new revision required | independent raw/canonical digests detected | one digest silently reused | `REV-P1-05` |
| `R3-EVID-12` | Verification rows are append-only | MATCH event exists | update/delete verification | N/A | trigger/privilege rejection | event modified/deleted | `REV-R2-P1-02` |
| `R3-EVID-13` | Catalog review policy revision is exact | catalog review exists | direct SQL points review at another policy revision or current pointer | N/A | exact policy FK/immutability check fails | policy drift accepted | `REV-R2-P2-04` |

## 4. Project Scenario

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-SCN-01` | Final runtime scenario is NOT NULL | migrated project | insert/update NULL scenario | constraint failure | row unchanged | NULL persisted | `REV-P2-01` |
| `R3-SCN-02` | Legacy mapping is exact | ProjectType old value | set mismatched scenario | mapping CHECK failure | no update | inconsistent pair | `REV-P2-01` |
| `R3-SCN-03` | Scenario can change before first conversation | project with no conversation | project.manage change | 200 | project row updated and audit event | child/history changed | `REV-P2-01` |
| `R3-SCN-04` | Scenario is immutable after first conversation | project with conversation | direct SQL/API update scenario | 409/trigger failure | project + history unchanged | update succeeds | `REV-P2-01` |
| `R3-SCN-05` | Conversation creation inherited server scenario | request includes different scenario | create conversation with forged scenario | 422/DB failure | no conversation | forged scenario persisted | `REV-P1-02` |
| `R3-SCN-06` | Requirement cannot cross project/conversation | valid parent chain | direct insert with crossed ownership columns | N/A | composite FK failure | row accepted | `REV-P1-02` |
| `R3-SCN-07` | Requirement history cannot change scenario | immutable version | update scenario on version | N/A | update rejected/no row change | version mutated | `REV-P1-02` |
| `R3-SCN-08` | Unmappable legacy row is quarantined | ambiguous legacy fixture | run preflight/backfill | blocked report | quarantine row; no guessed mapping | guessed scenario | `REV-P2-01` |
| `R3-SCN-09` | Project change and conversation creation race | project with no conversation | simultaneous change and create | one succeeds, one conflicts | no mixed scenario conversation | both succeed | `REV-P2-01` |
| `R3-SCN-10` | Historical snapshot scenario remains explained | snapshot with old scenario | change current project policy/status | snapshot read | snapshot unchanged; basis diff shown | snapshot relabeled | `REV-P1-06` |

## 5. Rule Sets

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-RULE-01` | Run binds one exact rule-set revision | approved R1 | create run | 200 | run FK to R1 | run stores only display version | `REV-R2-P2-02` |
| `R3-RULE-02` | Unapproved rule set cannot produce Operational | draft/pending R2 | formal evaluate | `REQUIRES_PROFESSIONAL_REVIEW` | no Operational candidate | Operational | `REV-P1-04` |
| `R3-RULE-03` | Rule-set revision is immutable | approved R1 | update rule/value/digest | N/A | update rejected | revision mutated | `REV-R2-P2-02` |
| `R3-RULE-04` | Rule content digest is exact-bound | R1 content | alter rule without new revision | rejected | no change; historical digest remains | changed content accepted | `REV-R2-P2-02` |
| `R3-RULE-05` | New rule revision does not rewrite old run | run with R1 | create R2 and evaluate | new run uses R2 | old run/recommendations unchanged | old run relabeled | `REV-P2-08` |
| `R3-RULE-06` | Effective boundary obeys UTC `[from,to)` | R1 ends at T | evaluate at T | excluded | no applicable R1 | included | `REV-P2-05` |
| `R3-RULE-07` | Ambiguous effective versions fail closed | two effective R1/R2 | evaluate | ambiguous error | no Operational | arbitrary winner | `REV-P2-05` |
| `R3-RULE-08` | Rule-set approval separation | creator=reviewer fixture | approve own set | 403 | no approval event | self-approved | `REV-R2-P2-02` |
| `R3-RULE-09` | Candidate preserves rule basis | R1 candidate | mutate source/rule | read historical result | candidate + basis unchanged; stale marker | overwritten result | `REV-R2-P2-02` |
| `R3-RULE-10` | Rule source evidence exact | R1 source S1 | replace source bytes | new review required | R1 marked stale/invalidated | old source used | `REV-P1-05` |

## 6. Professional Review

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-PRO-01` | Required review starts non-approved | complete candidate, no rules? | create review | `CREATED` | event 1, state version 1 | Operational | `REV-R2-P1-04` |
| `R3-PRO-02` | Submitted is not approved | review CREATED | submit | `SUBMITTED` | event seq 2; no approval | approved automatically | `REV-R2-P1-04` |
| `R3-PRO-03` | Two reviewers cannot both claim | SUBMITTED v1 | two IN_REVIEW transitions | one 200, one 409 | one sequence, state v2 | two events/state overwrite | `REV-R2-P1-04` |
| `R3-PRO-04` | Review basis cannot transfer | approved candidate A | request approval for candidate B using A's basis | rejected | no approval for B | B approved | `REV-R2-P1-04` |
| `R3-PRO-05` | Source update invalidates approval | approved review with S1 | append source withdrawal/replacement | review invalidated | invalidation event; formal resolver rejects | old approval reused | `REV-R2-P1-04` |
| `R3-PRO-06` | Spec/price/rule change invalidates approval | approved review exact basis | publish new revision | no Operational | old review historical; new review required | automatic carryover | `REV-P1-04` |
| `R3-PRO-07` | Reviewer event append-only | approved review | UPDATE/DELETE event | N/A | trigger/privilege reject | mutation succeeds | `REV-R2-P1-04` |
| `R3-PRO-08` | Event sequence duplicate rejected | sequence 1 exists | insert sequence 1 again | N/A | unique violation | duplicate history | `REV-R2-P1-04` |
| `R3-PRO-09` | Previous state must match | review at IN_REVIEW | direct SQL event with previousState=SUBMITTED | N/A | function/trigger rejects | inconsistent event | `REV-R2-P1-04` |
| `R3-PRO-10` | Reviewer identity exact | valid reviewer A | approve as unknown/cross-project user | 403 | no event | foreign reviewer accepted | `REV-R2-P1-04` |
| `R3-PRO-11` | Self-approval denied if policy requires separation | submitter=reviewer | approve | 403 | no approval event | self-approved | `REV-R2-P1-04` |
| `R3-PRO-12` | Rejected/returned terminal states cannot revive | terminal review | submit same review | 409 | no new event/current state | revived in place | `REV-R2-P1-04` |
| `R3-PRO-13` | Policy revision is immutable | policy P1 | update policy text/digest | N/A | update rejected | approval basis changed | `REV-R2-P2-04` |
| `R3-PRO-14` | New policy cannot silently validate old review | review P1, new P2 effective | formal resolver | blocked/requires new review | policy mismatch recorded | P1 approved P2 | `REV-R2-P1-04` |
| `R3-PRO-15` | Approval race with basis update | review IN_REVIEW, spec update | concurrent transactions | one consistent result | review invalidated or approval fails exact basis | approval of stale basis | `REV-R2-P1-04` |
| `R3-PRO-16` | Current state equals event projection | mixed history | query review | state/version matches last event | no orphan event | projection disagrees | `REV-R2-P1-04` |

## 7. Review Policy

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-POL-01` | Policy revision exact-bound | approved P1 | create review | review FK P1 | exact policy row | string/current pointer only | `REV-R2-P2-04` |
| `R3-POL-02` | Policy digest required | policy source | insert empty/mismatched digest | rejected | no policy | accepted | `REV-R2-P2-04` |
| `R3-POL-03` | Policy history preserved | P1/P2 | switch policy | old review remains | both revisions retained | P1 overwritten | `REV-R2-P2-04` |
| `R3-POL-04` | Policy basis in event | decision event | omit policy revision | rejected | no event | event approved without policy | `REV-R2-P2-04` |
| `R3-POL-05` | Policy expiry blocks old approval | P1 expires | resolve formal | requires review/invalidated | expiry event; no Operational | old approval used | `REV-R2-P2-04` |
| `R3-POL-06` | Policy migration mapping | old valid review | introduce R3 policy key | migration blocked if no mapping | quarantine/legacy review | guessed mapping | `REV-R2-P2-04` |
| `R3-POL-07` | Policy approval actor scope | unauthorized user | approve policy | 403 | no approval | accepted | `REV-R2-P2-04` |
| `R3-POL-08` | Event references same policy as review | P1 review | event P2 | rejected | no event | cross-policy event | `REV-R2-P2-04` |

## 8. Advisor Idempotency

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-IDEM-01` | Idempotency is conversation-scoped | C1/C2 | same key in C2 | not found/conflict | no C2 business rows | C1 response returned | `REV-R2-P2-03` |
| `R3-IDEM-02` | Same key/payload returns exact prior result | committed request | retry after timeout | same IDs/response | one request/message/version | duplicate | `REV-R2-P2-03` |
| `R3-IDEM-03` | Same key/different payload rejected | committed request | changed content | 409 | original unchanged | second mutation | `REV-R2-P2-03` |
| `R3-IDEM-04` | Concurrent same key one winner | no key | two requests | one commit/one replay-or-conflict | one request row, one business result | duplicate rows | `REV-R2-P2-03` |
| `R3-IDEM-05` | Transaction failure leaves no false committed row | injected DB error | send request | safe 5xx | no request/business rows | `COMMITTED` row with no result | `REV-R2-P2-03` |
| `R3-IDEM-06` | Deterministic rejection can persist only explicit failure | invalid request | retry invalid command | stable failure | `FAILED` row with failureCode; no business IDs | fake success | `REV-R2-P2-03` |
| `R3-IDEM-07` | Crashed transaction rolls back completely | DB kill before commit | retry | new attempt | no partial rows | orphan message/version | `REV-P2-07` |
| `R3-IDEM-08` | Commit unknown re-reads durable key | response lost | new connection query | exact prior result | no duplicate | false failure/duplicate | `REV-R2-P2-03` |
| `R3-IDEM-09` | Wrong-conversation message replay rejected | C1 key/IDs | force C2 IDs | FK/ownership failure | no response correlation | cross-conversation return | `REV-R2-P2-03` |
| `R3-IDEM-10` | Different actor cannot read replay | actor A key | actor B same key | 403/404 | no row exposure | other actor response | `REV-R2-P2-03` |
| `R3-IDEM-11` | Request digest canonicalization stable | equivalent canonical requests | retry | same digest | same row | inconsistent retry | `REV-P2-06` |
| `R3-IDEM-12` | Failed record idempotency | saved FAILED | replay | same failure response | one failed row | repeated side effects | `REV-R2-P2-03` |

## 9. Sales Snapshot

| ID | Invariant / operation | Actor and precondition | Attempt | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|
| `R3-SNP-01` | Case and snapshot same project | case P1, snapshot P2 payload | insert direct | N/A | composite FK failure | accepted | `REV-R2-P1-03` |
| `R3-SNP-02` | Run derives from exact requirement version | same project R1/R2 | snapshot labels R1, run R2 | N/A | exact FK failure | accepted | `REV-R2-P1-03` |
| `R3-SNP-03` | Snapshot version is exact | R2 run | snapshot claims R1 version | N/A | composite FK failure | accepted | `REV-R2-P1-03` |
| `R3-SNP-04` | Snapshot conversation exact | R1/C1 | snapshot points C2 | N/A | FK failure | accepted | `REV-R2-P1-03` |
| `R3-SNP-05` | All run candidates represented once | run with 3 candidates | create snapshot | success | exactly 3 snapshot candidates | missing/duplicate | `REV-R2-P1-05` |
| `R3-SNP-06` | Candidate item cannot reference other product | candidate A | item refs product B | N/A | FK/check failure | accepted | `REV-R2-P1-05` |
| `R3-SNP-07` | Specification belongs to product | product A, spec B | item refs combination | N/A | FK failure | accepted | `REV-R2-P1-03` |
| `R3-SNP-08` | Price belongs to product | product A, price B | item refs combination | N/A | FK failure | accepted | `REV-P1-07` |
| `R3-SNP-09` | Copied parameter matches revision | immutable parameter P | alter copied value | N/A | validation trigger failure | accepted | `REV-R2-P1-05` |
| `R3-SNP-10` | Copied field matches authoritative field | source field F | copy different value/status | N/A | validation trigger failure | accepted | `REV-R2-P1-05` |
| `R3-SNP-11` | Stored payload is not a second truth | valid snapshot | direct insert/update payload | rejected | no payload column/row; reconstruction unchanged | payload mutated | `REV-R2-P1-05` |
| `R3-SNP-12` | Reconstructed payload reflects rows | valid snapshot | compare schema/JCS output | exact payload | basis digest/payload deterministic | alternate content | `REV-R2-P1-05` |
| `R3-SNP-13` | Basis digest recomputes | valid snapshot | recompute over normalized rows | match | digest matches | mismatch accepted | `REV-R2-P1-05` |
| `R3-SNP-14` | Forged basis digest rejected | valid rows | alter digest | transaction failure | no snapshot/pointer | accepted | `REV-R2-P1-05` |
| `R3-SNP-15` | Snapshot immutable | snapshot exists | update/delete snapshot/item/source | N/A | trigger/privilege failure | mutation | `REV-R2-P1-06` |
| `R3-SNP-16` | Source withdrawal preserves snapshot | snapshot v1 | withdraw source | read succeeds with stale marker | snapshot rows unchanged | snapshot changes | `REV-P2-08` |
| `R3-SNP-17` | Snapshot source evidence unavailable | archive unavailable after snapshot | read/reconstruct | last durable evidence or integrity error | no silent current substitution | current source used | `REV-R2-P1-02` |
| `R3-SNP-18` | Snapshot creation cannot race into mixed basis | run v1, source withdrawal concurrent | create snapshot | one complete basis or failure | no mixed rows/pointer | partial snapshot | `REV-R2-P1-03` |

## 10. Cross-Domain Concurrency

| ID | Invariant / operation | Setup and actors | Concurrent operations | Expected result | Failure assertion | Finding |
|---|---|---|---|---|---|---|
| `R3-CT-01` | Requirement edits one winner | two editors, v3 | two PATCH expected v3 | one 200, one 409 | both commit | `REV-P1-02` |
| `R3-CT-02` | Project scenario vs conversation | no conversation | scenario update and conversation create | one operation wins; no mixed row | both pass | `REV-P2-01` |
| `R3-CT-03` | Project head updates one pointer | two admins | two head updates | one 200, one 409 | two heads | `REV-P2-01` |
| `R3-CT-04` | Review claim/decision | SUBMITTED | two reviewers claim and decide | one winner; one event | two events | `REV-R2-P1-04` |
| `R3-CT-05` | Review vs spec change | IN_REVIEW | approve and spec withdrawal | no stale approval | old approval reused | `REV-R2-P1-04` |
| `R3-CT-06` | Review vs rule change | IN_REVIEW | approve and new rule revision | old review not current | old rule result current | `REV-R2-P2-02` |
| `R3-CT-07` | Snapshot vs source withdrawal | valid run | create and withdraw | snapshot or failure, never mixed | mixed | `REV-R2-P1-03` |
| `R3-CT-08` | Snapshot vs new handoff | case pointer v1 | two creates | one v2, one conflict/next version | overwritten pointer | `REV-P1-06` |
| `R3-CT-09` | Price expiry vs formal evaluation | price ends T | evaluate around boundary and update | deterministic fail/quote | stale price honored | `REV-P1-07` |
| `R3-CT-10` | Two selection runs share immutable source | same requirement | two runs | distinct IDs, both immutable | overwrite | `REV-P1-04` |
| `R3-CT-11` | Idempotent commit unknown | client timeout | retry on new connection | exact prior result or no row | duplicate/incorrect result | `REV-R2-P2-03` |
| `R3-CT-12` | Failed snapshot leaves no pointer | inject item insert failure | create snapshot | error; no header/items/pointer/audit | partial | `REV-P1-06` |

## 11. Permissions and Security

| ID | Invariant / operation | Actor | Attempt | Expected | Failure assertion |
|---|---|---|---|---|---|
| `R3-AUTH-01` | Evidence capture restricted | customer | capture archive/source | 403 | accepted |
| `R3-AUTH-02` | Review decision restricted | product admin | approve review | 403 | accepted |
| `R3-AUTH-03` | Cross-project sales denied | sales B | read case A snapshot | 403/404 | content returned |
| `R3-AUTH-04` | Customer cannot invoke formal resolver | customer | submit selection | 403 | accepted |
| `R3-AUTH-05` | System admin is not engineering approval | admin | approve professional review | 403 absent explicit grant | accepted |
| `R3-AUTH-06` | Archive and P1-3 identities separate | worker/file role | access catalog archive | deny unless catalog verifier grant | access succeeds |

## 12. Migration and Legacy

| ID | Invariant / operation | Precondition | Expected result | Failure assertion |
|---|---|---|---|---|
| `R3-MIG-01` | Expand/backfill/validate order | legacy projects | scenario columns/keys created after preflight | migration guesses values |
| `R3-MIG-02` | Unmappable project quarantined | ambiguous fixture | R3 migration blocked/quarantine record | invented mapping |
| `R3-MIG-03` | Unknown conversation requirement quarantined | null legacy conversation | legacy read-only/quarantine, no new chain | promoted silently |
| `R3-MIG-04` | Legacy source cannot become verified | source text only | `LEGACY_EVIDENCE_REQUIRED` read-only | auto VERIFIED |
| `R3-MIG-05` | Existing review cannot escape `PENDING` | legacy review | migration preserves pending/quarantine | guessed approval |
| `R3-MIG-06` | P1-3 schema remains byte-for-byte untouched | baseline | migration diff excludes P1-3 tables/triggers | altered P1-3 |
| `R3-MIG-07` | Migration failure rolls back | injected FK/CHECK failure | no partial constraints/data | partial commit |
| `R3-MIG-08` | Deferred case/snapshot cycle works | empty clone | first snapshot and current pointer commit | immediate FK fails incorrectly |

## 13. Test Completion Gate

```text
Five P1 findings have at least one direct negative DB test: REQUIRED
Each P2 group has direct regression coverage: REQUIRED
Composite keys and NOT NULL behavior are tested against direct SQL: REQUIRED
Append-only triggers are tested with UPDATE/DELETE: REQUIRED
Concurrent tests use real separate database connections/clone: REQUIRED
No test passes solely because an API returned 403/400: REQUIRED
Snapshot payload is reconstructed from normalized rows only: REQUIRED
No P1-3 lifecycle test is used as product acceptance: REQUIRED
No database/Runtime test may run until separately authorized: REQUIRED
```
