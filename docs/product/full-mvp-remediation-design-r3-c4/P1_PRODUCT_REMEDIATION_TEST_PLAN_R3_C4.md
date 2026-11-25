# P1 Product Remediation Test Plan R3-C4

Status:

```text
DESIGN-TIME TEST PLAN
NO TEST EXECUTED
```

## 1. ProfessionalReview Composite FK

| ID | Finding | Operation | Expected rejection / final state |
|---|---|---|---|
| `C4-PRO-01` | Event ID valid, wrong Review ID | direct insert event | Event Review FK failure; no event |
| `C4-PRO-02` | Review ID valid, wrong Project | direct insert event/FieldValue | six-column FK failure |
| `C4-PRO-03` | Project valid, wrong Conversation | direct insert event/FieldValue | six-column FK failure |
| `C4-PRO-04` | Conversation valid, wrong Requirement | direct insert event/FieldValue | six-column FK failure |
| `C4-PRO-05` | Requirement valid, wrong Version | direct insert event/FieldValue | six-column FK failure |
| `C4-PRO-06` | Version valid, wrong Scenario | direct insert event/FieldValue | six-column FK failure |
| `C4-PRO-07` | any source FK column NULL | direct insert | NOT NULL/CHECK failure |
| `C4-PRO-08` | Event parent delete/update | direct DML | RESTRICT/append-only rejection |
| `C4-PRO-09` | Event sequence/state version duplicate | concurrent append | unique/CAS conflict; one event |
| `C4-PRO-10` | concurrent approve/invalidate | two connections | one consistent final state; no stale approval |
| `C4-PRO-11` | Snapshot FieldValue exact source, wrong Event | direct Snapshot insert | sourceKey/FK/deferred failure |
| `C4-PRO-12` | policy author self-approval | reviewer/policy role | permission/event rejection |

## 2. Snapshot Registry

| ID | Finding | Operation | Expected |
|---|---|---|---|
| `C4-SNP-01` | all nine record types | create C4-SNAP-01 | 15 records present |
| `C4-SNP-02` | two Requirement Fields | alter field order/input order | same canonical Basis |
| `C4-SNP-03` | two Candidates | omit one | deferred completeness failure |
| `C4-SNP-04` | two Parameters/Prices | wrong candidate key | composite FK failure |
| `C4-SNP-05` | two Sources | missing source row | completeness failure |
| `C4-SNP-06` | review linkage | wrong review target | typed review FK/trigger failure |
| `C4-SNP-07` | warning/missing field | omit or duplicate | completeness/stableKey failure |
| `C4-SNP-08` | unknown record type | direct insert | registry rejection |
| `C4-SNP-09` | unknown field tag | direct insert | registry rejection |
| `C4-SNP-10` | duplicate stableKey | two records | rejection |
| `C4-SNP-11` | sourceKey special chars | structured source round-trip | canonical key identical; no split ambiguity |
| `C4-SNP-12` | header/child mismatch | wrong case/project/run | deferred commit failure |
| `C4-SNP-13` | snapshot finalization failure | inject child failure | no header/child/pointer commit |
| `C4-SNP-14` | post-finalization mutation | update/delete | privilege/trigger failure |
| `C4-SNP-15` | source withdrawal race | concurrent create/withdraw | one complete basis or rollback |

## 3. R3-BASIS V4

| ID | Finding | Operation | Expected |
|---|---|---|---|
| `C4-BASIS-01` | generic framing | C3 V01–V23 | byte-identical |
| `C4-BASIS-02` | full Snapshot | C4-SNAP-01 | 2350 bytes, SHA `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2` |
| `C4-BASIS-03` | record order | V22/V23-like input order reversal | identical Basis |
| `C4-BASIS-04` | field order | V21-like field order reversal | identical Basis |
| `C4-BASIS-05` | invalid UTF-8 | V24 | reject before hash |
| `C4-BASIS-06` | oversized text | V25 | reject before hash |
| `C4-BASIS-07` | duplicate stableKey | V26 | reject before hash |
| `C4-BASIS-08` | Node/Python independence | full canonical vector | byte-identical bytes/hash |

## 4. Typed Field Catalogue

| ID | Finding | Operation | Expected |
|---|---|---|---|
| `C4-FIELD-01` | type/value mismatch | write text into integer | CHECK failure |
| `C4-FIELD-02` | unknown field key | insert new key | catalogue rejection |
| `C4-FIELD-03` | unknown unit | set unsupported unit | CHECK failure |
| `C4-FIELD-04` | decimal scale/range | set overflow/extra scale | numeric/CHECK failure |
| `C4-FIELD-05` | null vs zero | insert unknown budget as 0 | reject |
| `C4-FIELD-06` | confirmed without source | omit confirmation/source | reject |

## 5. Legacy Mapping

| ID | Finding | Operation | Expected |
|---|---|---|---|
| `C4-LEG-01` | legacy string number | map `"8"` floorCount | INTEGER 8, not text |
| `C4-LEG-02` | ambiguous boolean | map `"yes"` | quarantine |
| `C4-LEG-03` | unknown unit | map unknown unit | quarantine |
| `C4-LEG-04` | conflicting JSON fields | migrate | quarantine, no guessed value |
| `C4-LEG-05` | unknown source | migrate | quarantine, no SYSTEM_DERIVED |
| `C4-LEG-06` | scenario mismatch | migrate | quarantine/no formal value |

## 6. Event Permissions

| ID | Finding | Operation | Expected |
|---|---|---|---|
| `C4-PRIV-01` | runtime direct Event insert | direct SQL | permission denial |
| `C4-PRIV-02` | runtime Event update/delete/truncate | direct SQL | trigger/permission denial |
| `C4-PRIV-03` | PUBLIC execute transition | anonymous role | EXECUTE denial |
| `C4-PRIV-04` | reviewer executes allowed transition | function | one event |
| `C4-PRIV-05` | policy author self-approves | function/event | denial |
| `C4-PRIV-06` | two concurrent transitions | two connections | one event/CAS winner |

## 7. Completion Gate

```text
Exact ProfessionalReview FK: PASS REQUIRED
Full Snapshot Registry: PASS REQUIRED
Complete normalized child schema: PASS REQUIRED
Deferred validation: PASS REQUIRED
C4-SNAP-01 full Basis: PASS REQUIRED
Node/Python byte identity: PASS REQUIRED
Typed catalogue: PASS REQUIRED
Legacy mapping/quarantine: PASS REQUIRED
Event-only privileges: PASS REQUIRED
No P1-3 modification: REQUIRED
No implementation authorization: REMAINS
```
