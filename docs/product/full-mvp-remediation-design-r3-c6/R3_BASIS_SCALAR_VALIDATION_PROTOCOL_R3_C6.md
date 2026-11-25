# R3-BASIS Scalar Validation Protocol R3-C6

Status:

```text
PROTOCOL: R3-BASIS-1-R6
DESIGN ONLY
```

## 1. Scalar Rules

| Type | Rule |
|---|---|
| NULL | field present, `typeTag=0`, `presence=0`, length 0 |
| BOOLEAN | actual JSON boolean only; exactly `00`/`01` |
| INTEGER | signed 64-bit, no float/string coercion |
| DECIMAL | canonical ASCII `^-?(0|[1-9][0-9]*)(\.[0-9]{1,6})?$`; <=18 total digits; no trailing fractional zero; no exponent/NaN/Infinity |
| TEXT | UTF-8 NFC; <=4,000 Unicode scalar values; no NUL; no truncation |
| ENUM | registered printable ASCII; 1..64 bytes |
| CANONICAL_ID | printable ASCII; 1..64 bytes; colon preserved; no case folding |
| TIMESTAMP | signed int64 UTC epoch milliseconds |
| BYTES | 1..512 bytes for R6; SourceKey field further restricted to 1..362 |
| LIST | reserved; not used by SNAPSHOT-R3 |

## 2. Source Auxiliary Text

- explicit NULL is distinct from empty;
- present text is UTF-8 NFC, 1..128 bytes;
- C0/C1 control characters are rejected;
- no silent normalization into another historical ID.

## 3. Failure Contract

On invalid input:

```text
REJECT
NO BASIS
NO HASH
NO PARTIAL RECORD
```

Unknown scalar/type/version also rejects.

## 4. Node/Python Agreement

Both implementations must return the same accept/reject category. Error text
need not be identical.

The implementations must not:

- coerce `"true"`/1 into Boolean;
- use IEEE-754 Number for business Decimal;
- silently trim text;
- truncate long fields;
- substitute NULL for invalid data;
- encode after a failed source-key check.

