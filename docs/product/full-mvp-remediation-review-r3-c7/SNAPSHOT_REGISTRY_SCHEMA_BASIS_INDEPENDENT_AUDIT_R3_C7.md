# Snapshot Registry / Schema / Basis Independent Audit R3-C7

## Result

```text
SK-R2 / Registry Code 3: PASS — independent C6 check
C6-SNAP-01: PASS
Registry field crosswalk: PARTIAL
SQL encoder equivalence: FAIL — P2-01/P2-02
Snapshot completeness: FAIL — P1-02
```

## Independent C6 Result

```text
Records: 15
Types: 0,1,1,2,2,3,3,4,4,5,5,6,7,8,9
Bytes: 4036
SHA-256:
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
HEX match: true
```

The independent script did not import R3-C7 encoders.

## Positive

- All ten record types exist in the Schema/Basis projection.
- Record ordering is by record type, StableKey, row ID.
- The R3 Basis header and all fixed/variable field framing match the C6 vector.
- The resource vectors and C6 vector fit the new limits.
- The complete DDL contains the requested materializer, builder, verifier and
  Snapshot validator functions.

## P2-01: SQL/Node/Python divergence

- SQL does not enforce the 18-total-digit DECIMAL precision check.
- SQL Header field-type mapping permits any of four scalar classes for each
  Header tag instead of the exact Registry type.
- SQL StableKey allows a 1-or-2-component tuple without requiring the exact
  arity for each record type.

These are not caught by the supplied positive C6 vector.

## P2-02: Auxiliary Unicode

Node/Python source key encoders normalize NFD auxiliary text to NFC and accept
it. SQL `source_key_r3` rejects NFD because it requires input already NFC. The
R3-C7 evidence records `SRC-AUX-NFD=ACCEPT`, demonstrating the semantic split.

## P1-02: Basis-visible child completeness

The verifier validates the bytes generated from current child rows, but not that
the child rows are the complete, exact canonical projection of the sealed run.
An internally consistent Basis can omit or alter source/review/warning records.

## Boundary

No PostgreSQL encoder or trigger was executed.
