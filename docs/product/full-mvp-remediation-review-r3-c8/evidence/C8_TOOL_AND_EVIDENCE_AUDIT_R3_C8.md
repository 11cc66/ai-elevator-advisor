# C8 Tool and Evidence Audit

No C8 tool was executed during this independent review.

## `generate_complete_ddl_r3_c8.py`

- Accepts three caller-supplied paths.
- Reads C7 DDL and C8 overlay; writes the complete DDL.
- Does not access network, database, Storage or environment secrets.
- Does not clean or recurse.
- Does not guard output to the C8 directory and does not refuse overwrite.
- Replaces the explicit owner placeholder with generated owner statements.
- Produces text by concatenation; it is not a PostgreSQL parser.

Result: functionally consistent for the checked-in invocation; unsafe as a
general-purpose file writer (`REV-R3-C8-P3-01`).

## `build_function_registry_r3_c8.py`

- Reads DDL and writes caller-specified JSON.
- Uses regular expressions, not a PostgreSQL parser or Catalog.
- Resolves final definitions and exact owners by normalized text.
- Builds a call-target name graph.
- Replaces rather than unions `execute_roles` when one signature has multiple
  GRANT statements.
- No DB/Storage/network access; no recursion or cleanup.

Result: final checked-in signature/owner set matches independent parsing.
Grant parsing is not robust against repeated grants.

## `validate_c8_ddl.py`

- Reads DDL/Registry and writes caller-specified JSON.
- Checks selected signatures, owners, search paths, FKs, required columns,
  digest triggers, TRUNCATE subset, role grants and selected R6 text.
- It does not verify:
  - source-table FK coverage for semantic IDs;
  - Price payload completeness;
  - ProfessionalReview decision/basis/time equality;
  - role membership closure and attributes;
  - initial grant bootstrap or dynamic session CONNECT;
  - SQL grammar, PostgreSQL compilation, ACLs, triggers or concurrency.
- It emits `PASS` for findings outside its hard-coded check set.

Result: useful partial lint; not evidence of complete DDL consistency.

## `run_independent_evidence.py`

- Invokes two C7 review scripts and the C8 validator.
- Overwrites four C8 evidence files.
- Sets `PYTHONDONTWRITEBYTECODE=1` for child processes.
- No DB/Storage/network access.
- It is not independent of the C8 validator and is still not a PostgreSQL
  semantic oracle.

Result: acceptable as a reproducibility harness; not an independent design
review.

## Evidence Comparison

The review's own `independent_review_verify.py`:

- does not import or execute C8 tools;
- hashes the C8 manifest and all listed files;
- reconstructs C6-SNAP-01 from the semantic fixture;
- evaluates all 23 Scalar and 14 resource vectors;
- parses all 50 tables, 9 unique views, 78 functions, 64 FKs and 103 triggers;
- checks exact FK targets and source columns;
- checks Registry signature/owner/path/call consistency;
- checks 57 Open Decision IDs;
- identifies the eight static design gaps listed in the main evidence JSON.

Its SQL checks remain static text analysis:

```text
PostgreSQL SQL Grammar: NOT VERIFIED
PostgreSQL Compilation: NOT VERIFIED
Catalog/Trigger/ACL/Runtime: NOT VERIFIED
```
