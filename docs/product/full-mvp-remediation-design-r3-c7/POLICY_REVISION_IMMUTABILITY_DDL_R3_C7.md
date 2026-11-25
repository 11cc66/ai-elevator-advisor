# Policy Revision Immutability DDL R3-C7

Artifact: `POLICY_REVISION_IMMUTABILITY_DDL_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

Authoritative DDL: `DATABASE_COMPLETE_DDL_R3_C7.sql`.

## 1. Revision Table

`app.policy_revision` contains:

```text
id, policy_id, policy_kind, scope_project_id, revision_number,
canonical_content bytea, content_digest, content_version,
created_by_principal_id, created_by_session_id,
supersedes_revision_id, created_at
```

Constraints include:

- PK revision ID;
- `(policy_id,revision_number)` unique;
- content digest unique within policy kind/scope;
- nonempty content <= 1 MiB;
- author and author Session FKs;
- supersedes FK to an existing revision.

## 2. Insert Guard

`app_private.guard_policy_revision_r3`:

- rejects every UPDATE and DELETE;
- converts stored canonical bytea back to UTF-8 text;
- recomputes `policy_digest(text)`;
- rejects if the stored digest differs.

This protects inserts from trusted-function bugs as well as direct DML by an
owner/migrator path.

## 3. TRUNCATE

`deny_policy_revision_truncate_r3` raises `42501` before statement execution.
Runtime roles have neither TRUNCATE nor table ownership.

## 4. Creation Boundary

Only `app.create_policy_revision` has runtime EXECUTE for
`elevator_policy_author`. It:

1. locks active TrustedSession and PolicyAuthor grant;
2. verifies project authority when project-scoped;
3. canonicalizes JSONB text;
4. computes digest;
5. inserts immutable Revision;
6. inserts initial CREATE->DRAFT event;
7. preserves any existing current pointer for that policy ID;
8. rechecks active Session.

No direct Runtime INSERT/UPDATE/DELETE grant exists.

## 5. Supersession

A new revision references `supersedes_revision_id`. The old revision is not
updated. Creating/submitting a new draft does not remove the current approved
policy. Only a new APPROVED event moves the effective pointer; only a terminal
event on the currently pointed revision clears it.

## 6. Acceptance

Future DB tests must show:

- direct UPDATE/DELETE fails;
- TRUNCATE fails;
- one-byte canonical-content mutation with stale digest fails;
- no actor can create a revision without an active Session and AuthorityGrant;
- revision/event history remains queryable after supersession.
