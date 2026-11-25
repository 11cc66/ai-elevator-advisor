# Requirement FieldValue Domain Alignment R3-C8 R2

## Shared Domain

Requirement source values, Selection fields and Snapshot fields use the same
`value_type`, `field_status`, `unit` and scalar-shape validation through
`requirement_field_domain_valid_r2`.

Allowed type:

```text
BOOLEAN
INTEGER
DECIMAL
TEXT
ENUM
CANONICAL_ID
TIMESTAMP
BYTES
```

Allowed status:

```text
CONFIRMED
PROPOSED
MISSING
NOT_APPLICABLE
CONFLICTED
```

## State and Payload

| Status | Payload |
|---|---|
| `CONFIRMED` | non-null typed payload |
| `PROPOSED` | non-null typed payload |
| `MISSING` | JSON null, no unit |
| `NOT_APPLICABLE` | JSON null, no unit |
| `CONFLICTED` | JSON null, no unit; conflict evidence is separate |

Boolean, text, enum, canonical ID, timestamp and bytes values reject a unit.
Only integer/decimal values may carry a unit matching:

```text
^[A-Z][A-Z0-9_./-]{0,31}$
```

Text is NFC, control-free and at most 65536 UTF-8 bytes. Enum is uppercase
controlled text up to 128 bytes. Canonical IDs and timestamps have fixed
grammars. Bytes are even-length lowercase hexadecimal up to 131072 bytes.

## Compatibility

The historical C6/R6 vector bytes are unchanged. No unknown old status is
silently converted to a default. Any legacy mapping remains an explicit
separate operation and is not part of this design execution.

## Enforcement

The domain trigger is installed on:

```text
requirement_field_value_r3
selection_requirement_field
sales_snapshot_requirement_field_r3
```

The Selection and Snapshot row digests continue to cover the copied payload.
PostgreSQL function/trigger execution remains unverified.

