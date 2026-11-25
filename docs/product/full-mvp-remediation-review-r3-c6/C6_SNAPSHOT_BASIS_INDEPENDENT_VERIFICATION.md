# C6-SNAP-01 Independent Basis Verification

Result:

```text
C6-SNAP-01: PASS
Node/Python Full Bytes: IDENTICAL
```

## 1. Input

```text
C6_SNAPSHOT_VECTOR_01.json
```

Versions:

```text
SNAPSHOT-R3
R3-BASIS-1-R6
SK-R2 registry code 3
```

## 2. Execution

Python was invoked as:

```text
PYTHONDONTWRITEBYTECODE=1 python -B
```

The Node implementation was invoked directly with the same semantic fixture.

Results:

```text
Node length:   4036
Python length: 4036
Node SHA-256:  7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
Python SHA-256: 7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
FULL_BYTES_EQUAL=True
HEX_MATCH=True
```

Record types:

```text
0,1,1,2,2,3,3,4,4,5,5,6,7,8,9
```

## 3. StableKey

The independent code-3 checker recomputed all 17 successful bytes:

```text
STABLE_KEY_BYTE_CHECKS=17
STABLE_KEY_RESULT=PASS
```

## 4. Coverage

The C6 vector includes the new RuleSet, Candidate, Parameter, Price, Source,
Catalog Review, Professional Review, Warning and Missing Field fields.

## 5. Boundary

This proves in-memory encoding, not database triggers, FK enforcement, Policy
lifecycle or session behavior.

