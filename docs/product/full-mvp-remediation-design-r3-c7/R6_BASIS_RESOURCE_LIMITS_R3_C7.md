# R6 Basis Resource Limits R3-C7

Artifact: `R6_BASIS_RESOURCE_LIMITS_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Limits

| Resource | Maximum | Reject at |
|---|---:|---:|
| Records per Basis | 4,096 | 4,097 |
| Fields per record | 32 | 33 |
| Fields per Snapshot | 65,536 | 65,537 |
| StableKey bytes | 158 | 159 |
| SourceKey bytes | 362 | component/complete overflow |
| Single BYTES payload | 512 | 513 |
| Field encoded bytes | 520 | 521 |
| Record encoded bytes | 16,874 | 16,875 |
| Basis body bytes | 16,777,216 | 16,777,217 |
| Complete Basis bytes | 16,777,244 | 16,777,245 |

These are independent caps. The complete-base cap still applies even when the
theoretical product of record count and record maximum would be larger.

## 2. Where Enforced

Node and Python:

```text
tools/r6_encoder_r3_c7.js
tools/r6_encoder_r3_c7.py
```

Database:

- `app_private.r6_record` rejects field count/record bytes;
- `snapshot_basis_metadata_r3` has CHECK limits;
- `build_snapshot_basis_r6` rejects count/body/total;
- `refresh_snapshot_basis_records_r3` rejects total record count;
- `runtime_worker` has no direct inserts into metadata/records.

## 3. Fail Contract

Any exceeded limit:

```text
REJECT
NO PARTIAL RECORD
NO PARTIAL BASIS
NO HASH
NO FINALIZED SNAPSHOT
```

No encoder truncates, omits a record, substitutes NULL or changes protocol
version silently.

## 4. Executed Evidence

Command:

```text
node tools/run_basis_limits_parity_check.js
```

Result:

```text
14 vectors
Node failed: 0
Python failed: 0
Parity mismatches: 0
PASS
```

Per-case evidence is in `R6_BASIS_LIMIT_ACCEPT_REJECT_VECTORS_R3_C7.md`.

## 5. Boundary

The limit vectors call exported resource-budget functions from the actual
R3-C7 encoder modules. They do not execute PostgreSQL.
