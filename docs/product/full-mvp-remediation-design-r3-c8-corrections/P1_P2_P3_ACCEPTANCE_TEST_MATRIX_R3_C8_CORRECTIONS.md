# P1/P2/P3 Acceptance Test Matrix R3-C8 Corrections

| ID | Positive | Negative | Boundary / concurrency |
|---|---|---|---|
| `C8C-PRICE-01` | authoritative PriceRevision creates one fact digest | change amount/currency/basis/tax/scope/validity | max Decimal, NULL upper bound, revision swap |
| `C8C-REQ-01` | assertion + FieldValue creates selection source | cross Requirement/version/project, altered value/source aux | empty/max/control aux, two concurrent facts |
| `C8C-CAT-01` | exact target product/spec/price event creates review | wrong target digest, source revision, policy, decision or project | duplicate event, concurrent approval |
| `C8C-PRO-01` | sealed result creates Review and initial CREATED event | wrong result/target, forged decision/basis/time, deleted event | concurrent transition, stale sequence |
| `C8C-ROLE-01` | exact session role with direct CONNECT passes | indirect owner membership, SET/INHERIT mismatch, CREATEDB/CREATEROLE/REPLICATE/BYPASSRLS | role update during active request |
| `C8C-BOOT-01` | empty DB, seed, two approvals, root session, first Grant | one approval, duplicate completion, Runtime call, expired root token | interrupted transaction/retry |
| `C8C-LEDGER-01` | same request replay returns committed result | different payload/principal/project/epoch, revoked session | two concurrent claims |
| `C8C-TRUNC-01` | protected history remains after normal lifecycle | direct and CASCADE truncate attempts | table owner and maintenance path |
| `C8C-AUX-01` | valid source aux seals | empty/control/129-byte/path/context mismatch | concurrent insert/delete before seal |

## Validation Classes

```text
Static design checks:          recorded in evidence/VALIDATION_R3_C8_CORRECTIONS.json
Node/Python C6 encoding:       required before final acceptance
PostgreSQL SQL grammar:        NOT VERIFIED
PostgreSQL constraint/runtime: NOT VERIFIED
Runtime concurrency:           NOT VERIFIED
```
