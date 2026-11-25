# SNAPSHOT StableKey Tuple Encoding R3-C6

Status:

```text
ALGORITHM: SK-R2
REGISTRY CODE: 3
```

## 1. Preserved Algorithm

```text
"SKR2"
encoding_version uint16be = 2
registry_version uint16be = 3
record_type uint16be
component_count uint16be
components:
  index uint16be
  type uint8
  presence uint8
  length uint32be
  UTF-8 bytes
end_marker uint16be = 0xFFFF
```

Types remain:

```text
1 ASCII_ID
2 ASCII_KEY
3 INT64
0 NULL (framing-only; rejected by production tuple validation)
```

## 2. Record Tuples

Same tuple semantics as C5 stable keys:

| Type | Tuple |
|---:|---|
| 0 | snapshotId |
| 1 | requirementVersionId, fieldKey |
| 2 | candidateId |
| 3 | candidateId, parameterKey |
| 4 | candidateId, priceRevisionId |
| 5 | sourceRevisionId |
| 6 | catalogReviewId |
| 7 | professionalReviewId,eventSequence |
| 8 | candidateId,warningSequence |
| 9 | candidateId,fieldKey |

## 3. Registry Version Boundary

Production parser allowlist:

```text
SNAPSHOT-R3 -> registry code 3
```

Historical decoders may read code 2 only under SNAPSHOT-R2. Registry code 4 in
the test file is a synthetic framing inequality vector and is rejected as
production input.

## 4. Size and Equality

- maximum component: 64 UTF-8 bytes for IDs/keys;
- INT64: exactly 8 payload bytes;
- maximum complete key: 158 bytes;
- uniqueness is full bytes + structured DB key, never a digest alone.

## 5. Vectors

`STABLE_KEY_TEST_VECTORS_R3_C6.json` contains:

- colon/multi-component collisions;
- empty vs NULL;
- missing component;
- NFC/NFD/multibyte rejection for ASCII ID domain;
- type confusion/leading zero;
- record/registry domain separation;
- prefix and 64/65-byte boundaries;
- historical colon ID.

All successful expected strings use registry byte `00 03`.

