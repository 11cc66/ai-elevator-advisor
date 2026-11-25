# Snapshot Deferred Validation Independent Audit R3-C6

Date: 2026-11-24

## 1. Result

```text
Deferred Validation: FAIL
Snapshot Finalization: BLOCKED
Findings: REV-R3-C6-P1-01, REV-R3-C6-P1-02, REV-R3-C6-P2-04
```

The intended final-state invariant, lock order and CAS concept are useful, but
the submitted function and trigger proposal is not an executable complete
design.

## 2. Final-State Invariant

`SNAPSHOT_DEFERRED_VALIDATION_CONTRACT_R3_C6.md:8-21` requires a FINALIZED
Snapshot to have exact provenance, complete children, matching RuleSet digest,
SourceKey equality, deterministic warning order, Price validity at
`basis_as_of`, independent Basis verification and post-final immutability.

That invariant matches the business objective. The question is whether the DDL
enforces it.

## 3. Trigger Matrix

| Control | Submitted state | Independent result |
|---|---|---|
| Header UPDATE/DELETE guard | Function and trigger DDL present, lines 25-69 | PARTIAL |
| Finalized child mutation guard | Function present, attachment listed in prose, lines 71-103 | PARTIAL |
| Header TRUNCATE guard | DDL present, lines 115-131 | PARTIAL |
| Child TRUNCATE guard | "Repeat" instruction only | NOT COMPLETE |
| Deferred validation dispatch | Generic design, lines 133-159 | NOT EXECUTABLE |
| Deferred trigger attachment | `app.<table>` placeholder, lines 154-159 | NOT EXECUTABLE |
| Basis reconstruction | Calls undefined functions, lines 114-127 | BLOCKED |
| Finalization CAS | Exact SQL present, lines 168-183 | DESIGNED, NOT EXECUTED |

The phrase "Repeat for every child" is not sufficient for implementation
review because object names, trigger names, row/statement mode, owner and
rewrite behavior must be explicit.

## 4. Undefined Helper Functions

`SNAPSHOT_TRIGGER_AND_FUNCTION_DDL_PROPOSAL_R3_C6.md:114-127` invokes:

```text
app.build_snapshot_basis_r6
app.snapshot_record_count
app.verify_snapshot_basis_r6
```

`create_snapshot_r3` additionally invokes:

```text
app_private.current_principal_id
app_private.materialize_snapshot_candidates_r3
app_private.materialize_snapshot_parameters_r3
app_private.materialize_snapshot_prices_r3
app_private.materialize_snapshot_sources_r3
app_private.materialize_snapshot_reviews_r3
app_private.materialize_snapshot_warnings_r3
app_private.materialize_snapshot_missing_fields_r3
app_private.materialize_snapshot_basis_r3
app_private.require_no_active_snapshot_children_r3
```

Those functions have no reviewed bodies in the submitted DDL
(`SNAPSHOT_TRIGGER_AND_FUNCTION_DDL_PROPOSAL_R3_C6.md:149-187`). A database
cannot create this call graph as written.

Further, `build_snapshot_basis_r6` and `verify_snapshot_basis_r6` are required
to be independent implementations, but no SQL function bodies demonstrate that
independence.

## 5. Provenance Input Defect

`create_snapshot_r3` accepts caller-supplied `p_case_id` and
`p_requirement_version_id`. It locks the case and sealed run, but does not
compare the run's exact case, requirement version, project, conversation and
scenario to those separately supplied values
(`SNAPSHOT_TRIGGER_AND_FUNCTION_DDL_PROPOSAL_R3_C6.md:134-168`).

The Snapshot Header also lacks exact foreign keys to the claimed provenance
parents. The separate Selection audit records the full counterexample and
required correction as `REV-R3-C6-P1-01`.

## 6. Concurrency and CAS

`SNAPSHOT_TRANSACTION_CONCURRENCY_CAS_DESIGN_R3_C6.md:7-20` defines a
dependency lock order and `:23-35` defines a CAS finalization update.
`mutation_version` is a real envelope column in the Normalized Schema.

The isolation and CAS concept is stronger than prior prose-only designs.
However, it remains unverified because:

- child mutators do not have complete locking DDL;
- finalization and child updates have not been tested;
- trigger timing under deferred constraint validation has not been executed;
- COMMIT-unknown recovery is described but not tested.

## 7. Whole-Basis Bound

`R3_BASIS_R6_PROTOCOL_R3_C6.md:20-53` gives uint32/uint64 field and body widths
and a 512-byte individual BYTES limit, but defines no maximum:

- record count;
- aggregate field/body bytes;
- whole Basis bytes.

A writer can therefore construct a syntactically valid but resource-unbounded
Basis until a separate transport or memory limit fails. This is
`REV-R3-C6-P2-04`. Define explicit maxima and a shared encoder/database reject
contract.

## 8. Required Correction

1. Publish complete SQL bodies and exact signatures for every referenced
   function and trigger function.
2. Derive case, requirement version, project, conversation and scenario from
   the sealed run, or verify caller values against it before insertion.
3. Add exact root and child FKs described by the provenance design.
4. Enumerate every child/metadata/validation table trigger with concrete DDL.
5. Replace `app.<table>` with exact statements and show trigger owner/grants.
6. Define whole-Basis record, body and total byte maxima with reject vectors.
7. Provide a clean DDL parse/introspection result before any database
   authorization.

Acceptance requires every referenced function to exist, every trigger to be
attached to a named table, every provenance mismatch to fail by a named DB
constraint, and deferred validation to reject incomplete or oversized Basis on
an authorized isolated database.

## 9. Runtime Boundary

No DDL, SQL, PostgreSQL trigger, transaction, lock, CAS, COMMIT or rollback was
executed. All behavior in this document is static design evidence.
