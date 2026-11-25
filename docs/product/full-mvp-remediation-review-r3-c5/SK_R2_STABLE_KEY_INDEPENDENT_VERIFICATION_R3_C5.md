# SK-R2 StableKey Independent Verification

Date: 2026-11-24

Result:

```text
SK-R2: PASS
SUCCESSFUL FIXED BYTES: 17/17
FAILED DOMAIN CASES: 0
```

## 1. Protocol

```text
"SKR2"                  4 bytes
encoding_version        uint16be = 2
registry_version        uint16be
record_type             uint16be
component_count         uint16be
component:
  index                 uint16be
  type                  uint8
  presence              uint8
  length                uint32be
  bytes
end_marker               uint16be = 0xFFFF
```

The one-byte component type is confirmed. The former Node two-byte mistake is
not present in the final implementation.

## 2. Independent Method

The reviewer implemented a separate Python encoder from the protocol, without
importing either design encoder. It validated:

- tuple definition and arity;
- record-type domain separation;
- ASCII ID/key domains;
- INT64 fixed-width encoding;
- byte lengths;
- the end marker;
- equality/inequality expectations.

The design’s Node and Python encoders were also run independently. All three
produced the same C5-SNAP-01 bytes.

## 3. Successful Fixed Byte Vectors

| Case | Side | Full encoded bytes |
|---|---|---|
| SKV-COLON-01 | A | `534B523200020002000400020001010100000003613A62000201010000000163FFFF` |
| SKV-COLON-01 | B | `534B523200020002000400020001010100000001610002010100000003623A63FFFF` |
| SKV-EMPTY-01 | A | `534B523200020002000400020001010100000000000201010000000178FFFF` |
| SKV-EMPTY-01 | B | `534B52320002000200040002000101010000000161000201010000000178FFFF` |
| SKV-NULL-EMPTY-01 | A | `534B523200020002000400020001000000000000000201010000000178FFFF` |
| SKV-NULL-EMPTY-01 | B | `534B523200020002000400020001010100000000000201010000000178FFFF` |
| SKV-MISSING-01 | B | `534B52320002000200040002000101010000000161000201010000000162FFFF` |
| SKV-TYPE-CONFUSION | B | `534B52320002000200080002000101010000000B63616E6469646174652D3100020301000000080000000000000001FFFF` |
| SKV-LEADING-ZERO | B | `534B52320002000200080002000101010000000B63616E6469646174652D3100020301000000080000000000000001FFFF` |
| SKV-DOMAIN-SEPARATION | A | `534B52320002000200040002000101010000000161000201010000000162FFFF` |
| SKV-DOMAIN-SEPARATION | B | `534B52320002000200030002000101010000000161000202010000000162FFFF` |
| SKV-REGISTRY-SEPARATION | A | `534B52320002000200040002000101010000000161000201010000000162FFFF` |
| SKV-REGISTRY-SEPARATION | B | `534B52320002000300040002000101010000000161000201010000000162FFFF` |
| SKV-PREFIX | A | `534B5232000200020004000200010101000000026162000201010000000163FFFF` |
| SKV-PREFIX | B | `534B5232000200020004000200010101000000016100020101000000026263FFFF` |
| SKV-LENGTH-64 | A | `534B52320002000200040002000101010000004041414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141000201010000000163FFFF` |
| SKV-HISTORICAL-COLON-ID | A | `534B5232000200020002000100010101000000196C65676163793A70726F6A6563743A6275696C64696E673A31FFFF` |

## 4. Rejection Cases

| Case | Result |
|---|---|
| Missing component | REJECT before encoding |
| Unicode NFC ID | REJECT because stable-key ID domain is ASCII |
| Unicode NFD ID | REJECT |
| Chinese/Japanese ID | REJECT |
| 65-byte component | REJECT |
| Invalid Unicode scalar | REJECT |
| Required empty/NULL | Encodable at codec level, rejected by SNAPSHOT-R2 validation |

## 5. Domain and Length

- Maximum registered tuple: two 64-byte components = 158 bytes.
- Endianness is uniquely big-endian.
- Component type is one byte.
- Component length counts UTF-8 bytes.
- Complete bytes, not a hash, are the uniqueness/comparison value.
- Structured composite UNIQUE remains the primary database relationship guard.

## 6. Residual Minor Finding

`SKV-REGISTRY-SEPARATION` encodes registry code 3 while the SK-R2 layout names
registry code 2 as `SNAPSHOT-R2`. The bytes prove domain separation, but the
test must state that registry 3 is synthetic and cannot become a production
Registry without a new approval.

## 7. Conclusion

No collision or framing failure was found in SK-R2. The original C4 P1 stable
key finding is resolved.

