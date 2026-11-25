# R6 Scalar Validation Node/Python Audit R3-C6

Date: 2026-11-24

Review mode: independent, read-only, adversarial.

## 1. Result

```text
R6 Scalar Validation: PASS (static design)
Node/Python Accept-Reject Parity: BLOCKED (negative vectors not executed)
```

The scalar rules are sufficiently specific to review statically. The supplied
vector inventory is not an executable conformance runner, so accept/reject
parity cannot be claimed as executed evidence.

## 2. Rule Evidence

`R3_BASIS_SCALAR_VALIDATION_PROTOCOL_R3_C6.md:8-49` defines:

- explicit NULL presence and zero length;
- strict JSON Boolean without string/number coercion;
- signed INT64 only;
- canonical decimal grammar, at most 18 total digits and no trailing
  fractional zero;
- NFC TEXT with at most 4,000 Unicode scalars and no NUL;
- printable ASCII enum and canonical ID limits;
- signed INT64 UTC epoch milliseconds;
- 1..512-byte BYTES and the separate 1..362-byte SourceKey limit;
- nonempty NFC source auxiliary text of at most 128 UTF-8 bytes with C0/C1
  controls rejected;
- fail-closed `REJECT / NO BASIS / NO HASH / NO PARTIAL RECORD`.

`SCALAR_ACCEPT_REJECT_VECTORS_R3_C6.json:3-30` lists 17 scalar cases and eight
SourceKey boundary cases. The inventory includes 4,000/4,001-scalar TEXT,
NUL TEXT, canonical/noncanonical decimal, Boolean type confusion, INT64
overflow, BYTES 512/513, SourceKey 361/362/363, component max+1,
NULL/empty auxiliary and 128/129-byte multibyte auxiliary cases.

## 3. Encoder Inspection

Both implementations contain the expected checks:

| Control | Node | Python |
|---|---|---|
| Strict Boolean | `encode_snapshot_node.js` `scalar()` | `encode_snapshot_python.py` `scalar()` |
| INT64 range | `si64()` / BigInt | `i64()` range check |
| Decimal grammar and precision | `scalar()` | `scalar()` |
| NFC and 4,000-scalar TEXT | `scalar()` | `scalar()` |
| ASCII ID/key limits | `ascii()` | `ascii_bytes()` |
| Source auxiliary C0/C1 and 128 bytes | `sourceKey()` | `source_key()` |
| SourceKey total 362 bytes | `sourceKey()` | `source_key()` |
| BYTES 512 bytes | `sourceKey()` result check | `scalar()` result check |
| Exact field inventory | record loop | `record()` |
| Registry/version rejection | top-level version check | `main()` version check |

The implementations do not visibly coerce `"true"` or `1` to Boolean, use
IEEE-754 for business Decimal, trim text, or substitute NULL for invalid input.

## 4. Executed Positive Evidence

The complete C6-SNAP-01 fixture was executed through the supplied Node and
Python encoders:

```text
Records:         15
Node bytes:      4036
Python bytes:    4036
Node SHA-256:    7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
Python SHA-256:  7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
Full bytes equal: true
```

The independent third Python implementation also produced 4036 bytes, the
same digest, the expected record type sequence and 17 matching StableKey byte
vectors.

This proves agreement on the valid fixture. It does not prove both encoders
reject every listed negative scalar case.

## 5. Findings

### REV-R3-C6-P2-05

The JSON vector file declares expected outcomes but neither supplied encoder
has a batch mode that consumes the file, emits a per-case result, and fails on
an expected-outcome mismatch. A reviewer cannot distinguish a rejected vector
from an unexecuted vector.

### REV-R3-C6-P2-06

The SourceKey boundary checker constructs representative sizes and reports the
363-byte expectation, but it does not invoke both encoders for every
361/362/363, component max+1, control-character and auxiliary-boundary case.

## 6. Required Correction and Acceptance

1. Add a review-only vector runner for Node and Python that reads the exact
   JSON inventory.
2. Emit one machine-readable result per vector containing `id`, observed
   `ACCEPT`/`REJECT`, reason category and process exit status.
3. Exercise all scalar and SourceKey cases through both encoder entry points,
   not through a test-only replacement.
4. Fail the runner if any category differs or any vector is unexecuted.
5. Include max+1 SourceKey and component vectors, multibyte 128/129-byte
   auxiliary text, control characters, invalid UTF-8, unknown type/version,
   wrong Boolean type and oversized BYTES.

Acceptance requires identical positive and negative categories for every
vector, no generated Partial Basis, and no bytecode writes for Python.

## 7. Boundary

No product test, database, Storage or Runtime behavior was executed. Static
inspection plus the valid C6 fixture cannot verify database constraints,
trigger behavior or production admission.
