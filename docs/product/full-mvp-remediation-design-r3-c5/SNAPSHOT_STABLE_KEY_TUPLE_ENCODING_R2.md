# SNAPSHOT StableKey Tuple Encoding R2

Status:

```text
ENCODING VERSION: SK-R2
REGISTRY VERSION: SNAPSHOT-R2
DESIGN ONLY
NOT IMPLEMENTED
```

## 1. Decision

`SNAPSHOT-R1` used delimiter-concatenated text stable keys. That encoding is
ambiguous for IDs containing `:` and is retained only as immutable history.

R3-C5 introduces `SK-R2`, a binary length-prefixed tuple encoding. The full
encoding bytes are the comparison and uniqueness value. No digest is used as
the identity.

Database relationship completeness continues to use structured columns and
composite UNIQUE/FK constraints. `stable_key` is a derived canonical row
identity used by the Basis and as a secondary unique guard.

## 2. Byte Layout

All integer fields are unsigned big-endian unless explicitly stated.

```text
magic                 4 bytes   ASCII "SKR2"
encoding_version      uint16be  2
registry_version      uint16be  2 (SNAPSHOT-R2)
record_type           uint16be  0..9
component_count       uint16be

repeated component_count times:
  component_index     uint16be  1-based tuple position
  component_type      uint8     0=NULL, 1=ASCII_ID, 2=ASCII_KEY, 3=INT64
  presence            uint8     0=NULL, 1=present
  component_length    uint32be  UTF-8 byte length
  component_bytes     bytes

end_marker            uint16be  0xFFFF
```

`component_length` counts bytes, never code points.

## 3. Component Domains

| Type | Tag | Domain | Normalization |
|---|---:|---|---|
| NULL | 0 | no payload; `presence=0`, length 0 | none |
| ASCII_ID | 1 | 1..64 printable ASCII bytes; `:` and multiple `:` allowed | none; preserve exact bytes |
| ASCII_KEY | 2 | 1..64 printable ASCII bytes from the versioned field/parameter catalogue | none |
| INT64 | 3 | signed 64-bit two's-complement integer, exactly 8 payload bytes | numeric only |

The registered SNAPSHOT-R2 tuples do not permit NULL or empty required
components. The codec can represent NULL and empty distinctly, but Registry
validation rejects both where the tuple definition says required/nonempty.

An omitted component is not encoded at all and is rejected before output.
Explicit NULL is encoded with `type=0,presence=0,length=0`. Empty text is
encoded with `type=1/2,presence=1,length=0`. They are therefore different byte
strings before Registry validation.

ASCII IDs are not NFC-normalized or case-folded. Turkish-I, Unicode, NFD and
NFC forms are not silently converted. Non-ASCII stable-key IDs are rejected.
Unicode auxiliary source text is handled separately by `SOURCE_KEY_R3`.

## 4. Registered Tuples

| Type | Entity | Components | Structured DB UNIQUE |
|---:|---|---|---|
| 0 | Header | `snapshotId:ASCII_ID` | `(snapshot_id)` |
| 1 | Requirement Field | `requirementVersionId:ASCII_ID, fieldKey:ASCII_KEY` | `(snapshot_id,requirement_version_id,field_key)` |
| 2 | Candidate | `candidateId:ASCII_ID` | `(snapshot_id,candidate_id)` |
| 3 | Parameter | `candidateId:ASCII_ID, parameterKey:ASCII_KEY` | `(snapshot_id,candidate_row_id,parameter_key)` |
| 4 | Price | `candidateId:ASCII_ID, priceRevisionId:ASCII_ID` | `(snapshot_id,candidate_row_id,price_revision_id)` |
| 5 | Source Revision | `sourceRevisionId:ASCII_ID` | `(snapshot_id,source_revision_id)` |
| 6 | Catalog Review | `catalogReviewId:ASCII_ID` | `(snapshot_id,catalog_review_id)` |
| 7 | Professional Review | `professionalReviewId:ASCII_ID, eventSequence:INT64` | `(snapshot_id,professional_review_id,event_sequence)` |
| 8 | Warning | `candidateId:ASCII_ID, warningSequence:INT64` | `(snapshot_id,candidate_row_id,warning_sequence)` |
| 9 | Missing Field | `candidateId:ASCII_ID, fieldKey:ASCII_KEY` | `(snapshot_id,candidate_row_id,field_key)` |

Each canonical table also stores:

```text
stable_key bytea NOT NULL
UNIQUE (snapshot_id, stable_key)
```

The structured UNIQUE is authoritative for business uniqueness. The bytea
UNIQUE prevents two different tuples from accidentally serializing identically.
Both must agree.

## 5. Length and Overflow Rules

The largest registered tuple has two 64-byte components:

```text
12-byte fixed prefix
+ 2 * (8-byte component header + 64 bytes)
+ 2-byte end marker
= 158 bytes maximum
```

The Registry rejects:

- component count mismatch;
- component index/order mismatch;
- component type mismatch;
- component length above 64;
- stable key above 158 bytes;
- `uint32` length overflow;
- invalid UTF-8;
- NUL or control bytes in ASCII components;
- unknown component type;
- unknown record type;
- absent end marker or trailing bytes.

## 6. Collision Adversary

The original R1 collision:

```text
A: candidateId="a:b", priceRevisionId="c"
B: candidateId="a",   priceRevisionId="b:c"
```

encodes as:

```text
A:
534B523200020002000400020001010100000003613A62000201010000000163FFFF

B:
534B523200020002000400020001010100000001610002010100000003623A63FFFF
```

They are different complete values. Additional vectors:

```text
PRICE(a,b):
534B52320002000200040002000101010000000161000201010000000162FFFF

PARAM(a,b):
534B52320002000200030002000101010000000161000202010000000162FFFF

WARN(candidate-1,1):
534B52320002000200080002000101010000000B63616E6469646174652D3100020301000000080000000000000001FFFF

PRICE("ab","c"):
534B5232000200020004000200010101000000026162000201010000000163FFFF

PRICE("a","bc"):
534B5232000200020004000200010101000000016100020101000000026263FFFF

PRICE("a:b","c") vs PRICE("abc","def"):
534B523200020002000400020001010100000003613A62000201010000000163FFFF
534B5232000200020004000200010101000000036162630002010100000003646566FFFF
```

## 7. Adversarial Matrix

| Case | Expected |
|---|---|
| Colon-containing IDs | Encode exact ASCII bytes; A/B examples differ |
| Colon in both values | No parsing; IDs remain opaque components |
| Empty component | Codec distinguishes it by length 0, Registry rejects required empty |
| Explicit NULL | `type=0,presence=0`; Registry rejects required NULL |
| Missing component | Reject before encoding |
| NFC vs NFD Unicode ID | Reject as non-ASCII |
| Chinese/Japanese ID | Reject as non-ASCII |
| Multi-segment tuple | Component count and indexes preserve boundaries |
| INTEGER 1 vs string "1" | Different type tags and payload lengths |
| INTEGER 1 vs INTEGER textual "01" | Only numeric INT64 accepted; text is rejected |
| Different Record Type | `record_type` domain byte differs |
| Different Registry Version | `registry_version` byte differs |
| Prefix strings | Length prevents prefix ambiguity |
| 64 bytes | Accepted |
| 65 bytes | Reject |
| Lone surrogate / invalid Unicode | Reject as non-ASCII |
| Historical Text ID with colon | Accepted; preserved exactly |

## 8. Hash and Database Distinction

The complete `stable_key` bytes are stored and compared. A SHA-256 of the key
is optional for diagnostics only and cannot satisfy `UNIQUE`.

The database stores structured component columns alongside the encoded key.
The controlled builder recomputes the key from those columns and rejects a
mismatch. A same-tuple race loses on the structured UNIQUE constraint.

## 9. Versioning and Migration

```text
StableKey Encoding: SK-R1 (historical implicit colon format)
StableKey Encoding: SK-R2 (this document)
Registry: SNAPSHOT-R1 (historical, immutable)
Registry: SNAPSHOT-R2 (this design)
```

R1 records are not silently rewritten. No R1 implementation/data has been
authorized by this project state. If an R1 snapshot is ever found:

1. preserve its R1 record and Basis read-only;
2. verify the R1 tuple by structured columns;
3. create a new R2 snapshot version and new Basis;
4. retain both registry/protocol versions in the historical envelope;
5. quarantine any R1 row whose structured tuple cannot be recovered.

R1 and R2 rows may coexist only as distinct snapshot versions. A row carrying
`SNAPSHOT-R2` must use `SK-R2` and `R3-BASIS-1-R5`; a R1 row must retain its
original registry/protocol identity.

## 10. Fixed-Vector Verification

The machine-readable adversarial vectors are in:

```text
STABLE_KEY_TEST_VECTORS_R2.json
```

The independent static checker recomputed every supplied expected byte string:

```text
python tools/verify_stable_key_vectors.py STABLE_KEY_TEST_VECTORS_R2.json

STABLE_KEY_FIXED_BYTE_CHECKS=17
STABLE_KEY_FIXED_BYTE_RESULT=PASS
```

Rejected domain cases intentionally have no encoded output.

