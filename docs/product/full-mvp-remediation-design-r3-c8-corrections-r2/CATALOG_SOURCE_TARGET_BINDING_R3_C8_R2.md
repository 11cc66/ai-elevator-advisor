# Catalog Source-Target Binding R3-C8 R2

## Exact Binding

`catalog_source_target_binding_r2` binds one Catalog Source Revision to exactly
one target:

- Product Revision;
- Specification Revision; or
- Price Revision / Price Fact.

ProductRevision and SpecificationRevision now carry `source_revision_id`. Price
Revision already carries it. Their exact unique keys include the Source
Revision.

## Composite FK Matrix

```text
Product binding:
  (product_id, revision_id, revision_digest, source_revision_id)

Specification binding:
  (product_id, product_revision_id, specification_revision_id,
   specification_digest, source_revision_id)

Price binding:
  (price_revision_id, product_id, product_revision_id,
   specification_revision_id, price_fact_digest, source_revision_id)
```

The binding also references the Source's Evidence Object and raw content digest.

## Binding Digest

`AIEA-CATALOG-SOURCE-TARGET-V1` covers:

```text
binding ID
project scope
target kind
product / product revision / product digest
specification revision / digest
price revision / price fact digest
source revision / evidence object / content digest
```

The caller cannot supply a trusted digest; `BEFORE INSERT` computes it.

## Event and Snapshot Chain

CatalogReview Event V2 references the complete binding tuple by composite FK.
Its `AIEA-CATALOG-REVIEW-EVENT-V2` digest covers binding ID/digest, source,
target, policy, decision, actor and database time.

Selection CatalogReview rows copy:

```text
event digest
binding ID and digest
source revision
target kind/revision/digest
```

The Selection row digest includes those fields. Snapshot CatalogReview rows use
the same composite binding FK and copy from the sealed Selection row.

## Rejected Cases

- Product Source with Specification target;
- Specification Source with Product target;
- Price Source with unrelated Product target;
- correct Source ID with wrong Source Revision;
- correct IDs with wrong revision or target digest;
- target and source in different project scopes;
- stale Source after a Product revision changes;
- Event bound to another binding;
- unrestricted polymorphic target ID;
- Snapshot retaining IDs while changing copied facts.

The SQL design is static. PostgreSQL Catalog and FK runtime remain unverified.
