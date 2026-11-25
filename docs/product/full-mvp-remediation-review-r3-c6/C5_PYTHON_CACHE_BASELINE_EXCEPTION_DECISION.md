# C5 Python Cache Baseline Exception Decision R3-C6

Date: 2026-11-24

## 1. Decision

```text
ACCEPT AS NON-SEMANTIC GENERATED CACHE EXCEPTION
```

Scope is limited to the single Python 3.15 bytecode cache named below. It does
not rewrite the C5 baseline or authorize any source/report/vector change.

## 2. Historical and Current Evidence

Affected path:

```text
docs/product/full-mvp-remediation-review-r3-c5/tools/__pycache__/independent_c5_verifier.cpython-315.pyc
```

Historical manifest record:

```text
SHA-256: 58A7FCA4E3E361DBEC0231EB88D3B330E9B1F8D460BC8E19D2138FA7738E4CA0
Bytes:   17599
Lines:   205
```

Current observed cache:

```text
SHA-256: C070038FBA750718C54DB2AE990F9940FAFD1E5965F1702E4A8877931EBB7E73
Bytes:   17641
Lines:   207
LastWriteTimeUtc: 2026-11-23T19:13:35Z
```

The authoritative source remains:

```text
docs/product/full-mvp-remediation-review-r3-c5/tools/independent_c5_verifier.py
SHA-256: 92383447283C3C18C27AFDB402FB45CD3398679CD2E58DDAA920E12F4A45A19D
Bytes:   11864
Lines:   307
```

That source hash and size match the historical C5 Review manifest.

## 3. Cache Header Check

The current `.pyc` is a timestamp-based Python 3.15 cache:

```text
Magic:              520E0D0A
Flags:              0
Pyc source mtime:   1795456389
Source mtime:       1795456389
Pyc source size:    11864
Current source size:11864
Header match:       true
```

This is consistent with the current cache having been regenerated from the
unchanged source by the same Python 3.15 interpreter family.

## 4. Manifest Isolation

Read-only recomputation found:

| Manifest | Manifest SHA-256 | Records | Mismatches |
|---|---|---:|---:|
| R3-C5 design | `40B53E7C639F9D48AB83231593B85FBCD00314B8E979220E7F9BA4A2E0799424` | 25 | 0 |
| R3-C5 review | `275A53455A8AD5A03FAC6E52271A54421442A78912A35147CB6013B02E57D0CC` | 14 | 1 (`.pyc` only) |
| R3-C4 design | `347EB6515BB910C4C1AE22319655BC078D7130CCBC832E2D55420827B9DD778B` | 16 | 0 |
| R3-C4 review | `BB96FF7A3A60B7C2AFFF0EC7DF89FC8D32DFE6C49D17ECD74B1F53EB5445FB6B` | 9 | 0 |

No C5/C4 source, report, design or semantic vector record has an unexplained
mismatch.

## 5. Why Acceptance Is Appropriate

The exception satisfies the narrow acceptance conditions:

- the historical C5 review manifest recorded the cache;
- only that derived cache mismatches its historical record;
- the source is unchanged;
- the cache header points to the unchanged source size and timestamp;
- no reviewed claim or vector depends on the cache as authoritative input;
- all semantic C5 artifacts remain hash-identical;
- this review used `PYTHONDONTWRITEBYTECODE=1` and `python -B`;
- the historical verifier module was neither imported nor executed in this
  review.

The cache cannot independently establish a business or security conclusion.
Its semantic authority is the source, reviewed design text and fixed vectors.

## 6. Explicit Limits

This decision:

- does not alter the C5 manifest;
- does not replace the historical hash with the current hash;
- does not authorize deleting or restoring the current cache;
- does not make `__pycache__` an authoritative artifact class;
- does not waive any other baseline mismatch;
- does not authorize execution of the historical verifier.

Future authoritative manifests should exclude `__pycache__`. If a bytecode
snapshot must be retained, it should be labeled non-authoritative and include
the exact interpreter build and regeneration command.
