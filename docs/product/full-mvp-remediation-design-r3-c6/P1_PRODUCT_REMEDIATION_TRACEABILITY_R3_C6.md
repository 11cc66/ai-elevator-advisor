# P1 Product Remediation Traceability R3-C6

## 1. R3-C5 Findings

| R3-C5 Finding | C6 Correction | Evidence | Result |
|---|---|---|---|
| P1-01 SourceKey > Basis | R6 BYTES 512, SourceKey 362, checks/vectors | Source budget docs; C6 vector | ADDRESSED |
| P1-02 provenance omissions | SelectionResult/RuleSet/Parameter/Price exact fields/FKs | Provenance and binding docs | ADDRESSED |
| P1-03 session instance | TrustedSession/epoch/role/revocation | Session docs | ADDRESSED |
| P1-04 Policy lifecycle | PolicyRevision/Event schema/view/roles | Policy docs | ADDRESSED |
| P2-01 undefined CAS | real `mutation_version` column/query | Schema/transaction docs | ADDRESSED |
| P2-02 incomplete trigger DDL | complete trigger/validator functions | Trigger DDL proposal | ADDRESSED |
| P2-03 warning tie-break | sourceWarningId in Registry/Schema/Basis | Registry and C6 vector | ADDRESSED |
| P2-04 privilege omissions | auth/policy/session tables and exact views/roles | Three PostgreSQL docs | ADDRESSED |
| P2-05 scalar validation | R6 scalar protocol + accept/reject vectors | Scalar docs/scripts | ADDRESSED |
| P2-06 test gaps | expanded C6 test matrix | Test Plan | ADDRESSED |
| P3-01 synthetic registry | production code3, code4 synthetic only | Stable vector file | ADDRESSED |

## 2. Historical R3-C4

| Historical finding | C6 status |
|---|---|
| `REV-R3-C4-P1-01` | RESOLVED by SK-R2 |
| `REV-R3-C4-P1-02` | RESOLVED by C5 vector; C6 new vector also reproducible |
| `REV-R3-C4-P1-03` | NOW ADDRESSED by full provenance |
| `REV-R3-C4-P1-04` | NOW ADDRESSED by TrustedSession and PolicyEvent |
| `REV-R3-C4-P2-01` | RESOLVED by policy-inclusive FK |
| `REV-R3-C4-P2-02` | NOW ADDRESSED by concrete trigger functions |
| `REV-R3-C4-P2-03` | NOW ADDRESSED by full composite FKs |
| `REV-R3-C4-P2-04` | NOW ADDRESSED by complete privilege objects/views |
| `REV-R3-C4-P2-05` | RESOLVED |
| `REV-R3-C4-P2-06` | RESOLVED |
| `REV-R3-C4-P3-01` | RESOLVED |

## 3. Verification Status

```text
Source length design: CALCULATED
Node/Python C6 vector: BYTE IDENTICAL
StableKey vectors: DESIGNED
Database behavior: NOT VERIFIED
Runtime: NOT EXECUTED
```

