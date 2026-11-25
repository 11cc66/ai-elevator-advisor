# P1 Product Remediation Test Plan R3-C5

Status:

```text
DESIGN-TIME TEST PLAN
NO PRODUCT TEST EXECUTED
NO DATABASE CONNECTED
```

## 1. StableKey

| ID | Input | Expected |
|---|---|---|
| `C5-SK-01` | PRICE(`a:b`,`c`) | Complete bytes distinct from PRICE(`a`,`b:c`) |
| `C5-SK-02` | Empty required component | Registry rejection |
| `C5-SK-03` | Explicit NULL component | Registry rejection; bytes distinct from empty |
| `C5-SK-04` | Missing component | Reject before encoder |
| `C5-SK-05` | NFC/NFD/multibyte ID | Reject as non-ASCII |
| `C5-SK-06` | Multi-segment tuple | Index/count boundaries preserved |
| `C5-SK-07` | INT64 1 vs TEXT `"1"` | Type domain prevents confusion |
| `C5-SK-08` | INT64 1 vs textual `"01"` | Only numeric INT64 accepted |
| `C5-SK-09` | Same tuple in Record 3/4 | RecordType bytes differ |
| `C5-SK-10` | Same tuple in Registry 1/2 | Registry code differs |
| `C5-SK-11` | Prefix strings | Length prevents ambiguity |
| `C5-SK-12` | 64-byte/65-byte component | Accept/reject |
| `C5-SK-13` | Historical colon-bearing ID | Exact ASCII bytes preserved |
| `C5-SK-14` | R1 colon key attempt | Reject as unregistered under R2 |

## 2. Registry and Schema

| ID | Test | Expected |
|---|---|---|
| `C5-REG-01` | Enumerate record types | Exactly 0..9 |
| `C5-REG-02` | Duplicate/add/remove field tag | Reject |
| `C5-REG-03` | Field order reversed in semantic JSON | Canonical Basis unchanged |
| `C5-REG-04` | Field order wrong in encoded frame | Decoder rejects |
| `C5-REG-05` | Source row without `source_kind` | Schema impossible / reject |
| `C5-REG-06` | Catalog review missing target/policy | Schema impossible / reject |
| `C5-REG-07` | Warning without structured sequence | Schema impossible / reject |
| `C5-REG-08` | Requirement source change with stale sourceKey | CHECK/deferred fail closed |
| `C5-REG-09` | Crosswalk counts | 9+11+9+6+6+4+5+5+4+3 registry tags all mapped |
| `C5-REG-10` | Unknown Registry/protocol/encoding version | Reject |

## 3. Composite FKs and NULL

| ID | Test | Expected |
|---|---|---|
| `C5-FK-01` | Candidate child links Candidate in other Snapshot | Composite FK reject |
| `C5-FK-02` | Parameter/Price/Warning/Missing cross Snapshot candidate | Reject |
| `C5-FK-03` | Source binding has wrong Requirement/Version/Scenario | Reject |
| `C5-FK-04` | Professional Event wrong six-column context | Reject |
| `C5-FK-05` | Professional Event wrong Review or policy | Seven-column FK reject |
| `C5-FK-06` | Any source/ownership key NULL | Reject; no `MATCH SIMPLE` bypass |
| `C5-FK-07` | Catalog Review target/policy mismatch | Composite FK reject |
| `C5-FK-08` | Parent update/delete | RESTRICT |
| `C5-FK-09` | Insert Snapshot child with another project | Context FK reject |

## 4. Snapshot Completeness and Deferred Commit

| ID | Transaction | Expected |
|---|---|---|
| `C5-SNAP-01` | Incomplete DRAFT then complete before commit | Commit |
| `C5-SNAP-02` | Incomplete DRAFT commit | Deferred failure, rollback |
| `C5-SNAP-03` | Candidate missing required parameter/price/source/review | Failure |
| `C5-SNAP-04` | Warning/Missing row omitted | Failure when required |
| `C5-SNAP-05` | Two different Basis metadata rows | PK/unique failure |
| `C5-SNAP-06` | Duplicate stableKey/rowId | Unique failure |
| `C5-SNAP-07` | Metadata hash/length/count mismatch | Deferred verifier failure |
| `C5-SNAP-08` | Child changed after finalization | Immediate guard failure |
| `C5-SNAP-09` | Delete/move source binding | FK/guard failure |
| `C5-SNAP-10` | `TRUNCATE` canonical table | Guard/privilege failure |
| `C5-SNAP-11` | Direct ordinary-role child DML | Privilege failure |
| `C5-SNAP-12` | Insert child from finalized parent | Immediate guard failure |

## 5. Concurrency

| ID | Scenario | Expected |
|---|---|---|
| `C5-CON-01` | TX-A fill incomplete then complete | One complete commit |
| `C5-CON-02` | TX-B incomplete commit | Rollback |
| `C5-CON-03` | TX-C two Finalize calls | One winner by Case/Snapshot lock + CAS |
| `C5-CON-04` | TX-D mutate child while finalizing | One serial order; no invalid commit |
| `C5-CON-05` | TX-E mutate FINALIZED | Reject |
| `C5-CON-06` | TX-F delete/move source binding | Reject |
| `C5-CON-07` | TX-G concurrent truncate/direct DML | Reject |
| `C5-CON-08` | serialization failure | Bounded retry only 40001/40P01 |
| `C5-CON-09` | commit unknown | Re-read durable request/sequence/state |

## 6. Basis Reproduction

| ID | Test | Expected |
|---|---|---|
| `C5-BASIS-01` | Parse `C5_SNAPSHOT_VECTOR_01.json` | 15 records, types 0..9 |
| `C5-BASIS-02` | Node encoder | 3051 bytes, `83F00E53...56FB1` |
| `C5-BASIS-03` | Python encoder | Same length/hash |
| `C5-BASIS-04` | Complete byte compare | Equal; first difference none |
| `C5-BASIS-05` | Reverse record/field input order | Canonical bytes unchanged |
| `C5-BASIS-06` | Duplicate stableKey | Reject before hash |
| `C5-BASIS-07` | Invalid UTF-8/NFC | Reject |
| `C5-BASIS-08` | Length/body/trailing mismatch | Reject |
| `C5-BASIS-09` | NULL vs absent | R5 distinguishes/rejects absent |

## 7. Trusted Principal and Authority

| ID | Test | Expected |
|---|---|---|
| `C5-AUTH-01` | Reviewer A claims B actor ID | No parameter exists; event actor remains A |
| `C5-AUTH-02` | Reviewer A uses B authority grant | Authority lookup reject |
| `C5-AUTH-03` | Expired/revoked authority | Reject |
| `C5-AUTH-04` | Self-approve own review | Reject |
| `C5-AUTH-05` | Policy author self-approves policy | Reject |
| `C5-AUTH-06` | Undefined command/state | Reject |
| `C5-AUTH-07` | Stale policy/revision/basis | Conflict |
| `C5-AUTH-08` | Replay same request/hash | One event, replay=true |
| `C5-AUTH-09` | Replay same request/changed hash | Conflict |
| `C5-AUTH-10` | Concurrent approvals | One event/CAS winner |
| `C5-AUTH-11` | Shared runtime role | Reject as trusted principal |
| `C5-AUTH-12` | Owner/migrator session as actor | Reject outside break-glass |

## 8. PostgreSQL Owner/Role/Privilege

| ID | Test | Expected |
|---|---|---|
| `C5-PRIV-01` | PUBLIC schema/table/function access | Denied |
| `C5-PRIV-02` | Runtime table DML/TRUNCATE | Denied |
| `C5-PRIV-03` | Runtime sequence access | Denied |
| `C5-PRIV-04` | Runtime execute trigger/validator functions | Denied |
| `C5-PRIV-05` | Runtime SET ROLE to owner/migrator | Denied |
| `C5-PRIV-06` | Role inheritance circumvents revoke | Denied |
| `C5-PRIV-07` | Function owner/search_path/dynamic SQL | Exact allowlist |
| `C5-PRIV-08` | Default privileges for future objects | PUBLIC revoked |
| `C5-PRIV-09` | `TRUNCATE` as table owner | Guard/administrative path |
| `C5-PRIV-10` | Direct base-table read of Event | Denied; view only |

## 9. ProfessionalReview Source

| ID | Test | Expected |
|---|---|---|
| `C5-PRO-01` | Event wrong Review parent | FK reject |
| `C5-PRO-02` | Event wrong project/conversation/requirement/version/scenario | FK reject |
| `C5-PRO-03` | FieldValue/Assertion wrong Event | six-column FK reject |
| `C5-PRO-04` | Event policy differs from Review | seven-column FK reject |
| `C5-PRO-05` | Event policy missing/unknown | FK reject |
| `C5-PRO-06` | Event update/delete | append-only reject |
| `C5-PRO-07` | Event TRUNCATE | privilege/trigger reject |

## 10. Typed Catalogue and Legacy Mapping

| ID | Test | Expected |
|---|---|---|
| `C5-TYPE-01` | value type/typed column mismatch | Reject |
| `C5-TYPE-02` | unknown unit/key/enum | Reject |
| `C5-TYPE-03` | `budgetMin > budgetMax` | New typed write rejects; legacy import quarantines |
| `C5-TYPE-04` | null vs zero | Distinct |
| `C5-TYPE-05` | ambiguous JSON boolean/number | Quarantine |
| `C5-TYPE-06` | conflicting legacy fields | Quarantine |
| `C5-TYPE-07` | scenario mismatch | Quarantine |
| `C5-TYPE-08` | raw JSON unchanged after migration | Preserved evidence |

## 11. Open Decision Gates

No DB test may run until:

- `OD-R3-C3-01` CUID/Text accepted;
- `OD-R3-C4-01` Registry R2 approved;
- `OD-R3-C4-02` field/unit catalogue approved;
- `OD-R3-C4-03` deployment owners/roles approved;
- `OD-R3-C5-01` trusted identity mechanism approved;
- `OD-R3-C5-02` R2/R5 rollout approved.

All 41 historical decisions remain open.

