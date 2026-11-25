# R3-BASIS V4 Independent Verification R3-C4

Date: 2026-11-24

Result:

```text
R3-BASIS V4: FAIL
SEMANTIC RECONSTRUCTION: PASS
DELIVERED FULL VECTOR: FAIL
DATABASE/RUNTIME: NOT ACCESSED
```

## 1. Input

The records and semantic values were taken from:

```text
R3_BASIS_V4_PROTOCOL_AND_VECTOR_SPEC.md
R3_BASIS_V4_FIXED_VECTORS.md
SNAPSHOT_REGISTRY_R1.md
```

The two encoders were implemented separately:

- Python `struct` and `hashlib`;
- Node.js `Buffer` and `crypto`.

No project encoder, database, build, test runner or Runtime was used.

## 2. Independent Construction

Record inventory:

```text
1 Header
2 Requirement Field
2 Candidate
2 Parameter
2 Price
2 Source Revision
1 Catalog Review
1 Professional Review
1 Warning
1 Missing Field
= 15
```

Canonical record lengths:

```text
155, 155, 159, 208, 213, 145, 138, 148, 148,
167, 162, 125, 184, 105, 110
```

Results:

| Implementation | Length | SHA-256 |
|---|---:|---|
| Node.js | 2350 | `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2` |
| Python | 2350 | `8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2` |

The complete Node.js and Python in-memory Basis byte streams were compared and
were byte-identical. The record count, body length, framing boundaries and
field tags were independently parsed.

## 3. Delivered Hex Verification

The line 71 complete Basis hex was decoded independently with Python and
PowerShell:

```text
Length: 2350
Declared hash: 8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2
Actual hash:   4874A5E512C53EBF4C480577C03DBB8FAE1CE7F0C582B414DC3D8DA4A0C2E262
```

Parsed record types in the delivered hex:

```text
0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9
```

Expected:

```text
0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9
```

First difference:

```text
offset 188
generated: 01 00
delivered: 00 00
```

The two Requirement Field records are therefore mis-tagged as Header records in
the checked-in full vector.

## 4. Rejection Vectors

Static review confirms the design names rejection cases:

- V24 invalid UTF-8;
- V25 oversized text;
- V26 duplicate `(recordType, stableKey)`.

No actual Basis is emitted on the intended rejection path. The complete
rejection byte fixtures are not included in the C4 fixed-vector file, so parser
behavior remains a future implementation test.

## 5. Coverage Boundary

Established:

- scalar encoding for the chosen C4-SNAP-01 values;
- Record/Field framing;
- canonical record and field sorting;
- 15-record semantic reconstruction;
- expected hash from correct semantic input.

Not established:

- correctness of the delivered hex;
- tuple-safe stable keys;
- complete Snapshot row-to-Basis mapping;
- database creation, deferred commit checks, storage or Runtime.

## 6. Required Correction

Regenerate line 71 from the corrected Registry and verify:

```text
full byte equality between independent encoders
parsed record types 0,1,1,2,3,4,5,6,7,8,9
length 2350
SHA-256 8C88E3F0EE8480AD78373375E737555B932CFF4CECB89E152A688D73E8A234E2
```

If corrections change the Registry, a new vector revision and hash are
required.

