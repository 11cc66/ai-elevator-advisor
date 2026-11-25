# Candidate Backfill Audit Review R5

## Original Finding

```text
REV-R4-IND-P2-03:
PARTIALLY RESOLVED
```

The durable per-row audit gap is materially corrected. A remaining actor
binding defect blocks independent closure.

## Positive Findings

`app.candidate_backfill_batch_r5` has:

- unique batch ID and request ID;
- target table and fixed policy version;
- expected/applied/failed counts;
- state constraints;
- Actor Principal, Session and Grant composite FK;
- reason, timestamps and batch digest.

`app.candidate_backfill_row_audit_r5` has:

- unique row audit identity per batch/target row;
- exact target row key and key digest;
- explicit old NULL marker;
- new Candidate;
- provenance type/id/version/policy;
- parent state;
- old/new row digests;
- original sealed digest and Correction Digest;
- Actor Principal/Session/Grant;
- reason, Event link, timestamp and success state.

The controlled function inserts the general Review Audit and specialized row
audit before the Candidate-only UPDATE. `ROW_COUNT` must be exactly one and the
applied count must equal expected before the batch may become COMPLETED.

## P2 — Actor Binding Defect

The SECURITY DEFINER function accepts:

```text
p_actor_principal_id
p_actor_session_id
p_actor_authority_grant_id
```

It verifies that those supplied rows are mutually consistent and ACTIVE, but it
does not verify that they represent the process executing the function. The
function never references `session_user`, a locked current Session, or
`pg_backend_pid()`.

Current impact:

- no PUBLIC or runtime role has EXECUTE;
- only the function owner can invoke, so the operation is fail-closed today;
- the future approved maintenance invocation path is not safe to grant without
  an executor/session binding check.

Required design correction: bind the actor tuple to the actual maintenance
executor, or define a dedicated verified actor context that the function locks
and attests before batch creation.

## Digest Assessment

The Correction Digest binds:

- schema/version;
- original sealed digest;
- old/new row digest;
- resolved Candidate;
- authoritative source Event.

Canonical JSON text is used for the digest fields; all inputs in this specific
digest are strings. No ordering ambiguity was found in the declared structure.
Runtime PostgreSQL JSON canonicalization remains unverified.

## Atomicity Assessment

The audit insert and target update share one transaction. A failure after the
audit insert rolls back the audit, target update, batch, Review Audit and Event
evidence together. Idempotent replay returns the stored non-NULL batch result
only when request hash, target and Actor tuple match.

## Remaining Boundaries

- Existing Candidate cardinality is unknown.
- Trigger firing order is not Runtime verified.
- Lock duration and SQLSTATE are not verified.
- The maintenance executor identity remains OPEN.

