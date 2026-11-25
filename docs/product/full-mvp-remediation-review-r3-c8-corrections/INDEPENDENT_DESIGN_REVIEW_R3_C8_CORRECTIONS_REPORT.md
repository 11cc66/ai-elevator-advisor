# FULL-MVP-REMEDIATION-REVIEW-R3-C8-CORRECTIONS

Date: 2026-11-24

Review mode: independent, read-only, adversarial.

## 1. Final Result

```text
FULL-MVP-REMEDIATION-REVIEW-R3-C8-CORRECTIONS

Overall: FAIL — DESIGN CORRECTIONS REQUIRED

P0: 0
P1: 3
P2: 3
P3: 2

Previous R3-C8 P1:
INDEPENDENTLY RESOLVED 1/4
PARTIAL 3/4
NOT RESOLVED 0/4

Previous R3-C8 P2:
INDEPENDENTLY RESOLVED 2/4
PARTIAL 1/4
NOT RESOLVED 1/4

Previous R3-C8 P3:
INDEPENDENTLY RESOLVED 2/3
PARTIAL 1/3
NOT RESOLVED 0/3

R3-C7 Findings:
INDEPENDENTLY RESOLVED 7/13
PARTIAL 6/13
NOT RESOLVED 0/13

R3-C4 Historical:
RESOLVED 7/11
PARTIAL 1/11
NOT RESOLVED 3/11

R3-C5 Historical:
RESOLVED 1/5
PARTIAL 4/5
NOT RESOLVED 0/5

R3-C6 P1:
RESOLVED 3/4
PARTIAL 0/4
NOT RESOLVED 1/4

R3-C6 P2:
RESOLVED 6/6
PARTIAL 0/6
NOT RESOLVED 0/6

Open Decisions:
INDEPENDENTLY REVIEWED 57/57
APPROVED BY USER: 0
STILL OPEN: 57
IMPLEMENTATION BLOCKERS: 57

Price Fact Provenance:
PASS STATIC — DATABASE EXECUTION NOT VERIFIED

Requirement/CatalogReview/ProfessionalReview:
PARTIAL — REQUIREMENT AND PROFESSIONAL REVIEW IMPROVED;
CATALOG SOURCE-TO-TARGET IDENTITY UNRESOLVED

Session Role Privilege Closure:
PARTIAL — DATABASE/PROTECTED-OBJECT OWNER CLOSURE UNRESOLVED

AUTHORITY_ISSUE Bootstrap:
PARTIAL — ROOT PRINCIPAL BINDING AND RECOVERY UNRESOLVED

Dynamic LOGIN / Database CONNECT:
PARTIAL STATIC — CONNECT PATH EXISTS; PRIVILEGE CLOSURE UNRESOLVED

Request Ledger Session Semantics:
PARTIAL — ORIGINAL REVOKED SESSION SEMANTICS UNRESOLVED

ProfessionalReview TRUNCATE:
PASS STATIC — POSTGRESQL EXECUTION NOT VERIFIED

Selection Source-Aux Pre-Seal:
PASS STATIC — CONCURRENCY NOT VERIFIED

Validator Coverage:
PARTIAL — SELF-VALIDATOR MISSES THREE P1-CLASS DESIGN INVARIANTS

Mutation Testing:
13/13 INDEPENDENT TARGETED MUTATIONS DETECTED;
SELF-VALIDATOR COVERAGE STILL INCOMPLETE

Main DDL / Final-State Overlay:
PASS STATIC STRUCTURE — 58 TABLES, 87 FK DECLARATIONS,
118 FUNCTIONS, 137 TRIGGERS, 26 ROLES;
POSTGRESQL PARSE/COMPILE/CATALOG NOT VERIFIED

Function Registry:
PARTIAL STATIC — INVENTORY MATCHES; CATALOG AND FULL OWNER/CALL
SEMANTICS NOT VERIFIED

Role / Owner / Grant:
PARTIAL — OWNER CLOSURE AND ROOT PRINCIPAL BINDING REMAIN

C6-SNAP-01:
PASS OFFLINE — 15 RECORDS / 4036 BYTES /
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB

PostgreSQL Grammar:
NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER

PostgreSQL Compilation:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Catalog Introspection:
NOT VERIFIED — DATABASE NOT AUTHORIZED

Runtime Concurrency:
NOT VERIFIED — RUNTIME NOT AUTHORIZED

Database:
NOT ACCESSED

Storage:
NOT ACCESSED

Runtime:
NOT EXECUTED

Production:
NOT AUTHORIZED

Git Writes:
NONE
```

The corrections materially improve the C8 design. Price content is now present
in the authoritative fact and digest chain; Requirement and ProfessionalReview
are tied to more authoritative rows/events; the bootstrap and direct CONNECT
paths exist; Request Ledger epochs and replay audit exist; explicit
ProfessionalReview and TrustedSession TRUNCATE guards exist; Source-Aux is
validated before Seal.

The package cannot pass because a valid root role can complete bootstrap for a
different Principal, database/protected-object ownership is not rejected, and a
valid CatalogSourceRevision can still be paired with an unrelated review target.

## 2. Skills Actually Read

The complete local Skill bodies, references and interface metadata were read:

- `$project-architecture`: `.agents/skills/project-architecture/SKILL.md` and
  `references/architecture-review.md`.
- `$prisma-db-safety`: `.agents/skills/prisma-db-safety/SKILL.md` and
  `references/database-change-review.md`.
- `$security-audit`: `.agents/skills/security-audit/SKILL.md` and
  `references/adversarial-review.md`.
- `$testing-and-verification`: `.agents/skills/testing-and-verification/SKILL.md`
  and `references/verification-matrix.md`.
- `$file-lifecycle`: `.agents/skills/file-lifecycle/SKILL.md` and
  `references/lifecycle-review.md`.

Applied rules included:

- module and data-owner boundaries, plus explicit separation of implemented,
  planned and unverified behavior;
- exact composite FKs, roles/ACL closure, row locking, unique constraints,
  append-only guards and commit-unknown discipline;
- adversarial caller-controlled identity, replay and privilege escalation;
- evidence separation between static text checks, PostgreSQL grammar,
  compilation, Catalog and Runtime;
- fail-closed file/storage boundaries and no access to real Storage.

No task-relevant Skill was unavailable.

## 3. Input Integrity

All independently recomputed input-manifest hashes match:

```text
R3-C8 Corrections:
Path: docs/product/full-mvp-remediation-design-r3-c8-corrections/SHA256SUMS_R3_C8_CORRECTIONS.txt
Bytes: 4391
Lines: 24
SHA-256: 0ACBBB3A4CB5F0439302E7F7109F0ECFDCFDE50843D74941E232F830ECE552A2
Records: 24
Unique paths: 24
Actual files including manifest: 25
Hash/byte/line mismatches: 0
Coverage differences: 0

R3-C8 design manifest:
672D6206D06E4282F7C8684A3811654EEDDA72E52C55B6EDF2C324B5C131E853

R3-C8 review manifest:
2E895560FB3EDEEE938395E2626D0ECBE4939EA18D4A4A573FE159960E1BE611

R3-C7 design manifest:
160A2BB8F93F473063225A2DBE04C8F807E456E1B50C4DF0D82B861B84BF3094

R3-C7 review manifest:
5254758B8B47AEBB8E591CBB380F371398EE59035D48D239D02331E09FFCC118
```

The complete Corrections design, DDL, overlay, registry, role matrix, open
decisions, acceptance matrix, traceability, changelog, Evidence and three Tools
were read. No Corrections generator, registry builder or validator was executed.

## 4. Independent Evidence

The independent checker did not import or execute any Corrections Tool:

```text
Reviewer:
docs/product/full-mvp-remediation-review-r3-c8-corrections/evidence/independent_verify.py

Result:
docs/product/full-mvp-remediation-review-r3-c8-corrections/evidence/INDEPENDENT_REVIEW_EVIDENCE_R3_C8_CORRECTIONS.json

Independent checks: 32 PASS / 37
Failed checks:
  catalog_source_target_binding
  database_owner_rejected
  protected_owner_closure_rejected
  bootstrap_root_principal_binding
  bootstrap_recovery

Targeted mutation fixtures: 13/13 detected as new failures
Foreign-key declaration count: 87
Foreign-key arity errors: 0
Tables: 58
Functions: 118
Triggers: 137
Roles: 26
```

Mutation detection was based on failure checks that appeared relative to the
unchanged baseline. This avoids the prior flaw where already-failing baseline
checks made every mutation appear detected.

The independently reproduced historical vectors remain:

```text
C6-SNAP-01:
15 records
4036 bytes
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB

R6 vectors:
23/23 scalar vectors
14/14 resource vectors
```

## 5. P1 Findings

### REV-R3-C8-CORRECTIONS-P1-01

`bootstrap_complete_root_r3` verifies that `session_user` is an enabled `ROOT`
operator and validates the root token, but never requires
`rootop.principal_id = st.root_principal_id`. The TrustedSession and
AUTHORITY_ISSUE Grant are then inserted for `st.root_principal_id`.

Counterexample: register root role R for Principal A, set bootstrap state to
Principal B, and authenticate R with the state token. R receives a root
session/Grant for B.

Status: `FAIL`, blocks next gate.

### REV-R3-C8-CORRECTIONS-P1-02

`validate_session_role_r3` recursively checks membership and direct ACLs but
uses database ACL only to require CONNECT. It does not reject
`pg_database.datdba = v_role`, and it does not reject protected schema,
relation or function ownership.

Counterexample: a session role with the exact expected memberships and direct
CONNECT is also made database owner or owner of a protected object. The
membership closure remains clean while owner-derived authority remains
available.

Status: `FAIL`, blocks next gate.

### REV-R3-C8-CORRECTIONS-P1-03

`catalog_review_event_r3.source_revision_id` has an ordinary FK to
`catalog_source_revision(id)`. `catalog_source_revision` does not identify its
Product/Specification/Price target, and the event has no source-target binding
digest or authoritative relation.

Counterexample: cite a valid source revision for Product A while reviewing
Product B. All source and target FKs pass and the event digest is internally
consistent.

Status: `FAIL`, blocks next gate.

Full attack paths, affected objects, impact and acceptance criteria are in
`INDEPENDENT_REVIEW_R3_C8_CORRECTIONS_FINDINGS.md`.

## 6. P2 Findings

- `REV-R3-C8-CORRECTIONS-P2-01`: after bootstrap reaches `COMPLETE`, a lost
  root response has no controlled recovery or rotation state machine. The root
  session/Grant expire, while completion retry is rejected.
- `REV-R3-C8-CORRECTIONS-P2-02`: cross-Session Request Ledger replay checks the
  current epoch and logs replay, but does not inspect whether the original
  Session was revoked. The result is deterministic in code but its authorization
  meaning is undefined.
- `REV-R3-C8-CORRECTIONS-P2-03`: the Corrections validator reports `28/28` and
  `13/13` while missing the root Principal, protected-owner and Catalog
  source-target invariants. Its result is a partial static lint, not a design
  proof.

These are non-blocking only for the current static review and must be settled
before Runtime.

## 7. P3 Findings

- `REV-R3-C8-CORRECTIONS-P3-01`: Requirement FieldValue `value_type`, `unit`
  and `field_status` domains are weaker than Selection/Snapshot domains.
- `REV-R3-C8-CORRECTIONS-P3-02`: tooling paths are now fixed and less dangerous,
  but the runner-level shell/process identity guard remains external. This
  review itself again demonstrated silent shell-routing mistakes.

## 8. Four End-to-End Chains

### Price Fact Provenance

`PASS STATIC`: the authoritative Price fact includes amount, currency, price
basis, tax basis, applicability, validity, quoted time, unit and quantity
conditions. The canonical digest covers those fields. Selection and Snapshot
Price rows copy the fact and use exact composite identity/digest FKs.

Runtime proof of trigger ordering and PostgreSQL SHA-256 behavior remains
`NOT VERIFIED`.

### Requirement / CatalogReview / ProfessionalReview

`PARTIAL`:

- Requirement Assertion/FieldValue now have authoritative context, digest and
  append-only controls; Selection copies the authoritative rows.
- ProfessionalReview now derives target, result, decision view, basis digest
  and occurrence time from an immutable event.
- CatalogReview is incomplete because a source revision can be combined with an
  unrelated Product/Specification/Price target.

### Trusted Role / Bootstrap / CONNECT

`PARTIAL`:

- seed, two distinct approvals, root issuer, first Grant, dynamic LOGIN
  CONNECT, membership-option checks and recursive closure exist;
- root operator Principal mismatch and database/protected-object ownership
  remain open;
- lost-response recovery remains external prose.

### Selection Source-Aux / Snapshot

`PASS STATIC`: `seal_selection_run` calls the shared source-aux validator before
result-count, digest and Seal work. Snapshot remains a second independent check.
Concurrent insert/update/delete behavior and trigger ordering are
`NOT VERIFIED`.

## 9. DDL, Registry, Roles and Grants

The independent static inventory matches the claimed object counts:

```text
Tables: 58
FK declarations: 87
Function names: 118
Triggers: 137
Roles: 26
```

The complete DDL is the C8 baseline followed by the Corrections overlay. The
overlay alone is not represented as a standalone complete DDL.

Positive static controls include:

- exact composite FK declarations with no source/target arity errors;
- fixed function owners and `pg_catalog`-first search paths in the reviewed
  function bodies;
- append-only and TRUNCATE guards for the relevant event/history tables;
- a partial unique index for one active AuthorityGrant scope;
- revocation checks for missing and already-revoked Grant targets;
- no direct base-table privilege design for Session roles.

The following cannot be claimed:

- PostgreSQL parser acceptance;
- successful DDL compilation;
- real Catalog/ACL inheritance;
- trigger order, CASCADE, RLS or concurrency behavior;
- complete owner closure or function call graph from Catalog.

## 10. Historical Closure Matrix

The independent matrix is in
`HISTORICAL_FINDING_CLOSURE_MATRIX_R3_C8_CORRECTIONS.md`.

Key corrections from the previous matrix:

- R3-C5 is `1 RESOLVED / 4 PARTIAL / 0 NOT RESOLVED`: mechanisms now exist, but
  Catalog identity, owner closure, bootstrap identity/recovery and ledger
  revocation semantics remain.
- R3-C7 is `7 RESOLVED / 6 PARTIAL / 0 NOT RESOLVED`: explicit
  ProfessionalReview and TrustedSession TRUNCATE guards close C7 P2-06 at the
  static-design layer.
- No historical finding is promoted to `RESOLVED` merely because the
  Corrections claims `DESIGN-ADDRESSED`.

## 11. Open Decisions

```text
Original Open Decisions: 57
Independently Reviewed: 57/57
Approved by User: 0
Still OPEN: 57
Implementation Blockers: 57
Cross-Cutting Blockers: 8
```

All original IDs and meanings are retained. Technical mechanisms do not approve
identity-broker topology, deployment ownership, reviewer authority, price
policy, evidence retention, break-glass access or production rollout.

The itemized review is in `OPEN_DECISIONS_REVIEW_R3_C8_CORRECTIONS.md`.

## 12. Shell and Side-Effect Evidence

Accepted commands ran in:

```text
PowerShell: 7.6.9
PSEdition: Core
PID at verification: 15252
Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
FileVersion: 7.6.9.500
Parent: codex.exe
Working directory: D:\thinkbook\Desktop\jieya
```

Several read-only commands were nonetheless sent with the Bash execution mode
and actually reached CMD or otherwise failed before the intended read. Their
output was not used. All accepted evidence was rerun in verified PowerShell.
Exact known commands and failure stages are recorded in
`evidence/SHELL_AND_EXECUTION_EVIDENCE_R3_C8_CORRECTIONS_REVIEW.md`.

No input design file, source, IDL, Prisma Schema, Migration, Package, lockfile,
database, Storage, PFR, ACL, Service or Runtime was modified. No Corrections
Tool was executed. No Git write was performed.

## 13. Git Snapshot

Review-start snapshot:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Untracked files with -uall: 673
Staged: 0
Deleted: 0
Status lines: 112
```

The final snapshot and exact review-directory file list are recorded in
`evidence/SUMMARY_R3_C8_CORRECTIONS_REVIEW.json`. The expected untracked-file
delta is limited to files changed or added under this review directory.

`$null` existence was checked only, without content access or hashing:

```text
$null       EXISTS
$null()     DOES NOT EXIST
$null'      DOES NOT EXIST
```

## 14. Remaining Unknowns and Required Corrections

Remaining unknowns:

- PostgreSQL grammar and DDL compilation;
- actual Catalog relation keys, function signatures, owners and grants;
- SECURITY DEFINER behavior and fixed search-path execution;
- trigger order, deferred checks, CASCADE and TRUNCATE behavior;
- role changes during an active transaction;
- concurrent Request Ledger, Seal and event processing;
- bootstrap recovery after a lost response or expired root authority;
- original-Session revocation policy for cross-Session replay.

Required design corrections:

1. bind root operator, bootstrap root Principal, TrustedSession and root Grant
   with equality checks and an audited one-time recovery/rotation path;
2. reject database, schema, relation, sequence and function ownership in the
   Session role closure on every request;
3. bind CatalogSourceRevision to Product/Specification/Price target identity
   using an immutable relation or shared digest and enforce it in events and
   Snapshot verification;
4. define original revoked-Session behavior for Request Ledger replay;
5. extend the self-validator and mutation fixtures for those invariants.

## 15. Stop State

This review does not authorize R3-C9, Schema, Prisma, Migration, database access,
build, Runtime, Storage, deployment or production. The Corrections must receive
another separately authorized design-correction round before a new independent
review.
