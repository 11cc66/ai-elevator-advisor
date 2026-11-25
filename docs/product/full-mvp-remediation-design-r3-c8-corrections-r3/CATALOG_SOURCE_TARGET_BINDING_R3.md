# Catalog Source Target Binding R3

`catalog_source_target_binding_r2.source_revision_id` references the actual
`catalog_source_revision(id)` Primary Key.

Before digest calculation, `a_bind_catalog_source_evidence_r3` loads the Source
row `FOR SHARE`, copies `evidence_object_id` and `raw_content_digest`, and
rejects later changes to those copied values.

`catalog_review_event_r3.source_target_binding_id` references Binding primary
key. `a_bind_catalog_event_binding_r3` then verifies caller-supplied source,
target, project and binding digest and copies the authoritative values before
Event V2 digest calculation.

The exact target identity remains:

```text
binding ID / project / target kind
product revision / digest
specification revision / digest
price revision / price fact digest
source revision / evidence / content digest
binding digest
```

The two ProfessionalReview source tables gain `candidate_id`; triggers derive
it from the review Event or sealed Selection result before FK checks.

Rejected cases include wrong Source Revision, altered Source evidence, wrong
target kind/digest/project, Event to unrelated Binding, missing candidate and
Snapshot mutation after seal.

PostgreSQL FK/trigger execution remains `NOT VERIFIED`.
