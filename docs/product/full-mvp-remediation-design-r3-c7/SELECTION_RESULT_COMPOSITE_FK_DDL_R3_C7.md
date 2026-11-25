# Selection Result Composite FK DDL R3-C7

Artifact: `SELECTION_RESULT_COMPOSITE_FK_DDL_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

Authoritative SQL:

```text
DATABASE_COMPLETE_DDL_R3_C7.sql
```

## 1. Product Revision

```sql
FOREIGN KEY (product_id,product_revision_id,product_revision_digest)
REFERENCES app.product_revision(product_id,id,content_digest)
```

Parent uniqueness:

```sql
UNIQUE (product_id,id,content_digest)
```

## 2. Specification Revision

```sql
FOREIGN KEY (
  product_id,product_revision_id,
  specification_revision_id,specification_revision_digest
)
REFERENCES app.specification_revision(
  product_id,product_revision_id,id,content_digest
)
```

This proves the specification belongs to the exact ProductRevision, not merely
the same product.

## 3. Candidate

The candidate's exact uniqueness tuple contains:

```text
id
selection_run_id
project/conversation/requirement/version/scenario
rule_set_revision_id + digest
product_id + product_revision_id + digest
specification_revision_id + digest
```

SelectionCandidateResult references all of it.

## 4. Result

The result is unique on:

```text
candidate_id
```

and additionally unique on:

```text
id,candidate_id,selection_run_id
```

The latter is the exact target for Snapshot Candidate provenance.

## 5. Price

`selection_candidate_price` has a non-null candidate row and exact PriceRevision
key:

```text
price id + product id + product revision id +
specification revision id + source revision id
```

There is no optional composite price FK on SelectionCandidateResult.

## 6. Parameter

`selection_candidate_parameter` references both:

- exact candidate/product-revision key;
- exact CatalogParameterRevision
  `(id,product_id,product_revision_id,parameter_key,value_type,source_revision_id)`.

## 7. Snapshot

Snapshot Header references:

```text
selection_run_seal(
  selection_run_id,case_id,project_id,conversation_id,
  requirement_id,requirement_version_id,installation_scenario,
  rule_set_revision_id,rule_set_content_digest
)
```

Snapshot Candidate references Snapshot `(id,selection_run_id)` and
SelectionCandidateResult `(id,candidate_id,selection_run_id)`.

Snapshot parameter/price children reference the same Snapshot Candidate row.

## 8. Static Result

The DDL static validator found all required FK fragments and no undefined
function/table reference. Live PostgreSQL enforcement remains `NOT VERIFIED`.
