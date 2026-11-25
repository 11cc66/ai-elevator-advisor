# R3-C7 Version Compatibility Matrix

Artifact: `R3_C7_VERSION_COMPATIBILITY_MATRIX.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Preserved Protocol Versions

| Dimension | Value | R3-C7 change |
|---|---|---|
| Registry | `SNAPSHOT-R3` | none |
| Basis protocol | `R3-BASIS-1-R6` | none |
| StableKey | `SK-R2`, registry code 3 | none |
| SourceKey | `SOURCE_KEY_R3` | none |
| SourceKey maximum | 362 bytes | none |
| BYTES maximum | 512 bytes | none |

## 2. Historical Vector

```text
C6-SNAP-01 records: 15
bytes: 4036
SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

The exact C6 vector file was not modified. It was executed through the new
Node and Python R3-C7 encoders and produced identical length/hash.

Retained outputs:

```text
evidence/c6-compatibility-node-r3-c7.json
evidence/c6-compatibility-python-r3-c7.json
evidence/c6-compatibility-parity-r3-c7.json
```

## 3. Why No Version Bump

R3-C7 adds:

- database constraints and provenance;
- function implementations;
- Session/Policy security;
- resource upper bounds above all existing vectors.

It does not change:

- record type/tag inventory;
- scalar tags;
- StableKey framing;
- SourceKey framing;
- Basis header;
- record ordering;
- existing field meanings.

The bounds are semantic admission limits, not a wire-format change. A Basis
under the existing valid format but over the new resource cap is rejected by
R3-C7 policy; no historical C6 vector crosses that cap.

Approval of the bound is `OD-R3-C7-03`; until approved, implementation cannot
declare the cap final.

## 4. Registry Code 4

Registry code 4 remains a synthetic framing-only inequality vector. Production
parsers accept code 3 only.

## 5. Old Snapshot Compatibility

Future design review must confirm:

- all historical Snapshot sizes;
- all historical record/field counts;
- all old Registry readers;
- whether any old Snapshot exceeds the new caps.

No historical data was scanned because database and Storage access is
unauthorized. If any exceeds the cap, a compatibility or exception decision is
required before migration.

## 6. Version Gate

No Migration or reader/writer deployment is authorized until:

- independent R3-C7 review;
- approval of `OD-R3-C7-02` and `OD-R3-C7-03`;
- isolated Database tests;
- explicit Migration authorization.
