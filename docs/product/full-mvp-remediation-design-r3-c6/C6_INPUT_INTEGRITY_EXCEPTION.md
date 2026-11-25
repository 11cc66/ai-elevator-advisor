# R3-C6 Input Integrity Exception

Date: 2026-11-24

## 1. Result

The R3-C5 design, R3-C5 review manifest, R3-C4 design manifest and R3-C4
review manifest self-hashes match their expected values.

One recorded file does not match:

```text
File:
docs/product/full-mvp-remediation-review-r3-c5/tools/__pycache__/independent_c5_verifier.cpython-315.pyc

Manifest:
58A7FCA4E3E361DBEC0231EB88D3B330E9B1F8D460BC8E19D2138FA7738E4CA0
17599 bytes / 205 lines

Current:
C070038FBA750718C54DB2AE990F9940FAFD1E5965F1702E4A8877931EBB7E73
17641 bytes / 207 lines
```

## 2. Cause

The C6 design process imported the historical
`independent_c5_verifier.py` module for a read-only comparison. Python
regenerated its ignored `__pycache__` bytecode from the unchanged source file.

The authoritative source remains:

```text
92383447283C3C18C27AFDB402FB45CD3398679CD2E58DDAA920E12F4A45A19D
11864 bytes / 307 lines
```

which matches the C5 review manifest.

## 3. Impact

- No C5 source/report/script/semantic fixture was edited.
- No C6 design conclusion depends on the historical `.pyc`.
- The current and historical `.pyc` are interpreter-generated caches, not
  readable authoritative evidence.
- The C5 review manifest must not be rewritten.
- The original `.pyc` bytes were not recovered or deleted.

## 4. Required Disposition

Before treating the C5 review tree as an untouched forensic baseline, the user
must either:

1. accept the generated `.pyc` drift as a non-semantic cache exception; or
2. authorize preserving the current cache and recording a new baseline; or
3. provide/reselect an approved recovery source for the original bytes.

No recovery or deletion was performed in this phase.

