# P1 Product Remediation Test Plan

This is an executable test design for a later authorized implementation. No test in this document was executed by the design task.

## 1. Test principles

- Assert final persisted state and user-visible status, not only HTTP success.
- Assert effect absence on denied input.
- Engineering-safety tests assert `INSUFFICIENT_DATA`, `REQUIRES_PROFESSIONAL_REVIEW` or `NOT_ELIGIBLE` explicitly.
- No test may enable `OPERATIONAL` using a rule lacking approved authority.
- Cross-project tests use two distinct projects and customers.
- Database tests use only the approved isolated test database/clone.
- Browser tests use a separately authorized pinned browser.
- Tests must fail closed if fixture identity, rule version or database marker is missing.

## 2. Requirement semantic tests

### NS — External-installation semantics

| ID | Input | Operation | Expected value | Expected status | Failure condition |
|---|---|---|---|---|---|
| `NS-01` | `外装允许` | parse | `true` | `EXTRACTED_EXPLICIT` | false/confirmation |
| `NS-02` | `外装不允许` | parse | `false` | `EXTRACTED_EXPLICIT` | true or no value |
| `NS-03` | `不允许外装` | parse | `false` | `EXTRACTED_EXPLICIT` | true |
| `NS-04` | `可以外装` | parse | `true` | `EXTRACTED_EXPLICIT` | false |
| `NS-05` | `暂时不确定是否允许外装` | parse | absent | `NEEDS_CONFIRMATION` | any boolean persisted |
| `NS-06` | `不排除外装` | parse | absent | `NEEDS_CONFIRMATION` | automatic true |
| `NS-07` | `原本允许，现在不允许` | parse against prior true | `false` | `EXTRACTED_EXPLICIT` with explicit correction | prior value overwritten without history |
| `NS-08` | `不允许内装以外的方案` | parse | absent | `NEEDS_CONFIRMATION` | automatic false/true |
| `NS-09` | `外装可以，但又不允许外装` | parse | two candidates | `CONFLICT` | one value silently selected |
| `NS-10` | Previous true; new `外装不允许` without correction marker | parse | no automatic overwrite | `CONFLICT`/`NEEDS_CONFIRMATION` | silent false |
| `NS-11` | Previous true; new `更正：外装不允许` | parse | `false` | explicit supersede | old value lost |
| `NS-12` | Unrelated `不允许` in another sentence plus `外装可以` | parse | true for external | `EXTRACTED_EXPLICIT` | cross-sentence negation bleed |
| `NS-13` | Mixed punctuation/full-width input | parse | normalized expected | correct status | parser crash or wrong field |
| `NS-14` | Unsupported ambiguous phrase | parse | absent | `NEEDS_CONFIRMATION` | guessed value |

Assertions:

- candidate source contains exact message ID and source span;
- parser rule ID/version is persisted;
- no field row exists for `NEEDS_CONFIRMATION/CONFLICT`;
- conflicts remain queryable and resolvable only through explicit correction.

## 3. Conversation identity and API tests

| ID | Setup/input | Operation | Expected | Failure condition |
|---|---|---|---|---|
| `CI-01` | Project P, conversation A | create conversation | scenario inherited from P; current requirement belongs A | client-provided scenario accepted |
| `CI-02` | P has conversations A/B | send A message | only A requirement pointer/version changes | project latest or B changes |
| `CI-03` | A has confirmed vA, B draft vB | GET A | returns A current requirement | returns B/latest project |
| `CI-04` | A closed | message A | 409/422 read-only | mutation succeeds |
| `CI-05` | A/B independent concurrent messages | execute concurrently | separate sequences and requirement chains | cross-linked conversationId |
| `CI-06` | conversation ID from project B under project A URL | GET/POST | 404/403 | data returned or changed |
| `CI-07` | Requirement conversation null/legacy ambiguous | GET/edit | explicit legacy error/read-only | guessed conversation |
| `CI-08` | Retry same clientMessageId | send twice | one user message/one assistant/one requirement version | duplicates |
| `CI-09` | Project current head exists | open A | A uses own pointer, not head | head substituted into A |

## 4. Project Type tests

| ID | Setup | Operation | Expected | Failure condition |
|---|---|---|---|---|
| `PT-01` | Project old addition | create conversation without scenario | derives `OLD_BUILDING_ADDITION` | requires/trusts client scenario |
| `PT-02` | Project old addition | POST conversation `NEW_BUILDING_INSTALLATION` | 422 or field rejected | creates new-building conversation |
| `PT-03` | Project old addition | PATCH requirement scenario | 422/field rejected | scenario changes |
| `PT-04` | Project no conversations | admin change type | allowed with audit | unauthorized non-admin change |
| `PT-05` | Project with conversation | admin change type | 409 immutable | type changes |
| `PT-06` | Existing legacy `OLD_BUILDING_ELEVATOR` | migration/preflight | explicit normalization only if consistent | guessed change |

## 5. Requirement CAS and provenance tests

| ID | Setup | Operation | Expected | Failure condition |
|---|---|---|---|---|
| `CC-01` | current version 3 | PATCH expected 2 | 409 + current version 3 | mutation succeeds |
| `CC-02` | two concurrent PATCH expected 3 | both run | one new version, one 409 | both overwrite |
| `CC-03` | two conversations | concurrent PATCH | no cross-conversation blocking loss | lost unrelated update |
| `CC-04` | confirm expected stale | POST confirm | 409 | confirms latest silently |
| `CC-05` | current DRAFT with missing fields | confirm | 409 `INSUFFICIENT_DATA` | confirms |
| `CC-06` | customer confirmed ordinary field | read field status | CUSTOMER_CONFIRMED only | professional status |
| `CC-07` | client sends fieldSources/sourceType/status | PATCH | 400/ignored by server-defined contract | trusted metadata overwritten |
| `CC-08` | two concurrent confirmations | execute | at most one pointer transition | double project head |
| `PV-01` | AI extracted field | persist | source type MOCK_AI, message ID/span | missing provenance |
| `PV-02` | customer manual edit | persist | CUSTOMER_STATED | forged model source |
| `PV-03` | professional measurement | persist after authorized workflow | FIELD_MEASURED/PROFESSIONALLY_CONFIRMED | customer claim becomes professional |
| `PV-04` | correction | persist | old field invalidated/superseded | in-place overwrite |

## 6. Atomic transaction tests

| ID | Failure injection | Expected |
|---|---|---|
| `TX-01` | assistant message insert fails | no visible user message/requirement version |
| `TX-02` | requirement insert fails | no assistant response committed as complete interaction |
| `TX-03` | conversation pointer CAS fails | no field/requirement/message side effects |
| `TX-04` | duplicate clientMessageId | idempotent existing result, no duplicate |
| `TX-05` | provider real-call path simulation | DB transaction not held over network call |
| `TX-06` | commit retry | no duplicate sequence/version |

## 7. Catalog trust tests

### CT — Source, review and classification

| ID | Input/state | Operation | Expected | Failure condition |
|---|---|---|---|---|
| `CT-01` | DEMO_MOCK product | attempt VERIFIED | 409/422 | status changes |
| `CT-02` | DEMO_MOCK source | bind to formal product | rejected | demo source becomes review evidence |
| `CT-03` | VERIFIED request without review | submit/read | excluded from formal | displayed formal |
| `CT-04` | Product Admin | approve own submission | rejected if separation enabled | self-approved |
| `CT-05` | withdrawn source | query formal | product excluded | remains formal |
| `CT-06` | expired source | query formal | excluded/requote | accepted |
| `CT-07` | manufacturer DISABLED | query formal | product excluded | included |
| `CT-08` | brand DISABLED | query formal | product excluded | included |
| `CT-09` | product revision rejected | query formal | excluded | included |
| `CT-10` | specification DRAFT/PENDING | query formal | excluded | included |
| `CT-11` | specification `effectiveTo <= now` | query | excluded/insufficient | selected |
| `CT-12` | price expired | selection | `REQUIRES_QUOTE` | `WITHIN_BUDGET` |
| `CT-13` | price unapproved | selection | `REQUIRES_QUOTE` | formal price |
| `CT-14` | two overlapping effective specs | formal resolver | `AMBIGUOUS_EFFECTIVE_VERSION`, no result | picks one silently |
| `CT-15` | product edit changes scenarios | submit review | old approved revision remains until new approval | mutation of active revision |
| `CT-16` | approved spec edited | commit | new version, old immutable | in-place overwrite |
| `CT-17` | revoked review | current product query | formal exclusion | still formal |
| `CT-18` | legacy VERIFIED without evidence | migration/preflight | `LEGACY_REVIEW_REQUIRED` | auto remains verified |
| `CT-19` | data classification change DEMO->OPERATIONAL | direct API/DB | rejected | permitted |
| `CT-20` | Demo query with client `mode=formal` | request | mode ignored/rejected | client chooses formal |
| `CT-21` | source review pending/rejected | formal query | source invalid, candidate excluded | source trusted |
| `CT-22` | product revision becomes draft after edit | formal query | previous approved version remains only until new approval | draft enters formal |

### RA — Rule authority

| ID | State | Operation | Expected |
|---|---|---|---|
| `RA-01` | no approved rule set | formal evaluate | `REQUIRES_PROFESSIONAL_REVIEW` |
| `RA-02` | floor count 8, no approved capacity/speed rule | evaluate | no inferred threshold/exclusion |
| `RA-03` | approved rule set | evaluate | uses exact version and source |
| `RA-04` | retired rule set | evaluate | excluded/requires current approved set |
| `RA-05` | rule modified after run | read old run | old rule version preserved |
| `RA-06` | rule unit mismatch | evaluate | configuration error, fail closed |
| `RA-07` | unknown rule operator | evaluate | fail closed |
| `RA-08` | duplicate effective rule sets | evaluate | no silent choice |

## 8. Selection reliability tests

| ID | Requirement/product state | Expected candidate | Expected run | Failure condition |
|---|---|---|---|---|
| `SL-01` | VERIFIED product missing `maxTravelM` | `INSUFFICIENT_DATA` | `INSUFFICIENT_DATA` | OPERATIONAL |
| `SL-02` | missing shaft width | `INSUFFICIENT_DATA` | `INSUFFICIENT_DATA` | OPERATIONAL |
| `SL-03` | missing shaft depth | `INSUFFICIENT_DATA` | `INSUFFICIENT_DATA` | OPERATIONAL |
| `SL-04` | missing pit depth | `INSUFFICIENT_DATA` | `INSUFFICIENT_DATA` | OPERATIONAL |
| `SL-05` | missing overhead | `INSUFFICIENT_DATA` | `INSUFFICIENT_DATA` | OPERATIONAL |
| `SL-06` | spec expired | `INSUFFICIENT_DATA` or `NOT_ELIGIBLE` according to reason model | no operational | operational |
| `SL-07` | price expired | technical status does not rely on price; `priceStatus=REQUIRES_QUOTE` | no budget pass | within budget |
| `SL-08` | manufacturer/brand disabled | `NOT_ELIGIBLE` | no eligible formal | candidate shown formal |
| `SL-09` | source withdrawn | `NOT_ELIGIBLE` | formal excluded | accepted |
| `SL-10` | Demo product in formal mode | `NOT_ELIGIBLE` formal; optional preliminary separate view | no operational | operational |
| `SL-11` | complete data, known rule fail | `NOT_ELIGIBLE` with fail check | no operational | silently omitted |
| `SL-12` | complete data, all approved checks pass | `OPERATIONAL` | at least one operational match | PRELIMINARY only |
| `SL-13` | product data incomplete but model could infer | never infer; `INSUFFICIENT_DATA` | no operational | inferred value |
| `SL-14` | multiple candidates mixed completeness | statuses per candidate | all returned | dropped or one status for all |
| `SL-15` | no candidates | no results with reasons | `NO_ELIGIBLE_MATCH` | fabricated candidate |

Assertions for every candidate:

- product revision, spec and price IDs;
- complete check list;
- source IDs and rule set version;
- no warning-free operational on missing data;
- professional review remains true.

## 9. Sales snapshot tests

| ID | Setup | Operation | Expected |
|---|---|---|---|
| `SH-01` | confirmed R1, selection S1 | create handoff | snapshot stores R1/S1 and digests |
| `SH-02` | handoff exists | customer creates R2/S2 | old snapshot bytes/digest unchanged |
| `SH-03` | handoff v1 | create v2 | history returns both |
| `SH-04` | requirement not customer-confirmed | create handoff | 409 |
| `SH-05` | selection belongs other project/requirement | create handoff | 404/403 |
| `SH-06` | snapshot tamper attempt | update/delete | rejected |
| `SH-07` | sales note | append | note adds, snapshot unchanged |
| `SH-08` | current requirement differs from snapshot | sales view | shows both and difference |
| `SH-09` | unauthorized sales detail | GET | 404/403 no existence leak |
| `SH-10` | SQL scoped query | list | only authorized projects in SQL before limit |

## 9.1 SQL-scoped sales query tests

| ID | Setup | Operation | Expected |
|---|---|---|---|
| `SQ-01` | Sales assigned P1, handoff on P2 exists | list | P2 not fetched/joined |
| `SQ-02` | no assigned projects | list | empty result without global handoff query |
| `SQ-03` | global sales permission | list | permitted global result |
| `SQ-04` | mixed projects | paginated list | cursor pages remain scoped |
| `SQ-05` | unauthorized handoff detail | GET | 404/403 without content leak |
| `SQ-06` | unauthorized count | count metadata | count matches filtered set only |
| `SQ-07` | duplicate sort timestamp | pagination | stable id tie-break, no duplicates |
| `SQ-08` | large unauthorized dataset | bounded query plan | authorization predicate before limit and no full application load |

## 10. Same-origin and API mutation tests

| ID | Request | Expected |
|---|---|---|
| `CS-01` | POST project no Origin | 403 |
| `CS-02` | POST project malicious Origin | 403, no project |
| `CS-03` | PATCH requirement correct Origin | continues authorization/CAS |
| `CS-04` | POST selection malicious Origin | no selection run |
| `CS-05` | POST sales handoff malicious Origin | no handoff |
| `CS-06` | PATCH catalog malicious Origin | no version |
| `CS-07` | existing file mutation policy | unchanged or stronger |

## 11. Permission and ID-combination tests

| ID | Actor/input | Expected |
|---|---|---|
| `AU-01` | unauthenticated project read | 401 |
| `AU-02` | Customer B project A | 403 |
| `AU-03` | Customer A conversation ID + Customer B project URL | 403/404 |
| `AU-04` | Sales not assigned | 403 |
| `AU-05` | Sales tries advisor mutation | 403 |
| `AU-06` | Customer tries catalog manage/review | 403 |
| `AU-07` | Product admin tries technical approve | 403 |
| `AU-08` | System admin without review permission | 403 |

## 12. Database invariant tests

Run only in an approved isolated test DB/clone after identity guard.

| ID | SQL-level attempt | Expected SQLSTATE/result |
|---|---|---|
| `DB-01` | conversation currentRequirement from other project | FK violation |
| `DB-02` | requirement conversation from other project | composite FK violation |
| `DB-03` | selection run + requirement cross-project | composite FK violation |
| `DB-04` | recommendation spec from other product | composite FK violation |
| `DB-05` | sales snapshot cross-project requirement | composite FK violation |
| `DB-06` | sales snapshot selection from another requirement | composite FK violation |
| `DB-07` | request current pointer partial nullable mismatch | CHECK violation |
| `DB-08` | update Requirement snapshot | append-only trigger/permission failure |
| `DB-09` | delete SelectionRun | failure |
| `DB-10` | delete SalesHandoffSnapshot | failure |
| `DB-11` | DEMO classification changed | trigger/check failure |
| `DB-12` | DEMO record APPROVED | check failure |
| `DB-13` | formal source linked to demo entity | check failure |
| `DB-14` | duplicate message client id | unique violation |
| `DB-15` | duplicate handoff snapshot version | unique violation |
| `DB-16` | invalid `effectiveFrom >= effectiveTo` | check violation |
| `DB-17` | overlapping approved spec periods | exclusion violation |
| `DB-18` | overlapping approved price periods same scope | exclusion violation |
| `DB-19` | price min > max | check violation |
| `DB-20` | invalid review subject count | check violation |
| `DB-21` | review without evidence where required | constraint/service rejection |
| `DB-22` | withdrawn evidence used by new review | service/constraint rejection |
| `DB-23` | current requirement pointer to another conversation | composite FK violation |
| `DB-24` | sales snapshot product spec/price not bound to selection | constraint/service rejection |

Schema/constraint tests must distinguish statement-time failure from COMMIT-time failure where deferred constraints are used.

## 13. API/E2E tests

| ID | Scenario | Expected |
|---|---|---|
| `E2E-01` | old-building happy path | preliminary/demo result only until approved rules; explicit risks |
| `E2E-02` | new-building one conversation | scenario inherited, drawing not analyzed |
| `E2E-03` | renovation negative external | stored false |
| `E2E-04` | two conversations | independent requirements |
| `E2E-05` | requirement concurrent edits | one success, one 409 |
| `E2E-06` | demo product verification attempt | rejected |
| `E2E-07` | expired price | requote, no budget pass |
| `E2E-08` | missing critical product field | insufficient data |
| `E2E-09` | sales handoff then customer edit | snapshot unchanged |
| `E2E-10` | cross-customer access | denied |
| `E2E-11` | same-origin failure | 403 and state unchanged |
| `E2E-12` | sales scoped list | authorized only |

## 14. Browser tests

Run after a separately authorized browser installation.

| ID | Viewport/route | Expected |
|---|---|---|
| `BR-01` | desktop login/home | accessible controls and Mock/Demo labels |
| `BR-02` | mobile new-project/advisor | usable loading/error/empty states |
| `BR-03` | conversation switch | different requirements remain visible |
| `BR-04` | requirement conflict | confirmation UI blocks unsafe value |
| `BR-05` | product admin approval separation | no direct VERIFIED control in draft editor |
| `BR-06` | catalog expired/unknown | warning/re-quote visible |
| `BR-07` | recommendation all-candidate states | explanations complete |
| `BR-08` | sales snapshot/current difference | both states distinguishable |

Capture:

- console errors;
- failed network responses;
- screenshots at desktop/mobile widths;
- accessibility role/name checks for critical actions.

## 14.1 Demo identity tests

| ID | Configuration | Operation | Expected |
|---|---|---|---|
| `DE-01` | missing demo marker | startup | blocked |
| `DE-02` | unknown database name | startup | blocked |
| `DE-03` | wrong database role | startup | blocked |
| `DE-04` | production Storage root | startup | blocked |
| `DE-05` | non-mock provider setting | startup | blocked |
| `DE-06` | client query/body attempts formal mode | request | ignored/rejected |
| `DE-07` | Demo data in formal filter | query | excluded |
| `DE-08` | formal data in Demo-only seed | fixture validation | rejected |

## 15. Test infrastructure requirements

| ID | Requirement | Acceptance |
|---|---|---|
| `TI-01` | root `pnpm test` resolves all package binaries | clean run |
| `TI-02` | worker PDF tests deterministic under normal CI load | three consecutive passes |
| `TI-03` | DB tests are isolated clones | marker/role/name guard PASS |
| `TI-04` | no secrets or `.env` values printed | log scan PASS |
| `TI-05` | test failure exits non-zero | deliberate fail test |

## 16. Required future command set

Subject to separate implementation/build authorization:

```powershell
pnpm typecheck
pnpm test
pnpm test:db:verify
pnpm test:db:constraints
pnpm test:e2e
pnpm build:packages
pnpm build
pnpm security:startup
```

The P1-3 upload chain remains a separate blocker and may still prevent full repository typecheck/build. Product remediation must not hide that failure.

## 17. Completion criteria for future verification

```text
all semantic tests PASS
all conversation isolation tests PASS
all scenario binding tests PASS
all catalog trust tests PASS
all selection fail-closed tests PASS
all sales snapshot tests PASS
all same-origin tests PASS
all DB composite/effective constraints PASS
all API/E2E PASS
all browser tests PASS
P1-3 separately reviewed or explicitly excluded from the acceptance claim
```

