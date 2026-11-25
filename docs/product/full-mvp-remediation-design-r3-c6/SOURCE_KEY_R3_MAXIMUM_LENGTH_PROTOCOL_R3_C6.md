# SOURCE_KEY_R3 Maximum-Length Protocol R3-C6

## 1. Encoding

```text
"SRC3" | uint16be(3) | uint16be(4)
component[4]:
  uint16be index
  uint8 type (0 NULL, 1 ASCII, 2 UTF8)
  uint8 presence
  uint32be byte length
  payload
uint16be 0xFFFF
```

## 2. Domains

| Component | Type | Maximum |
|---|---|---:|
| sourceKind | registered ASCII enum | 64 bytes |
| sourceEntityType | registered ASCII enum | 64 bytes |
| sourceEntityId | printable ASCII ID | 64 bytes |
| sourceAuxId | explicit NULL or UTF-8 NFC printable text | 128 bytes |

ASCII IDs preserve all printable ASCII bytes, including colons, exactly.
Unicode normalization applies only to auxiliary text.

## 3. Validation Order

1. Validate source kind/entity type against the active Registry.
2. Validate ID is nonempty printable ASCII <=64 bytes.
3. Validate auxiliary null state and text.
4. Validate NFC and reject C0/C1 control characters in present auxiliary text.
5. Encode each component.
6. Encode the complete SourceKey.
7. Reject complete length >362 before BNasis assembly.
8. R6 BYTES encoder rejects >512.

No step may return a partial key.

## 4. Database Representation

```text
source_kind            text NOT NULL
source_entity_type     text NOT NULL
source_entity_id       text NOT NULL
source_aux_is_null     boolean NOT NULL
source_aux_text        text NOT NULL
source_key             bytea NOT NULL
source_key_length      integer GENERATED ALWAYS AS (octet_length(source_key)) STORED
```

Checks:

```sql
CHECK (source_aux_is_null OR source_aux_text <> '')
CHECK (octet_length(source_key) BETWEEN 1 AND 362)
```

The exact-source FK and source-key equality check both remain mandatory.

## 5. Protocol Boundary

```text
SOURCE_KEY_R3_MAX = 362
R6_BYTES_MAX = 512
R6_SOURCE_KEY_FIELD_MAX = 362
```

These are separate limits. A generic BYTES field can use up to 512; the
Requirement sourceKey field is further restricted to 362.

## 6. Versioning

`SOURCE_KEY_R3` is not changed. The limit correction belongs to the new
`R3-BASIS-1-R6` scalar budget and is recorded as such. Existing R5 Basis bytes
remain historical.

