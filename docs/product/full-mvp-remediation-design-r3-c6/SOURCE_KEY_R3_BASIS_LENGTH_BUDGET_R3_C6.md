# SOURCE_KEY_R3 / Basis Length Budget R3-C6

Status:

```text
DESIGN ONLY
SOURCE_KEY_R3 FORMAT PRESERVED
R3-BASIS-1-R6 BYTES LIMIT = 512
```

## 1. Options

| Option | Assessment | Decision |
|---|---|---|
| A. Keep 256-byte Basis BYTES cap | Requires reducing SourceKey components and may lose legitimate auxiliary identity | Rejected |
| B. Raise Basis BYTES to cover complete SourceKey | Format already has uint32 length; no framing change for the SourceKey payload | Selected |
| C. Split source components into separate Basis tags | Adds more fields and still needs a canonical relation; not needed for the immediate mismatch | Rejected |

## 2. Exact Calculation

`SOURCE_KEY_R3` unchanged:

```text
magic + version + componentCount = 8 bytes
four component headers             = 32 bytes
sourceKind payload                  = 64 bytes
sourceEntityType payload            = 64 bytes
sourceEntityId payload              = 64 bytes
sourceAuxId payload                 = 128 bytes
end marker                          = 2 bytes
maximum complete SourceKey          = 362 bytes
```

The minimum terminal case with NULL auxiliary is:

```text
8 + 32 + (minimum required ASCII payloads) + 2
```

It remains represented as a present BYTES value; SourceKey itself is never NULL.

## 3. Selected R6 Limit

```text
R3-BASIS-1-R6 BYTES maximum: 512
SOURCE_KEY_R3 maximum:       362
headroom:                    150 bytes
```

The limit is stated in bytes, measured after UTF-8 encoding.

## 4. Enforcement

1. `canonical_source_key_r3` checks each component before assembly.
2. It checks complete result is 1..362 bytes.
3. The SQL source-key CHECK repeats `octet_length(source_key) <= 362`.
4. R6 encoders reject BYTES >512 and SourceKey >362.
5. Snapshot validation rejects a stored source key that differs from derivation.
6. No truncation, Unicode shortening or digest substitution is allowed.

## 5. Boundary Fixtures

| Case | Expected |
|---|---|
| SourceKey 361 bytes | accept |
| SourceKey 362 bytes | accept |
| SourceKey 363 bytes | reject |
| Any component max+1 | reject |
| Aux NULL | accept with explicit null component |
| Aux empty present | reject |
| Multibyte text crossing byte boundary | count UTF-8 bytes |

## 6. Conclusion

The selected option preserves FULL_SOURCE identity, avoids new SourceKey framing,
and makes the Basis limit wider than every valid SourceKey.

