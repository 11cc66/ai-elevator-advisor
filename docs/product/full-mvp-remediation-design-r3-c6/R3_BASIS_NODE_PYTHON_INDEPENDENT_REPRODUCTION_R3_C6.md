# R3-BASIS R6 Node/Python Independent Reproduction

Status:

```text
IN-MEMORY ONLY
DATABASE: NOT ACCESSED
```

## 1. Inputs

```text
C6_SNAPSHOT_VECTOR_01.json
```

Versions:

```text
Registry: SNAPSHOT-R3
Protocol: R3-BASIS-1-R6
StableKey: SK-R2 (registry code 3)
```

## 2. Implementations

- `tools/encode_snapshot_node.js`
- `tools/encode_snapshot_python.py`

Both independently:

- validate tuple/field registries;
- derive source keys;
- enforce scalar validation;
- sort fields/records;
- assemble R6 Basis bytes;
- compute SHA-256.

## 3. Result

```text
Records: 15
Record types: 0,1,1,2,2,3,3,4,4,5,5,6,7,8,9
Basis bytes: 4036

Node SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB

Python SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB

FULL_BYTES_EQUAL = True
FIRST_DIFF_OFFSET = NONE
```

Complete hex is mechanically rendered to `C6_SNAPSHOT_VECTOR_01_HEX.md`.

StableKey verification:

```text
STABLE_KEY_BYTE_CHECKS=17
STABLE_KEY_RESULT=PASS
```

Source boundary verification:

```text
REGISTERED_SAMPLE_MAX_BYTES=275
THEORETICAL_COMPONENT_MAX_BYTES=362
MAX_PLUS_1_BYTES=363 -> REJECT
R6_BYTES_LIMIT=512
```

## 4. Coverage

- Type 0..9 coverage;
- all C6 field tags;
- RuleSet, Candidate provenance, Parameter revision and Price validity fields;
- SourceKey/RuleSet/Source Revision references;
- Warning source ID and sequence;
- canonical field/record sorting.

## 5. Boundary

This does not verify DDL, triggers, session/Policy functions, grants,
Storage or Runtime.

