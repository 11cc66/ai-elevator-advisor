# R3-C8 Finding Traceability Corrections

| Finding | Review root cause | Correction | Design location | Acceptance | Limitation |
|---|---|---|---|---|---|
| `REV-R3-C8-P1-01` | Price digest omitted business facts | Full `PRICE-FACT-V1` canonical object, content digest, sealed price row and Snapshot FK/check | Overlay Price section; Price design | Change amount/currency/basis/tax/scope/validity → reject | SQL execution not verified |
| `REV-R3-C8-P1-02` | Requirement/Catalog/Professional source identities caller-forgeable | New immutable assertion/FieldValue/CatalogReview event; ProfessionalReview result/target/basis/event bindings; full Snapshot verification | Overlay P1-02 section; provenance design | Cross-run/project IDs, forged decision/basis/time/target → reject | PostgreSQL trigger behavior unverified |
| `REV-R3-C8-P1-03` | Role checks incomplete | Recursive membership closure, attributes, options, direct ACL, per-request recheck | Overlay role section; role design | Indirect owner/CREATEROLE/direct DML/pool copy → reject | Catalog semantics require PG18 test |
| `REV-R3-C8-P1-04` | First Grant circular; no session CONNECT | Seed/initiator/approver/root bootstrap, direct CONNECT, root session and Grant | Overlay bootstrap section; bootstrap design | Empty DB → two approvals → root Grant → normal Grant | Deployment credentials and runtime not verified |
| `REV-R3-C8-P2-01` | Ledger omitted session/epoch semantics | Ledger epoch, cross-session replay rule and replay audit | Overlay Request Ledger section; idempotency design | same/new Session, old epoch, cross-principal, concurrent duplicate | Runtime concurrency unverified |
| `REV-R3-C8-P2-02` | Review current state lacks explicit guard | Named ProfessionalReview/TrustedSession TRUNCATE guards | Overlay trigger section | direct/CASCADE attempts fail or remain unverified | Trigger runtime unverified |
| `REV-R3-C8-P2-03` | C8 validator overclaims coverage | New invariant validator + 11 mutation fixtures | `tools/validate_corrections.py`; validation evidence | every mutation detects a named invariant failure | Static only |
| `REV-R3-C8-P2-04` | Source-Aux validation too late | Shared source-aux validator called at ingest and before Seal | Overlay source-aux section; source design | empty/control/129-byte input rejects before seal | PostgreSQL behavior unverified |
| `REV-R3-C8-P3-01` | Tools could overwrite arbitrary paths | New corrections generator fixed to corrections root; no arbitrary input/output | `tools/generate_complete_ddl_r3_c8_corrections.py` | outside-root output impossible | Tool process itself is static design |
| `REV-R3-C8-P3-02` | Revocation missing target check | Root/AuthorityGrant remaining issue documented; new correction requires `FOUND` and unique active scope | Overlay revocation requirement | missing target/duplicate grant fails | SQL not executed |
| `REV-R3-C8-P3-03` | Bash misrouting process finding | PowerShell-only runner rule and recorded shell evidence | `SESSION_ROLE...`/evidence shell log | command fails closed on mismatch | Runner external to repository |

All statuses are `DESIGN-ADDRESSED — PENDING INDEPENDENT REVIEW`; no independent
closure is claimed.
