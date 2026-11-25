# SOURCE_KEY_R3 Independent Audit

Date: 2026-11-24

Result:

```text
SOURCE_KEY_R3: FAIL
STRUCTURED SOURCE BINDING: PASS
ENCODED MAXIMUM CONSISTENCY: FAIL
```

## 1. Structured Identity

The authority is correctly separated:

```text
sourceKind
sourceEntityType
sourceEntityId
sourceAuxIsNull
sourceAuxText
```

ASCII IDs are preserved exactly. Unicode is allowed only in auxiliary text and
normalized to NFC. The colon is not parsed.

## 2. Context-Free Tests

| Entity ID | Aux | Bytes | Result |
|---|---|---:|---|
| `a:b` | `c` | 87 | distinct |
| `a` | `b:c` | 87 | distinct |
| `a:b:c` | NULL | 88 | distinct |
| `a` | NFC `café` | 89 | equal to NFD form |
| `a` | NFD `cafe\u0301` | 89 | normalized equal |
| `a` | `电:梯` | 91 | multibyte length preserved |

The three colon-boundary cases are pairwise distinct.

## 3. Maximum Size Calculation

Per specification:

```text
sourceKind          64 bytes
sourceEntityType    64 bytes
sourceEntityId      64 bytes
sourceAuxId        128 bytes

fixed header:        8 bytes
four component
headers:            32 bytes
payload maximum:    320 bytes
end marker:          2 bytes

total maximum:      362 bytes
```

A realistic maximum with `USER_ASSERTION` /
`REQUIREMENT_FIELD_ASSERTION`, 64-byte ID and 128-byte auxiliary text is 275
bytes.

The R3-BASIS-1-R5 BYTES scalar limit is 256 bytes. Therefore a source tuple
valid under SOURCE_KEY_R3 can be unrepresentable in the Snapshot Basis.

Neither supplied encoder enforces 256 bytes.

## 4. Printable Text

The source auxiliary domain says “printable UTF-8 NFC”. The SQL CHECK only
checks null/nonempty, and the Node/Python source-key implementations normalize
and length-check but do not reject control characters. This is a P2 boundary
gap.

## 5. Typed Ownership

The design correctly requires:

- typed source FKs;
- exact RequirementVersion ownership;
- exact ProfessionalReviewEvent six-column relation;
- immutable evidence/source revision;
- Snapshot mutation detection;
- quarantine for ambiguous legacy source data.

`sourceKey` does not replace FK ownership.

## 6. Required Correction

Choose one consistent byte limit:

```text
max(SOURCE_KEY_R3 encoding) <= R5 BYTES limit
```

or reduce component limits. Enforce it in:

- canonical source function;
- SQL CHECK;
- Node encoder;
- Python encoder;
- independent verifier;
- max and max+1 fixed vectors.

Also reject control characters from present auxiliary text.

## 7. Conclusion

The source identity algorithm is collision-safe for the tested tuples. The
declared valid domain cannot be fully encoded under the Basis limit, so the
overall SOURCE_KEY_R3 design is not yet closed.

