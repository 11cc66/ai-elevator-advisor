# P1 Product Remediation Traceability R3-C7

Artifact: `P1_PRODUCT_REMEDIATION_TRACEABILITY_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Cross-Stage Finding Matrix

| Original Finding | Severity | R3-C4 | R3-C5 | R3-C6 | R3-C7 correction | Evidence | Final design state |
|---|---|---|---|---|---|---|---|
| `REV-R3-C4-P1-01` | P1 | OPEN | RESOLVED | RESOLVED | Preserve SK-R2 code-3 tuple | C6 vector re-executed unchanged | PRESERVED |
| `REV-R3-C4-P1-02` | P1 | OPEN | RESOLVED | RESOLVED | Preserve 4036-byte C6 vector | Complete DDL projection maps all record tags | PRESERVED |
| `REV-R3-C4-P1-03` | P1 | OPEN | OPEN | OPEN | Complete Snapshot Registry/Schema/Basis mapping | `CANDIDATE_PARAMETER_PRICE_RULESET_BINDING_R3_C7.md` | DESIGN-ADDRESSED |
| `REV-R3-C4-P1-04` | P1 | OPEN | OPEN | OPEN | Actor/authority derived from locked TrustedSession; closed command matrix | policy/professional DDL and lock protocol | DESIGN-ADDRESSED |
| `REV-R3-C4-P2-01` | P2 | OPEN | RESOLVED | RESOLVED | Preserve policy-inclusive Review composite FK | complete DDL | PRESERVED |
| `REV-R3-C4-P2-02` | P2 | OPEN | OPEN | OPEN | Exact constraint-trigger matrix and bodies | complete DDL trigger section | DESIGN-ADDRESSED |
| `REV-R3-C4-P2-03` | P2 | OPEN | OPEN | OPEN | Exact same-Snapshot composite FKs | complete DDL and provenance FKs | DESIGN-ADDRESSED |
| `REV-R3-C4-P2-04` | P2 | OPEN | OPEN | OPEN | Complete role/object/default-privilege baseline | `POSTGRESQL_OWNER_ROLE_PRIVILEGE_BASELINE_R3_C7.md` | DESIGN-ADDRESSED |
| `REV-R3-C4-P2-05` | P2 | OPEN | RESOLVED | RESOLVED | Preserve deterministic field sorting | C6/G7 encoder parity | PRESERVED |
| `REV-R3-C4-P2-06` | P2 | OPEN | RESOLVED | RESOLVED | Preserve ASCII IDs and UTF-8 auxiliary separation | SourceKey vectors 19/19 | PRESERVED |
| `REV-R3-C4-P3-01` | P3 | OPEN | RESOLVED | RESOLVED | Correct record-type wording | traceability text | PRESERVED |
| `REV-R3-C5-P1-01` | P1 | N/A | OPEN | RESOLVED | 362 SourceKey inside 512 BYTES | 23+19+14 executed vectors | PRESERVED |
| `REV-R3-C5-P1-02` | P1 | N/A | OPEN | OPEN | Full business provenance FK graph | exact composite FK DDL | DESIGN-ADDRESSED |
| `REV-R3-C5-P1-03` | P1 | N/A | OPEN | OPEN | Locks and linearization protocol | TrustedSession lock/CAS files | DESIGN-ADDRESSED |
| `REV-R3-C5-P1-04` | P1 | N/A | OPEN | OPEN | Immutable policy/event lifecycle | Policy DDL files | DESIGN-ADDRESSED |
| `REV-R3-C5-P2-01` | P2 | N/A | OPEN | RESOLVED | `mutation_version` CAS retained | Snapshot DDL/finalizer | PRESERVED |
| `REV-R3-C5-P2-02` | P2 | N/A | OPEN | OPEN | Complete deferred triggers/functions | complete DDL and deferred audit | DESIGN-ADDRESSED |
| `REV-R3-C5-P2-03` | P2 | N/A | OPEN | RESOLVED | Warning ID/sequence in Registry/Schema/Basis | snapshot warning table/projection | PRESERVED |
| `REV-R3-C5-P2-04` | P2 | N/A | OPEN | OPEN | Exact privilege matrix for all auth/policy objects | role/privilege baseline | DESIGN-ADDRESSED |
| `REV-R3-C5-P2-05` | P2 | N/A | OPEN | RESOLVED | Complete scalar rules and negative runner | 23 executed vectors | PRESERVED + EXECUTED |
| `REV-R3-C5-P2-06` | P2 | N/A | OPEN | RESOLVED | Complete test-plan breadth | C7 test plan | PRESERVED |
| `REV-R3-C5-P3-01` | P3 | N/A | OPEN | RESOLVED | Synthetic Registry 4 labeled non-production | encoder/vector protocol | PRESERVED |
| `REV-R3-C6-P1-01` | P1 | N/A | N/A | OPEN | Exact full provenance FKs | `SELECTION_RESULT_COMPOSITE_FK_DDL_R3_C7.md` | DESIGN-ADDRESSED |
| `REV-R3-C6-P1-02` | P1 | N/A | N/A | OPEN | 43 complete functions and static call graph | inventory/call graph/validator | DESIGN-ADDRESSED |
| `REV-R3-C6-P1-03` | P1 | N/A | N/A | OPEN | Revoke/Transition linearization | lock-order and adversarial tests | DESIGN-ADDRESSED |
| `REV-R3-C6-P1-04` | P1 | N/A | N/A | OPEN | Trusted digest and append-only lifecycle | Policy DDL files | DESIGN-ADDRESSED |
| `REV-R3-C6-P2-01` | P2 | N/A | N/A | OPEN | Complete protected View DDL | View DDL and privilege files | DESIGN-ADDRESSED |
| `REV-R3-C6-P2-02` | P2 | N/A | N/A | OPEN | Exact signature Registry | static validator PASS | DESIGN-ADDRESSED |
| `REV-R3-C6-P2-03` | P2 | N/A | N/A | OPEN | Replay lookup before sequence | policy/professional function bodies | DESIGN-ADDRESSED |
| `REV-R3-C6-P2-04` | P2 | N/A | N/A | OPEN | Global Basis resource budget | 14/14 executed limit vectors | DESIGN-ADDRESSED |
| `REV-R3-C6-P2-05` | P2 | N/A | N/A | OPEN | Real scalar runners | Node/Python 23/23 PASS | DESIGN-ADDRESSED |
| `REV-R3-C6-P2-06` | P2 | N/A | N/A | OPEN | Real SourceKey runners | Node/Python 19/19 PASS | DESIGN-ADDRESSED |

## 2. Required Provenance Counterexamples

| Case | Enforced relation | Expected |
|---|---|---|
| `PROV-01` | Product revision `(product_id,id,digest)` | reject |
| `PROV-02` | Specification `(product_id,product_revision_id,id,digest)` | reject |
| `PROV-03` | Price child and PriceRevision exact key | reject |
| `PROV-04` | Candidate result exact candidate/run/context key | reject |
| `PROV-05` | SalesCase/SelectionRun exact RequirementVersion key | reject |
| `PROV-06` | CatalogParameterRevision product revision key | reject |
| `PROV-07` | CandidateParameter exact candidate key | reject |
| `PROV-08` | Snapshot references `selection_run_seal`, not RUNNING run | reject |
| `PROV-09` | Run/Snapshot/candidate RuleSet ID+digest | reject |
| `PROV-10` | Sealed-selection immutability trigger | reject |
| `PROV-11` | Project tuple through Case/Run/Result/Header | reject |
| `PROV-12` | Requirement tuple through Case/Run/Result/Header | reject |

## 3. Status Meaning

`DESIGN-ADDRESSED` means a concrete design artifact exists. It does not mean an
independent reviewer approved it or that PostgreSQL enforced it in a live
database. All database behavior remains `NOT VERIFIED`.
