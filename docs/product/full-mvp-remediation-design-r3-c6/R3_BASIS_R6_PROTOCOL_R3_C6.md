# R3-BASIS-1-R6 Protocol R3-C6

## 1. Header

```text
magic              "R3BASIS\0"
version            uint16be = 6
payload type       uint16be = 1
header length      uint32be = 28
record count       uint32be
body length        uint64be
```

## 2. Record Frame

```text
recordLength       uint32be
recordType         uint16be
rowIdLength        uint16be
rowId              ASCII
stableKeyLength    uint16be
stableKey          SK-R2 bytes (registry code 3)
fieldCount         uint16be
fields
```

## 3. Field Frame

```text
tag                uint16be
type               uint8
presence           uint8
valueLength        uint32be
value
```

Fields are required exactly once and sorted by tag. NULL is `type=0,presence=0`.

## 4. Scalar Limits

See `R3_BASIS_SCALAR_VALIDATION_PROTOCOL_R3_C6.md`.

Key changes from R5:

- BYTES maximum raised to 512;
- SourceKey field remains limited to 362;
- strict acceptance/rejection enforcement is required in both encoders;
- no change to SK-R2 framing.

## 5. Record Ordering

```text
(recordType numeric, stableKey bytes, rowId bytes)
```

## 6. Versions

```text
Registry: SNAPSHOT-R3
Protocol: R3-BASIS-1-R6
StableKey: SK-R2 registry code 3
```

R5 vectors remain historical and are not reinterpreted.

