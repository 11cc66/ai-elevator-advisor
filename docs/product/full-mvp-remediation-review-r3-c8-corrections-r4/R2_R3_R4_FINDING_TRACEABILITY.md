# R2 / R3 / R4 Finding Traceability

## Original Source Anchors

R2 source:

```text
docs/product/full-mvp-remediation-review-r3-c8-corrections-r2/
  REVIEW_FINDINGS_AND_REQUIRED_CORRECTIONS.md
```

Original Finding headings:

```text
P1-01 line 5
P1-02 line 42
P1-03 line 70
P2-01 line 107
P2-02 line 131
P2-03 line 153
P2-04 line 170
P2-05 line 184
P2-06 line 198
P3-01 line 219
P3-02 line 227
```

R3 source:

```text
docs/product/full-mvp-remediation-review-r3-c8-corrections-r3/
  INDEPENDENT_REVIEW_R3_C8_CORRECTIONS_R3.md
```

Original Finding headings:

```text
R3 P2-01 line 81
R3 P2-02 line 87
R3 P2-03 line 94
R3 P3-01 line 100
```

## R2 Original Findings

| Finding | Original severity | R3 status | R4 independent status | Evidence / residual |
|---|---|---|---|---|
| `R2-P1-01` Bootstrap recovery structure | P1 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | Immutable Generation history, Lifecycle deferrable FK and new Attempt model remain structurally valid |
| `R2-P1-02` Catalog FK targets | P1 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | Exact Source/Binding PK targets and binding-copy Triggers retained |
| `R2-P1-03` PUBLIC EXECUTE | P1 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | Final PUBLIC revoke plus full R3 capability baseline restoration |
| `R2-P2-01` Result Recovery duplication | P2 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | One recovery per Request and replay-first retained |
| `R2-P2-02` Bootstrap replay/interruption | P2 | Partially resolved | `PARTIALLY RESOLVED` | Expiry and lost-response paths are fixed, but an expired untriggered Attempt still blocks immediate next Begin |
| `R2-P2-03` Owner lock | P2 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | Advisory transaction lock remains |
| `R2-P2-04` Principal ACTIVE | P2 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | Begin/Approve/Deny/Execute checks are stronger; ROTATION current Root still missing at Execute |
| `R2-P2-05` Catalog actor Grant | P2 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | Composite Session/Grant/Principal FK remains |
| `R2-P2-06` Validator | P2 | Partially resolved | `PARTIALLY RESOLVED` | 29/12/46 reproduce, but new identity/expiry rules are missing and one vector is vacuous |
| `R2-P3-01` State/timestamp | P3 | Partially resolved | `RESOLVED — INDEPENDENT STATIC REVIEW` | R3 checks plus R4 terminal Attempt time/reason checks are present |
| `R2-P3-02` Guard outcome | P3 | Resolved independent static | `RESOLVED — INDEPENDENT STATIC REVIEW` | Review Guard records child exit and finish time |

## R3 Independent Review Findings

| Finding | Original severity | R4 independent status | Basis |
|---|---|---|---|
| `REV-R3-R3-P2-01` | P2 | `RESOLVED — INDEPENDENT STATIC REVIEW` | Final expiry helper/callers have no rollback-by-RAISE path |
| `REV-R3-R3-P2-02` | P2 | `RESOLVED — INDEPENDENT STATIC REVIEW` | Denied/Locked terminal rows no longer block next sequence/Attempt |
| `REV-R3-R3-P2-03` | P2 | `PARTIALLY RESOLVED` | Submitted suites reproduce, but independent state rules reveal missing checks |
| `REV-R3-R3-P3-01` | P3 | `RESOLVED — INDEPENDENT STATIC REVIEW` | Candidate columns are NOT NULL with exact FKs |

## New R4 Independent Findings

| Finding | Severity | Status | Summary |
|---|---|---|---|
| `REV-R4-IND-P2-01` | P2 | `NOT RESOLVED` | Execute does not recheck current ROTATION Root |
| `REV-R4-IND-P2-02` | P2 | `NOT RESOLVED` | Expired active Attempt blocks immediate next Begin |
| `REV-R4-IND-P2-03` | P2 | `NOT RESOLVED` | Sealed Candidate backfill has no durable per-row audit evidence |
| `REV-R4-IND-P3-01` | P3 | `NOT RESOLVED` | R4 traceability has stale ranges and duplicate Finding ID |

## Historical Evidence Preserved

- C6-SNAP-01 remains 15 records / 4036 bytes.
- SourceKey maximum remains 362 bytes.
- Basis maximum remains 512 bytes.
- SK-R2 registry code remains 3.
- Result Recovery remains single-per-Request and replay-first.
- Owner advisory lock remains implemented.
- Catalog source/target identity remains exact.
- Append-only review/audit protections remain present.

## Non-Promotions

`RESOLVED — INDEPENDENT STATIC REVIEW` does not mean PostgreSQL Runtime passed.
All database, Catalog, lock and concurrency conclusions remain separate.
