# FULL-MVP-REMEDIATION-REVIEW-R3-C8-CORRECTIONS-R3

Date: 2026-11-25

## Overall

```text
Overall: FAIL — DESIGN CORRECTIONS REQUIRED
P0: 0
P1: 0
P2: 3
P3: 1
```

R3 closes the five R2 invalid FK structures, the missed PUBLIC revoke and the
main Result Recovery replay defects. It remains incomplete because approval
expiry writes `LOCKED` and then raises in the same transaction, rolling the
state back; one Recovery per Generation also prevents a new recovery from a
denied or locked Generation. The R3 Validator does not detect either issue.

## Input Integrity

```text
R3 Manifest SHA-256:
C5611B8807D50E3E02286A63B5C9E39F9F745684793C2FD5525DCA4537A71825

Records: 28
Unique paths: 28
Actual files including manifest: 29
Mismatches: 0
Coverage differences: 0
```

Core hashes match:

```text
Main design:
D7D96DEEDDB4AC3BE7E25ED72ADBC00DA878A7F3685F8B2E6CD4B267C60C4F0F

Complete DDL:
C899D5F7C433F6936617033E76161FB0D33ACED85B6CFF004073FB0B012C67ED

Overlay:
8EC1CE0F6174225629F1A8EDD88CF7CDB77C0D296F6E3002C9418D5D655E4CEB

Registry:
CC08248DABE2B4301D05A3D14F93374F0E6913F572F6A0FB24A1EC584874A56E
```

## Independent Object Results

```text
Tables:                    72
FK declarations:          123
Unique function names:    153
Registry signatures:      154
Triggers:                 174
Roles:                     26
FK structure errors:        0
Trigger target errors:      0
```

The 153/154 difference is the retained `bootstrap_complete_root_r3` overload.

Confirmed corrections:

- Bootstrap history references immutable Generation.
- Lifecycle Generation FK is deferrable.
- Catalog Source/Event FKs use real primary keys.
- Catalog Binding triggers copy and verify source/target facts.
- ProfessionalReview candidate triggers exist.
- Final PUBLIC function/routine REVOKE follows all function definitions.
- Result Recovery is unique per original Request.
- Approval/Execution replay occurs before terminal state.
- Owner advisory lock is implemented.
- Root/Approver ACTIVE checks exist.
- C6-SNAP-01 remains 15 records / 4036 bytes with the expected SHA.

## Findings

### P2-01 Approval Expiry State Is Rolled Back

Overlay lines 690-697 and 778-785 update Recovery/Lifecycle to `LOCKED`, then
immediately raise an exception. PL/pgSQL exceptions roll back the transaction,
so `LOCKED` is not durably recorded.

### P2-02 Denied/Locked Generation Cannot Start Another Recovery

`bootstrap_recovery_one_per_generation_r3` allows one recovery per
`(bootstrap_id,from_generation)`. A denied recovery remains on that Generation.
The Begin function accepts `LOCKED`, but inserting a new recovery for the same
Generation violates the unique constraint.

### P2-03 Validator Misses Transaction/State-Persistence Defects

The submitted Validator reports 29/29 formal and 12/12 historical mutations, but
does not test exception rollback of the expiry branch or whether one recovery
per Generation prevents a documented recovery from DENIED/LOCKED.

### P3-01 ProfessionalReview Candidate Columns Are Nullable

The two added `candidate_id` columns are populated by trigger but are not
declared `NOT NULL`. A trusted path with trigger bypass could insert NULL and
evade the composite candidate FK.

## Open Decisions

```text
Original IDs: 57
Present and unique: 57/57
Approved by User: 0
Still OPEN: 57
```

Root approval ownership, credential custody, emergency authority, role
provisioning and break-glass remain implementation blockers.

## Verification Boundaries

```text
Static Structural Review: COMPLETED
PostgreSQL Grammar: NOT VERIFIED — NO COMPATIBLE OFFLINE PARSER
PostgreSQL Compilation: NOT VERIFIED — DATABASE NOT AUTHORIZED
Catalog Introspection: NOT VERIFIED — DATABASE NOT AUTHORIZED
Runtime Concurrency: NOT VERIFIED — RUNTIME NOT AUTHORIZED
Database: NOT ACCESSED
Storage: NOT ACCESSED
Runtime: NOT EXECUTED
Production: NOT AUTHORIZED
Git Writes: NONE
```

## Decision

`FAIL — DESIGN CORRECTIONS REQUIRED`

Only separately authorized R3-C8 Corrections R4 design work may follow.
