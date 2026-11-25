# R6 Basis Maximum Size Calculation R3-C7

Artifact: `R6_BASIS_MAXIMUM_SIZE_CALCULATION_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Field

```text
tag                 2
scalar type tag     1
presence            1
payload length      4
maximum payload   512
----------------------
field maximum     520 bytes
```

## 2. Record

```text
record length prefix          4
record type                   2
row-id length                 2
row-id maximum               64
stable-key length             2
StableKey maximum           158
field count                   2
32 fields * 520           16,640
--------------------------------
record maximum            16,874 bytes
```

## 3. Basis

Header:

```text
magic "R3BASIS\0"             8
protocol version              2
registry version              2
header length                 4
record count                  4
body length                   8
--------------------------------
header                       28 bytes
```

Body resource cap:

```text
16,777,216 bytes (16 MiB)
```

Complete cap:

```text
16,777,216 + 28 = 16,777,244 bytes
```

The independent record-count and field-count caps remain in force. A Basis may
not reach the body cap through unbounded millions of tiny records.

## 4. Existing Protocol Values Preserved

```text
C6-SNAP-01 length: 4,036
C6-SNAP-01 SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

The new limits exceed this historical vector by a wide margin and do not require
a Registry or Basis version change.

## 5. Integer Safety

- field payload length is u32 and capped at 512;
- record length is u32 and capped at 16,874;
- record count is u32 and capped at 4,096;
- body length is u64 and capped at 16 MiB;
- all Database columns use integer/bigint with matching CHECK ranges.

No boundary depends on JavaScript `Number` arithmetic beyond safe integer range.
