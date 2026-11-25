# PostgreSQL Official Semantics References R3-C7

Artifact: `POSTGRESQL_OFFICIAL_SEMANTICS_REFERENCES_R3_C7.md`

Metadata authority: `SHA256SUMS_R3_C7.txt`.

## 1. Read-Only Sources

All pages were fetched read-only from the official PostgreSQL 18 documentation
on 2026-11-24. No statement was executed.

| Subject | Version/title | URL |
|---|---|---|
| Row locks/isolation behavior | PostgreSQL 18 — 13.2 Transaction Isolation | https://www.postgresql.org/docs/18/transaction-iso.html |
| Explicit row/share/update locks | PostgreSQL 18 — 13.3 Explicit Locking | https://www.postgresql.org/docs/18/explicit-locking.html |
| Row/statement/TRUNCATE triggers, constraint timing | PostgreSQL 18 — CREATE TRIGGER | https://www.postgresql.org/docs/18/sql-createtrigger.html |
| Function properties, SECURITY DEFINER, search path | PostgreSQL 18 — CREATE FUNCTION | https://www.postgresql.org/docs/18/sql-createfunction.html |
| View security/barrier semantics | PostgreSQL 18 — CREATE VIEW | https://www.postgresql.org/docs/18/sql-createview.html |
| Object/function/view privileges | PostgreSQL 18 — GRANT | https://www.postgresql.org/docs/18/sql-grant.html |
| Creator-role default ACL | PostgreSQL 18 — ALTER DEFAULT PRIVILEGES | https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html |
| Unicode normalization | PostgreSQL 18 — 9.4 String Functions and Operators: `normalize`, `IS NFC NORMALIZED` | https://www.postgresql.org/docs/18/functions-string.html |

## 2. Design Use

- Epoch/Session/Grant locks use `FOR SHARE` versus `FOR UPDATE`.
- Revocation and epoch change hold update locks through commit.
- Snapshot/Policy Event guards are row or statement triggers.
- Final-state Snapshot validation uses deferred constraint triggers.
- Every SECURITY DEFINER function has a fixed schema-qualified search path.
- Function privileges are matched to exact signatures and owner roles.
- Views declare security barrier/owner behavior and use explicit predicates.
- Default privileges are revoked separately for every creating owner.
- Source auxiliary/TEXT NFC admission uses PostgreSQL 18 `IS NFC NORMALIZED`.

## 3. Limits of This Evidence

Official documentation establishes semantics, not that the submitted DDL
compiles or behaves as intended. Actual PostgreSQL OIDs, triggers, ACLs,
constraint timing and concurrency remain `NOT VERIFIED` without a separately
authorized isolated database phase.
