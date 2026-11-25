# SOURCE_KEY_R3 / R6 Maximum-Length Independent Audit

Result:

```text
SOURCE_KEY_R3: PASS
SOURCE_KEY 362-BYTE LIMIT: PASS
R6 BYTES 512 LIMIT: PASS
NODE_PYTHON_LENGTH ENFORCEMENT: PASS
```

## 1. Independent Calculation

```text
magic/version/count        8
four component headers    32
sourceKind                64
sourceEntityType          64
sourceEntityId            64
sourceAuxId              128
end marker                 2
total                    362
```

The registered sample with real known enum names reaches 275 bytes. The
theoretical component maxima reach 362.

## 2. Boundary Evidence

```text
REGISTERED_SAMPLE_MAX_BYTES=275
THEORETICAL_COMPONENT_MAX_BYTES=362
MAX_PLUS_1_BYTES=363
MAX_PLUS_1=REJECT component length 129
R6_BYTES_LIMIT=512
```

Node and Python:

- reject component >128 auxiliary bytes;
- compute SourceKey after NFC;
- reject complete SourceKey >362;
- reject generic BYTES >512;
- never truncate or substitute NULL.

## 3. Remaining P2

The supplied boundary checker prints the 363-byte expectation but does not run
a 363-byte rejection through both encoders. The code enforces the limit, but
executable negative evidence is incomplete.

## 4. Conclusion

The numerical contradiction is fixed. No collision or length mismatch remains
in the current valid vector.

