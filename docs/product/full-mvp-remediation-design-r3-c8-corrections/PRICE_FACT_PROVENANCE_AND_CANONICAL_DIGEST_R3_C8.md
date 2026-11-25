# Price Fact Provenance and Canonical Digest R3-C8 Corrections

## Fact Boundary

The authoritative Price fact is `app.price_revision`. Its immutable fact
includes:

```text
priceRevisionId
sourceRevisionId
productId / productRevisionId / productRevisionDigest
specificationRevisionId / specificationRevisionDigest
amountMinor
currency
priceBasis
taxBasis
applicability
validFrom / validUntil / quotedAt
priceUnitCode
quantityMin / quantityMax
```

`priceUnitCode`, quantity bounds and region-specific conditions are nullable
only when the business fact truly does not constrain them. NULL is encoded as
JSON null and is distinct from an empty string.

## Canonical Encoding

The design uses `price_fact_canonical_v1(jsonb)` with a fixed object whose keys
are:

```text
schema
priceRevisionId
sourceRevisionId
productId
productRevisionId
productRevisionDigest
specificationRevisionId
specificationRevisionDigest
amountMinor
currency
priceBasis
taxBasis
applicability
validFromUtc
validUntilUtc
quotedAtUtc
priceUnitCode
quantityMin
quantityMax
```

Rules:

- amount is a base-10 integer string in minor currency units;
- currency is uppercased and must match `^[A-Z]{3}$`;
- timestamps are rendered at UTC with fixed microsecond precision;
- validity is half-open `[valid_from, valid_until)`; NULL upper bound means
  unbounded;
- price basis, tax basis and applicability use the closed domains already
  present in the design;
- numeric quantity values use their canonical PostgreSQL numeric text;
- key order is JSONB canonical rendering, independent of caller insertion order;
- no caller-provided digest is accepted.

The digest is:

```text
SHA-256("AIEA-PRICE-FACT\0v1\0" || UTF8(canonical_json::text))
```

`a_compute_price_revision_fact_digest_r3` computes the digest in the database.
`a_compute_selection_price_row_digest_r3` and
`a_verify_snapshot_price_fact_r3` cover the complete copied Price facts; the
existing ID-only digest is replaced for price rows.

## Snapshot Binding

`selection_candidate_price` copies the complete fact and has an exact FK to the
PriceRevision's identity, source, product/specification digests and
`price_fact_digest`. `sales_snapshot_price_r3` copies the same facts and has an
exact FK to the sealed selection price row. The Snapshot Price row digest
covers every business field, not merely its IDs.

## Counterexamples

The following must reject:

- changing `amount_minor` while keeping the Price ID;
- changing currency, price basis, tax basis, applicability or validity;
- keeping the digest but changing a fact field;
- swapping to another Price Revision;
- using another Project/Candidate/SelectionRun;
- changing Snapshot Price values in a DRAFT row.

## Historical Basis

The C6-SNAP-01 record format remains unchanged: 15 records, 4036 bytes and
SHA-256 `7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB`.
The new Price Fact digest is an additional database integrity fact, not a
change to the historical wire encoding.

## Residual Boundary

This is static design only. PostgreSQL grammar, constraint behavior, trigger
behavior and actual historical-data migration are `NOT VERIFIED`.
