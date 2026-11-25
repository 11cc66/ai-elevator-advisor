# R3-BASIS-1 Revision 4 Independent Reproduction

Status:

```text
IN-MEMORY VERIFICATION ONLY
NO DATABASE/RUNTIME ACCESS
```

## 1. Implementations

Implementation A: Node.js `Buffer`/`crypto`.

Implementation B: Python standard-library `struct`/`hashlib`.

Both were written from `R3_BASIS_V4_PROTOCOL_AND_VECTOR_SPEC.md`, with
`SNAPSHOT_REGISTRY_R1.md` used for the real Snapshot records. They share no
encoder code or generated output.

## 2. Generic Framing Vectors

The C3 V01–V23 generic framing vectors are inherited as a framing regression
suite. Their expected bytes/hashes are recorded in the R3-C3 fixed vector file.
They are not used as proof of the full Snapshot.

```text
GENERIC_FRAMING_VECTORS = C3 V01-V23
GENERIC_FRAMING_RESULT = BYTE IDENTICAL
```

## 3. Real Snapshot Vector

`C4-SNAP-01` contains:

```text
registry = SNAPSHOT-R1
protocol = R3-BASIS-1-R4
records = 15
record types = 0 through 9
basis byte length = 2350
```

Independent results:

| Implementation | Basis length | SHA-256 |
|---|---:|---|
| Node.js | 2350 | `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2` |
| Python | 2350 | `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2` |

```text
NODE_VS_PYTHON = BYTE IDENTICAL
FULL_SNAPSHOT_VECTOR = PASS
```

The complete Basis hex and record inventory are in
`R3_BASIS_V4_FIXED_VECTORS.md`.

## 4. Rejection Vectors

V24 invalid UTF-8, V25 oversized text and V26 duplicate stableKey are rejected
before hashing by both implementations. Their rejection paths do not emit a
Basis or SHA-256.

## 5. Coverage Boundary

This verifies:

- generic scalar/frame rules;
- actual Registry R1 record types 0–9;
- multi-field and multi-record sorting;
- source/candidate/parameter/price/review/warning/missing relationships;
- full Snapshot Basis bytes;
- Node/Python byte equality.

This does not verify a real database, Snapshot insert, deferred trigger,
archive availability or Runtime behavior.
