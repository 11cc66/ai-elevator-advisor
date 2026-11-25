# Rotation Execute Current Root Revalidation R5

## Finding

```text
REV-R4-IND-P2-01
Status: RESOLVED — DESIGN
```

R4 checked the active Root at Begin but not immediately before the ROTATION
Effect. A Session/Grant/Principal/Epoch revocation in the Begin-to-Execute
window could therefore allow a stale approval to advance the Generation.

## Lock Order

The R5 public command order is:

```text
validate command role
-> pg_advisory_xact_lock(Bootstrap identity mutex)
-> lock Attempt
-> lock Lifecycle
-> revalidate current Root
-> validate approvals
-> mutate operator/approval/Generation
-> append Event
-> complete Request Ledger
-> COMMIT
```

Begin locks the identity mutex first, then Lifecycle, then an active Attempt.
Approve, Execute and Deny lock the identity mutex first, then Attempt, then
Lifecycle. Because command execution is serialized by the same mutex, the two
row-lock orders cannot interleave.

Every update/delete on:

- `trusted_principal`;
- `principal_epoch`;
- `trusted_session`;
- `authority_grant`;
- `bootstrap_root_session_r2`;
- `bootstrap_root_grant_r2`;
- `bootstrap_operator_r3`;

has a `BEFORE ... FOR EACH STATEMENT` Trigger that takes the same mutex before
the statement can lock its target rows.

## Current Root Proof

`app_private.assert_current_root_authority_r5` verifies one connected identity
graph:

```text
current ACTIVE Generation
-> bound Root Session
-> ACTIVE trusted_session with same Principal and database role
-> ACTIVE trusted_principal
-> principal_epoch equals session login epoch
-> bound Root Grant
-> unrevoked, currently valid authority_grant for the exact Session/Principal
```

The DB clock is read once before the checks. Missing, disabled, expired or
revoked state raises `42501`.

## Execute and Final Trigger

The public Execute body performs the Root check after locking Lifecycle and
before modifying any Root Operator or Generation row. It passes
`p_allow_superseded_for_transition=false`.

The final Generation guard runs in the locked Execute transaction after the old
Generation has been marked `SUPERSEDED`. For `kind='ROTATION'` only, it permits
that exact transition state and repeats the full Root identity check. It also
requires:

- the matching APPROVED Attempt for `NEW.generation - 1`;
- target Principal, role, token digest and Generation identity to match;
- the Approval window to remain valid;
- exactly two still-enabled, ACTIVE non-Root approvals.

RECOVERY is allowed through the same Generation guard without requiring the
compromised/lost Root to remain ACTIVE; it is not converted into ROTATION.

## Revocation Serialization

```text
Revocation obtains mutex first:
  revocation commits -> later Execute reads revoked identity -> FAIL

Execute obtains mutex first:
  Execute rechecks, performs Effect and commits
  -> concurrent revocation waits, then applies to the new committed state
```

No path can commit a revocation and then let an Execute that began earlier
advance the Generation based only on its stale Begin-time or approval-time
snapshot.

## Offline Evidence

`IND-MUT-10`, the revoked-Root state vector, final-Trigger checks and
`R4-REC-01` all pass in `VALIDATION_EVIDENCE_R5.json`.

Actual PostgreSQL lock acquisition, deadlock selection and transaction
visibility remain `NOT VERIFIED`.

