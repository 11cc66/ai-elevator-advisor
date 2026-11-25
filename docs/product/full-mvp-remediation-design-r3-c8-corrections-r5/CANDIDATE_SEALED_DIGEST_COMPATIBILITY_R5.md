# Candidate Sealed Digest Compatibility R5

## Original Digest Semantics

The existing Sealed Selection digest remains immutable. Candidate ID is
materialized from the authoritative Professional Review Event and is indirectly
bound by the already-digested Selection Result identity plus its composite
Candidate FK. R5 does not rewrite, replace or silently recompute the original
Sealed/Finalized digest.

## Per-row Correction Proof

For each backfill row R5 stores:

```text
original_sealed_digest
old_row_digest
new_row_digest
correction_digest
```

The correction digest is a new immutable proof:

```text
SHA-256(
  canonical JSON {
    schema = AIEA-CANDIDATE-BACKFILL-CORRECTION-V1,
    originalSealedDigest,
    oldRowDigest,
    newRowDigest,
    candidateId,
    sourceEventId
  }
)
```

The original digest remains a referenced historical fact. The correction digest
proves exactly which immutable row changed from an explicit NULL marker to the
authoritative Candidate.

## Guard Compatibility

The existing sealed/finalized guards are not disabled:

- `guard_sealed_result_r3` accepts only the Candidate-only helper transition.
- `guard_snapshot_child_r3` accepts only the Candidate-only helper transition.
- all other JSON fields must compare equal;
- a pre-existing non-NULL Candidate cannot be replaced;
- mismatch, delete or unrelated field change remains denied.

Snapshot digest verification remains active. R5 does not remove Candidate from
any digest input or claim that the new correction digest is the original digest.

## Evidence Boundary

Static checks prove:

- original and correction digests are mandatory NOT NULL fields;
- the controlled function binds them to the target row and source Event;
- the original Seal row remains under its existing immutable guard;
- both Candidate columns end NOT NULL.

Actual Trigger execution order, existing row cardinality and PostgreSQL digest
computation remain `NOT VERIFIED — DATABASE NOT AUTHORIZED`.

