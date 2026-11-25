# P1 Product Remediation Test Plan R3-C6

Status:

```text
DESIGN-TIME TEST PLAN
NO DATABASE OR PRODUCT TEST EXECUTED
```

## 1. Source Identity

| ID | Input | Expected |
|---|---|---|
| `C6-SRC-01` | SourceKey 361 bytes | ACCEPT |
| `C6-SRC-02` | SourceKey 362 bytes | ACCEPT |
| `C6-SRC-03` | SourceKey 363 bytes | REJECT |
| `C6-SRC-04` | component max | ACCEPT |
| `C6-SRC-05` | component max+1 | REJECT |
| `C6-SRC-06` | AUX NULL | ACCEPT |
| `C6-SRC-07` | AUX empty present | REJECT |
| `C6-SRC-08` | AUX exactly 128 UTF-8 bytes | ACCEPT |
| `C6-SRC-09` | AUX 129 bytes | REJECT |
| `C6-SRC-10` | AUX control character | REJECT |
| `C6-SRC-11` | NFC/NFD Unicode | same canonical key |

## 2. Provenance

| ID | Test | Expected |
|---|---|---|
| `C6-PROV-01` | Product Revision mismatch | FK reject |
| `C6-PROV-02` | Specification Revision mismatch | FK reject |
| `C6-PROV-03` | Price Revision mismatch | FK reject |
| `C6-PROV-04` | SelectionRun mismatch | FK reject |
| `C6-PROV-05` | RequirementVersion mismatch | FK reject |
| `C6-PROV-06` | Parameter revision mismatch | FK reject |
| `C6-PROV-07` | RuleSet mismatch | FK reject |
| `C6-PROV-08` | Sealed result mutation | append-only reject |
| `C6-PROV-09` | Finalized provenance update | guard reject |

## 3. Price

| ID | Test | Expected |
|---|---|---|
| `C6-PRICE-01` | `basisAsOf < validFrom` | reject unless explicit future quote flow |
| `C6-PRICE-02` | `validUntil < basisAsOf` and Candidate Operational | reject |
| `C6-PRICE-03` | expired price with `REQUIRES_QUOTE` | allow non-Operational |
| `C6-PRICE-04` | missing source revision | reject |
| `C6-PRICE-05` | product revision mismatch | reject |
| `C6-PRICE-06` | price basis/currency/tax mismatch | reject |
| `C6-PRICE-07` | post-final source mutation | reject |

## 4. RuleSet

| ID | Test | Expected |
|---|---|---|
| `C6-RULE-01` | Snapshot RuleSet differs from run | reject |
| `C6-RULE-02` | digest mismatch | reject |
| `C6-RULE-03` | missing Basis tags 9–10 | reject |
| `C6-RULE-04` | finalized RuleSet replacement | reject |

## 5. Warning and Missing

| ID | Test | Expected |
|---|---|---|
| `C6-WARN-01` | reversed insertion order | same sequence |
| `C6-WARN-02` | identical code/text, different source IDs | deterministic tie-break |
| `C6-WARN-03` | duplicate sourceWarningId | unique reject |
| `C6-MISS-01` | unknown reason/impact scope | reject |

## 6. Scalar/Basis

Use `SCALAR_ACCEPT_REJECT_VECTORS_R3_C6.json`.

- Node and Python accept/reject categories must match.
- StableKey vectors under code 3 must match.
- Registry code 4 is synthetic-only and production parser rejects.
- C6-SNAP-01 complete bytes:

```text
4036
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

## 7. Trusted Session

Use all SESS-01..12 in
`TRUSTED_SESSION_THREAT_MODEL_AND_REPLAY_TESTS_R3_C6.md`.

Critical:

- logout then reuse open connection -> reject;
- old epoch -> reject;
- copied assertion on second connection -> reject;
- shared runtime role -> reject;
- expiration checked at every command.

## 8. Policy

Use POL-01..10.

Critical:

- author self-approval -> reject;
- unauthorized approval -> reject;
- duplicate/stale sequence -> conflict;
- event UPDATE/DELETE/TRUNCATE -> reject;
- effective policy view returns one immutable approval.

## 9. Snapshot Finalization

| ID | Test | Expected |
|---|---|---|
| `C6-TX-01` | incomplete DRAFT before commit | validator reject |
| `C6-TX-02` | complete before commit | accept design |
| `C6-TX-03` | two finalizers | one CAS winner |
| `C6-TX-04` | child mutation during finalization | serialized |
| `C6-TX-05` | child mutation after finalization | reject |
| `C6-TX-06` | DELETE/move source | reject |
| `C6-TX-07` | TRUNCATE | reject |
| `C6-TX-08` | Basis mismatch | commit reject |
| `C6-TX-09` | mutation_version conflict | conflict |
| `C6-TX-10` | commit unknown | durable re-read |

## 10. PostgreSQL Privileges

Test:

- PUBLIC database/schema/table/function rights;
- runtime direct base-table access;
- sequence access;
- trigger function EXECUTE;
- owner/migrator SET ROLE;
- inherited capability;
- default privileges;
- views and security barrier;
- Event/Policy UPDATE/DELETE/TRUNCATE.

No DB test is authorized in this phase.

