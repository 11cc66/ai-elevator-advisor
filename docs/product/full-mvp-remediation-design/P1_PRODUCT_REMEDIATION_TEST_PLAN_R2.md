# P1 Product Remediation Test Plan R2

This is a design-time test matrix. No test was executed in R2.

## 1. Execution Rules

- Assert API result, final database rows and absence of side effects.
- Do not accept HTTP 200 as proof.
- Every safety test has a deliberate failure condition.
- Cross-project tests use two projects and two customers.
- Database tests execute only against an approved isolated clone.
- Concurrency tests use separate database connections.
- Retry tests simulate lost responses and commit-unknown ambiguity.
- Browser tests run only after a separate browser-installation authorization.
- P1-3 tests are separate and cannot be used to close product findings.

## 2. Semantic Parsing

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API state | Expected DB state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `SEM-01` | negative external installation is not inverted | conversation with no external value or conflict | parse `外装不允许` | N/A | `EXTRACTED_EXPLICIT` with false | one negative assertion and resolved false | positive `ResolvedFieldValue` exists or status becomes confirmation-only | `REV-P1-01` |
| `SEM-02` | explicit affirmative is accepted only when unambiguous | empty conversation | parse `可以外装` | N/A | `EXTRACTED_EXPLICIT` | assertion polarity AFFIRM; resolved value true | no source span/rule version | `REV-P1-01` |
| `SEM-03` | conditional construction is not a fact | empty conversation | parse `如果物业不反对，可以考虑外装。` | N/A | `NEEDS_CONFIRMATION` | CONDITIONAL assertion; no resolved value | any true resolved field | `REV-P1-01` |
| `SEM-04` | double-negative uncertainty is not a fact | empty conversation | parse `不是不允许外装，只是需要再确认。` | N/A | `NEEDS_CONFIRMATION` | UNCERTAIN assertion; no resolved value | false/true resolved value | `REV-P1-01` |
| `SEM-05` | temporal correction preserves history | prior true version | parse `原来可以外装，现在明确不允许了。` | N/A | correction response with current false | old assertion invalidated; new false assertion links prior source | history overwritten or both active | `REV-P1-01` |
| `SEM-06` | exception remains conditional | empty conversation | parse `外装不行，除非没有其他方案。` | N/A | `NEEDS_CONFIRMATION` | EXCEPTION assertion; no resolved value | false auto-resolved as fact | `REV-P1-01` |
| `SEM-07` | double uncertainty not accepted | empty conversation | parse `不排除外装，但不能确定。` | N/A | `NEEDS_CONFIRMATION` | two uncertainty markers/source refs | automatic true | `REV-P1-01` |
| `SEM-08` | scope of restriction remains an open condition | empty conversation | parse `外装允许，但不能从临街侧施工。` | N/A | `NEEDS_CONFIRMATION` | AFFIRM assertion plus unresolved restriction condition | unconditional resolved true | `REV-P1-01` |
| `SEM-09` | phrase-boundary isolation | message includes unrelated negative clause | parse `不允许拆除内装；外装可以。` | N/A | positive external candidate | negation source span stays in first clause | negative leaks to external | `REV-P1-01` |
| `SEM-10` | conflicting same-clause values produce conflict | empty or known external state | parse `外装允许，但又不允许外装。` | N/A | `CONFLICT` | `RequirementConflict` OPEN, no resolved value | one value silently chosen | `REV-P1-01` |
| `SEM-11` | multiple field extraction keeps independent sources | empty conversation | parse `住宅8层，层高3米，预算50万。` | N/A | four explicit facts | each field has its own source span/rule | shared/wrong source refs | `REV-P1-01` |
| `SEM-12` | parser/model confidence cannot confirm | parser returns high confidence for ambiguous phrase | parse/confirm | N/A | `NEEDS_CONFIRMATION` | no confirmed field | confidence used as truth | `REV-P1-01` |
| `SEM-13` | full-width and punctuation normalization | mixed punctuation/full-width text | parse | N/A | normalized source offsets | raw text remains unchanged in evidence | offsets/normalization mismatch | `REV-P1-01` |
| `SEM-14` | user clarification becomes a new version | open conflict | customer selects explicit value | N/A | new requirement version | old conflict RESOLVED; new assertion has actor/time | conflict overwritten in place | `REV-P1-01` |
| `SEM-15` | condition satisfaction is explicit | condition unresolved | later message states property approval and external allowed | N/A | new fact requires normal confirmation | condition link and source message persisted | implicit condition satisfaction | `REV-P1-01` |
| `SEM-16` | no formal selection from unresolved semantics | unresolved external condition | request preliminary/formal selection | N/A | response includes insufficient/confirmation state | no formal candidate based on guessed boolean | selection proceeds as if true | `REV-P1-01` |

## 3. Requirement Identity and CAS

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB final state | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `CONV-01` | conversation has own current requirement | project P, conversation A | create A | N/A | scenario from project; current pointer A | one requirement and greeting | client scenario persisted | `REV-P1-02` |
| `CONV-02` | old conversation does not use other conversation | A/B | open A | N/A | A current requirement | no project-latest lookup | B/latest returned | `REV-P1-02` |
| `CONV-03` | writes are conversation-scoped | A/B | PATCH A | N/A | A version increments | B unchanged | B changed | `REV-P1-02` |
| `CONV-04` | closed conversation is read-only | A closed | message/edit | N/A | 409/422 | no rows/pointers changed | mutation succeeds | `REV-P1-02` |
| `CONV-05` | cross-conversation ID rejected | URL A, requirement B | PATCH/confirm | N/A | 404/403 | no mutation | data returned | `REV-P1-02` |
| `CONV-06` | project head is distinct | project head H, conversation A pointer A | open/select | N/A | conversation A returns A | no H substitution | H used as A | `REV-P1-02` |
| `CONV-07` | explicit project head selection | confirmed requirement RA | set head | N/A | head updated | pointer and audit row | implicit latest promotion | `REV-P1-02` |
| `INIT-01` | conversation creation atomic | no conversation | insert greeting failure | N/A | error | no conversation/requirement/greeting | partial conversation | `REV-P2-07` |
| `INIT-02` | initial requirement belongs to conversation | create A | inspect | N/A | current pointer A | composite FK valid | mismatch | `REV-P2-07` |
| `CAS-01` | stale edit rejected | current v3 | PATCH expected v2 | N/A | 409 current v3 | no version/pointer change | write occurs | `REV-P1-02` |
| `CAS-02` | concurrent edits one winner | current v3 | two PATCH both expected v3 | two connections | one 200, one 409 | one new version, one conflict audit | both create versions | `REV-P1-02` |
| `CAS-03` | pointer update atomic | requirement insert succeeds | inject pointer update failure | N/A | transaction error | no requirement side effects | orphan requirement | `REV-P1-03` |
| `CAS-04` | confirmation CAS | stale expected | confirm | two connections | one success, one 409 | one confirmed pointer | stale overwrite | `REV-P1-02` |
| `IDEM-01` | lost response retry | interaction committed but client sees timeout | repeat clientMessageId | N/A | same requirement/assistant IDs | exactly one interaction/version | duplicate | `REV-P2-06` |
| `IDEM-02` | changed payload same key rejected | existing key | retry different content | N/A | 409 | no new message/version | silently accepted | `REV-P2-06` |
| `IDEM-03` | concurrent same-key requests | no existing key | two POST same key | two connections | one commit; other idempotent/409 | one transaction record | duplicate messages | `REV-P2-06` |
| `IDEM-04` | commit-unknown recovery | response loss after commit | new request re-read | N/A | finds committed response | no new row | fallback duplicate | `REV-P2-06` |

## 4. Scenario and Single Source

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `SCN-01` | project canonical scenario set | valid project create | create project | N/A | project scenario | canonical project scenario | client divergent scenario | `REV-P1-02` |
| `SCN-02` | conversation inherits project scenario | project old | create conversation | N/A | old scenario | matching conversation scenario | new-building conversation | `REV-P1-02` |
| `SCN-03` | scenario input ignored/rejected | project old | submit new scenario | N/A | 422 | no conversation/requirement | accepted | `REV-P1-02` |
| `SCN-04` | Requirement scenario immutable | existing requirement | PATCH scenario | N/A | 422 | no new version | mutated scenario | `REV-P1-02` |
| `SCN-05` | Project Type mutable only before activity | no conversation | admin change | N/A | allowed | audit old/new | unauthorized change | `REV-P1-02` |
| `SCN-06` | Project Type frozen after activity | conversation exists | admin change | N/A | 409 | unchanged | changed | `REV-P1-02` |
| `SCN-07` | selection uses requirement scenario | old project | run | N/A | old scenario | run/requirement match | new scenario used | `REV-P1-02` |
| `SCN-08` | handoff preserves requirement scenario | confirmed requirement | handoff | N/A | snapshot scenario | snapshot + item exact refs | dynamic current scenario | `REV-P1-02` |
| `SRC-01` | normalized field values are authority | extraction accepted | query selection input | N/A | response values | resolved field rows match | JSON used as truth | `REV-P1-03` |
| `SRC-02` | JSON projection generated from fields | create draft | inspect DB | N/A | projection from normalized rows | digest binds field set | independent writable JSON | `REV-P1-03` |
| `SRC-03` | JSON/row divergence fails | manually alter projection | commit/read | N/A | 409/error or projection rebuilt | no divergent authoritative state | selection reads divergent JSON | `REV-P1-03` |
| `SRC-04` | source audit reads same value | extracted field | audit query | N/A | same value/source | assertion/value link | audit uses separate source | `REV-P1-03` |
| `SRC-05` | client cannot write source | request fieldSources | PATCH | N/A | 400/ignored | source unchanged | client source accepted | `REV-P1-03` |
| `SRC-06` | old JSON ambiguous | legacy row | migration preflight | N/A | quarantine/manual | no guessed field rows | silent overwrite | `REV-P1-03` |
| `SRC-07` | immutable previous value | v1/v2 | inspect history | N/A | both values | v1 retained/INVALIDATED | v1 removed | `REV-P1-03` |
| `SRC-08` | missing data not auto-pass | one critical field absent | selection | N/A | `INSUFFICIENT_DATA` | missing field recorded | value inferred | `REV-P1-03` |
| `DB-01` | cross-project requirement rejected | A/B projects | insert mismatch | N/A | N/A | FK violation | row accepted | `REV-P1-02` |
| `DB-02` | cross-scenario requirement rejected | old project/new scenario | insert | N/A | N/A | FK/CHECK violation | row accepted | `REV-P1-02` |
| `DB-03` | current pointer cross-conversation rejected | A/B | update pointer | N/A | N/A | composite FK failure | pointer accepted | `REV-P1-02` |
| `DB-04` | selection requirement cross-project rejected | A/B | insert run | N/A | N/A | composite FK failure | run accepted | `REV-P1-02` |
| `DB-05` | ProjectRequirementHead unique key exists | migration | inspect/validate | N/A | N/A | FK validates | migration error | `REV-P2-01` |
| `DB-06` | JSON/field source mismatch detected | custom transaction | insert/update divergence | N/A | N/A | trigger/function failure or rebuild | divergence persists | `REV-P1-03` |

## 5. Catalog Review and Source

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `CAT-01` | review targets exact revision | product revision v2 | approve v2 | N/A | accepted | typed FK to v2 | v1/v3 approved | `REV-P1-05` |
| `CAT-02` | wrong target rejected | review v2 | submit v3 | N/A | 409/422 | no review | wrong revision approved | `REV-P1-05` |
| `CAT-03` | source digest mandatory | real source | create verified source revision without digest | N/A | 422 | no approved source | approved without digest | `REV-P1-05` |
| `CAT-04` | source content immutable | approved source rev | alter content/digest | N/A | 409 | old rev unchanged/new rev | digest silently changes | `REV-P1-05` |
| `CAT-05` | source withdrawal invalidates formal eligibility | approved source/product | withdraw source | N/A | formal excluded | withdrawal event | still trusted | `REV-P1-05` |
| `CAT-06` | review evidence exact | review v1 | attach source rev | N/A | accepted | evidence join | source mutation after approval | `REV-P1-05` |
| `CAT-07` | DEMO cannot be VERIFIED | Demo product | approve/upgrade | N/A | 409/422 | status unchanged | verified | `CAT`/`REV-P1-05` |
| `CAT-08` | manufacturer/brand disable cascades eligibility | active product | disable brand | N/A | formal excluded | status event | still operational | `REV-P1-05` |
| `CAT-09` | expired spec excluded | approved spec past end | formal query | N/A | no formal spec | expiry/effective result | stale spec used | `REV-P1-05` |
| `CAT-10` | expired price requote | valid technical, expired price | evaluate | N/A | `REQUIRES_QUOTE` | price status in result | `WITHIN_BUDGET` | `REV-P1-07` |
| `CAT-11` | source revision changed requires review | approved source v1 | create v2/update | N/A | formal excludes until review | two source revisions | v1 review reused | `REV-P1-05` |
| `CAT-12` | review revoke invalidates current | approved review | revoke | N/A | formal excluded | revoke event | still approved | `REV-P1-05` |
| `CAT-13` | effective overlap blocked | existing [t1,t2) | insert overlap | N/A | N/A | exclusion/constraint failure | ambiguous current | `REV-P1-05` |
| `CAT-14` | boundary semantics | spec ends at T | query at T | N/A | excluded at T | `[from,to)` | wrongly included | `REV-P2-05` |
| `CAT-15` | legacy VERIFIED without evidence | legacy row | migrate | N/A | legacy/formal excluded | `LEGACY_REVIEW_REQUIRED` | auto remains verified | `REV-P1-05` |
| `CAT-16` | legacy source cannot be promoted | DEMO source | formal review | N/A | rejected | source remains demo | promoted | `REV-P1-05` |
| `DB-09` | invalid review target count | review row | insert 0/2 targets | N/A | N/A | CHECK/FK failure | polymorphic wrong target | `REV-P1-05` |
| `DB-10` | invalid review evidence | review | source not matching target | N/A | N/A | FK/check failure | evidence mismatch | `REV-P1-05` |
| `DB-11` | source digest required | source revision | insert null digest | N/A | N/A | NOT NULL failure | review accepted | `REV-P1-05` |
| `DB-12` | source withdrawal append-only | approved source | update/delete event | N/A | N/A | trigger rejection | history removed | `REV-P1-05` |
| `DB-13` | source review target exact | source revision | cross-version review | N/A | N/A | FK/check failure | wrong source approved | `REV-P1-05` |
| `DB-14` | effective overlap | spec/price rows | overlapping insert | N/A | N/A | exclusion failure | both active | `REV-P2-05` |
| `DB-15` | DEMO classification immutable | Demo product | update classification | N/A | N/A | trigger failure | becomes operational | `REV-P1-05` |
| `DB-16` | review exact version immutable | approved review | update target/inputDigest | N/A | N/A | trigger failure | approval changes | `REV-P1-05` |

## 6. Selection and Professional Review

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `SEL-01` | missing critical dimension fails closed | verified product no maxTravel | evaluate | N/A | `INSUFFICIENT_DATA` | technical status insufficient | operational | `REV-P1-07` |
| `SEL-02` | missing shaft width fails | verified product | evaluate | N/A | `INSUFFICIENT_DATA` | missing check | operational | `REV-P1-07` |
| `SEL-03` | missing shaft depth fails | verified product | evaluate | N/A | `INSUFFICIENT_DATA` | missing check | operational | `REV-P1-07` |
| `SEL-04` | missing pit fails | verified product | evaluate | N/A | `INSUFFICIENT_DATA` | missing check | operational | `REV-P1-07` |
| `SEL-05` | missing overhead fails | verified product | evaluate | N/A | `INSUFFICIENT_DATA` | missing check | operational | `REV-P1-07` |
| `SEL-06` | source withdrawn fails | verified product source | evaluate | N/A | `NOT_ELIGIBLE` trust | trust failure | candidate operational | `REV-P1-05` |
| `SEL-07` | price expired requote | technical complete | evaluate | N/A | overall `REQUIRES_QUOTE`; technical status eligible | commercial status expired | Operational | `REV-P1-07` |
| `SEL-08` | no approved rule review pending | complete data | evaluate formal | N/A | run `REQUIRES_PROFESSIONAL_REVIEW` | review state required | run insufficient | `REV-P1-04` |
| `SEL-09` | approved rule pass | all evidence valid | evaluate | N/A | `OPERATIONAL` | all dimensions valid | preliminary only | `REV-P1-04` |
| `SEL-10` | product not eligible | approved rule fail | evaluate | N/A | `NOT_ELIGIBLE` | fail check retained | omitted silently | `REV-P1-07` |
| `SEL-11` | Demo only | Demo product | formal evaluate | N/A | formal `NOT_ELIGIBLE`/Demo excluded | no operational | prompt | `REV-P1-07` |
| `SEL-12` | professional review not approval | submitted review | read candidate | N/A | `REQUIRES_PROFESSIONAL_REVIEW` | PENDING state | OPERATIONAL | `REV-P1-04` |
| `SEL-13` | review approval binds basis | approved run | mutate requirement | N/A | approval invalidated | old review historical | old approval reused | `REV-P1-04` |
| `SEL-14` | mixed candidates preserve states | multiple candidates | evaluate | N/A | counts/statuses for all | each candidate row | any candidate dropped | `REV-P1-07` |
| `SEL-15` | no candidates no fabrication | empty product set | evaluate | N/A | `NO_ELIGIBLE_MATCH` | empty candidates | fabricated product | `REV-P1-07` |
| `RUN-01` | run status operational only all conditions | approved complete | evaluate | N/A | WITH_OPERATIONAL_MATCH | status/counts | operational with missing | `REV-P1-04` |
| `RUN-02` | run status preliminary only Demo | Demo valid | evaluate | N/A | COMPLETED_PRELIMINARY_ONLY | run flags | operational | `REV-P1-04` |
| `RUN-03` | run status insufficient | missing critical | evaluate | N/A | INSUFFICIENT_DATA | counts | review pending mapped wrong | `REV-P1-04` |
| `RUN-04` | run status review | complete/no rule | evaluate | N/A | REQUIRES_PROFESSIONAL_REVIEW | review state | insufficient | `REV-P1-04` |
| `RUN-05` | run status quote | technical complete/price invalid | evaluate | N/A | REQUIRES_QUOTE | commercial count | operational | `REV-P1-07` |
| `RUN-06` | deterministic rule version | same input | evaluate twice | N/A | identical output | same rule digest | output changes | `REV-P1-04` |
| `RUN-07` | concurrent runs isolated | same requirement | two runs | two connections | distinct IDs | both immutable | overwrite | `REV-P1-04` |
| `RUN-08` | evaluation failure | injection | evaluate | N/A | 5xx safe error | FAILED only | partial operational | `REV-P1-04` |
| `PROF-01` | submitted not approved | requirements complete | submit review | N/A | `SUBMITTED` | review event | OPERATIONAL | `REV-P1-04` |
| `PROF-02` | approval exact basis | review submitted | approve | N/A | `APPROVED` | reviewer/basis digest | approval without basis | `REV-P1-04` |
| `PROF-03` | rejection/return | review | reject/return | N/A | correct state | events retained | approved fallback | `REV-P1-04` |
| `PROF-04` | reviewer cannot self-approve | submitter=reviewer | approve | N/A | 403 | no approval event | self-approved | `REV-P1-04` |
| `PROF-05` | model confidence ignored | low/high confidence | approve attempt | N/A | no approval | review requires actor | confidence approves | `REV-P1-04` |
| `PROF-06` | change invalidates review | approved | mutate source/spec/rule | N/A | `EXPIRED_OR_INVALIDATED` | invalidation event | old approval reused | `REV-P1-04` |

## 7. Sales Snapshot

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `SNP-01` | handoff binds exact requirement/run | confirmed R/selection S | create handoff | N/A | snapshot created | IDs/payload in snapshot | latest dynamic substitute | `REV-P1-06` |
| `SNP-02` | snapshot remains after R2/S2 | existing handoff | create new versions | N/A | history shows v1 | old payload/digest unchanged | v1 mutated | `REV-P1-06` |
| `SNP-03` | normalized item exact product/spec/price | handoff | create snapshot | N/A | item list | FKs exact | array-only refs | `REV-P1-06` |
| `SNP-04` | source revision digest captured | handoff | inspect item | N/A | source digest | immutable item-source row | source current only | `REV-P1-06` |
| `SNP-05` | review state captured | handoff | inspect payload | N/A | review status/time | payload | review later mutable | `REV-P1-06` |
| `SNP-06` | missing risk/parameter retained | handoff | inspect payload | N/A | risk fields | payload | omitted | `REV-P1-06` |
| `SNP-07` | snapshot update rejected | snapshot | SQL update payload | N/A | N/A | trigger rejection | payload changed | `REV-P1-06` |
| `SNP-08` | snapshot item delete rejected | snapshot item | SQL delete | N/A | N/A | trigger rejection | item deleted | `REV-P1-06` |
| `SNP-09` | new handoff version | existing case | second handoff | N/A | version 2 | both snapshots | overwrite | `REV-P1-06` |
| `SNP-10` | sales notes append-only | snapshot | add note | N/A | 201 | note row | snapshot changed | `REV-P1-06` |
| `SNP-11` | snapshot after source withdrawal | snapshot v1 | withdraw source | N/A | original evidence + stale marker | v1 payload unchanged | unable to explain | `REV-P2-08` |
| `SNP-12` | unauthorized detail | other project | GET | N/A | 403/404 | no content | existence leak | `REV-P2-03` |
| `SNP-13` | assigned sales FK | invalid user | assign | N/A | 400/422 | no row | orphan assignee | `REV-P2-03` |
| `SNP-14` | canonical digest changes with payload | snapshot | mutate canonical input in test | N/A | digest changes | new snapshot | same digest | `REV-P1-06` |
| `DB-17` | snapshot requirement/project FK | cross-project req | insert | N/A | N/A | FK violation | cross-project | `REV-P1-06` |
| `DB-18` | snapshot selection/project FK | cross-project run | insert | N/A | N/A | FK violation | cross-project | `REV-P1-06` |
| `DB-19` | snapshot item spec/product FK | wrong spec/product | insert | N/A | N/A | FK/check failure | wrong pair | `REV-P1-06` |
| `DB-20` | snapshot item price/product FK | wrong price/product | insert | N/A | N/A | FK/check failure | wrong pair | `REV-P1-06` |
| `DB-21` | snapshot immutable | existing snapshot | update/delete | N/A | N/A | trigger rejection | mutation | `REV-P1-06` |
| `DB-22` | assigned user FK | invalid user | insert/update | N/A | N/A | FK failure | orphan | `REV-P2-03` |

## 8. Authorization, Same-Origin and Query Scope

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `CS-01` | project POST requires exact origin | authenticated | no Origin | N/A | 403 | no project | project created | `REV-P2-02` |
| `CS-02` | malicious Origin denied | authenticated | bad Origin | N/A | 403 | no mutation | mutation persists | `REV-P2-02` |
| `CS-03` | content type enforced | JSON endpoint | text/plain | N/A | 415 | no mutation | parsed as JSON | `REV-P2-02` |
| `CS-04` | route inventory complete | all mutation routes | static scan | N/A | test pass | guard map complete | unguarded route | `REV-P2-02` |
| `AUTH-01` | unauthenticated denied | none | mutation | N/A | 401 | no mutation | accepted | `REV-P2-02` |
| `AUTH-02` | customer B denied project A | two customers | read/write | N/A | 403/404 | unchanged | data returned | `REV-P2-02` |
| `AUTH-03` | sales unassigned denied | sales B | handoff read/write | N/A | 403/404 | unchanged | data returned | `REV-P2-03` |
| `AUTH-04` | customer cannot review catalog | customer | review | N/A | 403 | no review | approved | `REV-P2-03` |
| `SAL-01` | sales assignee must be a user | valid handoff | assign unknown user | N/A | 400/422 | no assignment | orphan ID | `REV-P2-03` |
| `SAL-02` | assignee must have project scope | user without project role | assign | N/A | 403/422 | unchanged | unauthorized access | `REV-P2-03` |
| `SAL-03` | reassignment audited | authorized assignee | change assignee | N/A | 200 | old/new actor event | silent reassignment | `REV-P2-03` |
| `SAL-04` | disabled/removed user handling | disabled sales user | read/update | N/A | denied | no note/state change | access persists | `REV-P2-03` |
| `SQ-01` | sales list scoped before query | P1/P2 | list | N/A | only P1 | SQL filter | P2 loaded | `REV-P2-03` |
| `SQ-02` | empty scope no query | no assigned projects | list | N/A | empty | no global rows | global scan | `REV-P2-03` |
| `SQ-03` | pagination scoped | mixed projects | page | N/A | no leak | stable cursor | page/count leak | `REV-P2-03` |
| `SQ-04` | count scoped | mixed projects | count | N/A | filtered count | SQL predicate | total leak | `REV-P2-03` |

## 9. Effective Time

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `EFF-01` | start boundary inclusive | spec starts T | evaluate at T | N/A | selected | `[from,to)` | excluded incorrectly | `REV-P2-05` |
| `EFF-02` | end boundary exclusive | spec ends T | evaluate at T | N/A | excluded | no selected | included incorrectly | `REV-P2-05` |
| `EFF-03` | timezone same | server/client clocks differ | evaluate | N/A | same result | UTC | different result | `REV-P2-05` |
| `EFF-04` | overlapping spec rejected | approved v1 | insert v2 overlap | N/A | N/A | exclusion constraint | ambiguous | `REV-P2-05` |
| `EFF-05` | overlapping price rejected | price v1 | insert v2 overlap | N/A | N/A | exclusion constraint | ambiguous | `REV-P2-05` |
| `EFF-06` | no unique version fail | two ambiguous rows preloaded | evaluate | N/A | insufficient/error | no arbitrary selection | wrong version | `REV-P2-05` |

## 10. Migration and Legacy

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `MIG-01` | preflight blocks mixed scenarios | legacy project | dry validation | N/A | report block | no migration | guessed scenario | `REV-P1-02` |
| `MIG-02` | legacy VERIFIED quarantined | no review/source | migrate | N/A | excluded formal | `LEGACY_REVIEW_REQUIRED` | auto verified | `REV-P1-05` |
| `MIG-03` | legacy handoff read-only | no snapshot | migrate | N/A | legacy status | no fake snapshot | current state copied | `REV-P1-06` |
| `MIG-04` | JSON/field mismatch block | mismatch fixture | migrate | N/A | fail/ quarantine | no overwrite | silent choice | `REV-P1-03` |
| `MIG-05` | constraint order | empty cloned DB | migration | N/A | success | constraints/FKs present | order failure | `REV-P2-01` |
| `MIG-06` | rollback boundary | migration failure | inject | N/A | fail closed | no partial authoritative data | partial commit | `REV-P1-02` |
| `MIG-07` | old selection history | legacy run | read | N/A | `legacyBasis=true` | old run unchanged | relabeled operational | `REV-P2-08` |
| `MIG-08` | no P1-3 table changed | separate projects | scan migration | N/A | no file/lifecycle changes | P1-3 untouched | lifecycle change | out of scope |

## 11. Idempotency, Transaction, and Concurrency

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `TX-01` | no partial interaction on assistant failure | new message | inject assistant insert error | N/A | error | no user/req/assistant | partial rows | `REV-P2-07` |
| `TX-02` | no partial interaction on requirement failure | new message | inject requirement error | N/A | error | no user/assistant | partial | `REV-P2-07` |
| `TX-03` | pointer failure rolls back | valid parse | inject pointer CAS fail | N/A | 409 | no version/field/message | orphan | `REV-P1-02` |
| `TX-04` | selection snapshot consistent | requirement/rule/catalog | inject run insert fail | N/A | error | no partial candidate | partial | `REV-P1-03` |
| `TX-05` | handoff atomic | candidate evidence | inject item insert fail | N/A | error | no header/payload/item | partial | `REV-P1-06` |
| `TX-06` | concurrent handoff versions | no current snapshot | two create requests | two connections | one version, one conflict/next version policy | no overwrite | duplicate | `REV-P1-06` |

## 12. Requirement History UI/API

| ID | Invariant | Preconditions | Operation | Concurrent condition | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|---|---|---|
| `HIS-01` | history includes every version | edited requirement | GET history | N/A | ordered versions | all version rows | only latest | `REV-P2-04` |
| `HIS-02` | sources per version | corrected value | GET history | N/A | source refs | assertion links | source missing | `REV-P2-04` |
| `HIS-03` | conflict resolution shown | conflict resolved | GET history | N/A | resolution event | conflict/status | overwritten | `REV-P2-04` |
| `HIS-04` | historical selection shows stale basis | source withdrawn | GET run | N/A | stale marker | unchanged run | current Operational label | `REV-P2-08` |
| `HIS-05` | browser history | two versions | UI open | N/A | both visible | no mutation | only latest | `REV-P2-04` |

## 13. API/E2E/Browser

| ID | Scenario | Expected API | Expected DB | Failure assertion | Finding |
|---|---|---|---|---|---|
| `E2E-01` | old-building flow | preliminary/Demo, no unapproved Operational | exact requirement/source/selection | hidden false | `REV-P1-01` |
| `E2E-02` | new-building flow | drawing metadata only | scenario/requirement | drawing recognized | `REV-P1-02` |
| `E2E-03` | renovation negative external | false/confirmation required | source assertion | true | `REV-P1-01` |
| `E2E-04` | two conversations | independent result | separate pointers | contamination | `REV-P1-02` |
| `E2E-05` | conflict/CAS | 409/structured confirmation | no overwrite | silent overwrite | `REV-P1-02` |
| `E2E-06` | DEMO verify attempt | denied | no verified state | demo formal | `REV-P1-05` |
| `E2E-07` | expired price | REQUIRES_QUOTE | no budget pass | operational | `REV-P1-07` |
| `E2E-08` | missing critical data | insufficient | missing field | inferred | `REV-P1-04` |
| `E2E-09` | handoff + later edit | snapshot unchanged | snapshot/item rows | mutated | `REV-P1-06` |
| `E2E-10` | cross-customer | denied | unchanged | access | `REV-P2-03` |
| `E2E-11` | bad origin | 403 | unchanged | created | `REV-P2-02` |
| `E2E-12` | sales scoped list | only assigned | no leak | leak | `REV-P2-03` |
| `UI-01` | desktop/mobile login/home | usable | no mutation | inaccessible/overflow | `REV-P2-04` |
| `UI-02` | conversation switch | independent requirement display | no mutation | wrong state | `REV-P1-02` |
| `UI-03` | semantic conflict | confirmation control | no unsafe write | auto confirm | `REV-P1-01` |
| `UI-04` | catalog review separation | reviewer flow | exact revision | direct verified control | `REV-P1-05` |
| `UI-05` | sales snapshot/current | difference shown | no overwrite | ambiguity | `REV-P1-06` |

## 14. Build/Test Infrastructure

| ID | Invariant | Operation | Expected | Failure condition |
|---|---|---|---|---|
| `TI-01` | clean install | `pnpm install --frozen-lockfile` in authorized env | dependencies linked | install fails |
| `TI-02` | authority-core Vitest | `pnpm --filter @elevator/authority-core exec vitest run` | executable resolved | command not found |
| `TI-03` | root test | root `pnpm test` | all packages execute | recursive test fails to resolve binary |
| `TI-04` | worker determinism | serial/isolated worker suite repeated | stable pass | timeout under normal supported concurrency |
| `TI-05` | DB guard | `pnpm test:db:verify` | isolated identity | wrong database/role/marker |
| `TI-06` | no secret logging | scan test output/log | no secret | credential pattern |

## 15. Test Matrix Completion Gate

```text
Every P1 finding has at least one direct negative test: REQUIRED
Every P2 finding has a regression test: REQUIRED
Every DB invariant asserts final DB state: REQUIRED
Concurrency tests use real separate connections: REQUIRED
Snapshot tests compare canonical payload before/after withdrawal: REQUIRED
No P1-3 test is mixed into product acceptance: REQUIRED
```

