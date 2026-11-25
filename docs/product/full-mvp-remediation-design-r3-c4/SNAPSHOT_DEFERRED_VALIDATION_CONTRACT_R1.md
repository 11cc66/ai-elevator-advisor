# Snapshot Deferred Validation Contract R1

## 1. Transaction Model

`create_snapshot(snapshot_id...)`:

1. lock the Sales Case row;
2. read exact RequirementVersion, SelectionRun and Registry revision;
3. insert Snapshot Header in `DRAFT`;
4. insert all canonical child rows from immutable selection/catalog evidence;
5. compute R3-BASIS-1 revision 4 bytes from registry rows;
6. set Basis metadata and run validation;
7. set `FINALIZED`;
8. advance the Case pointer;
9. insert audit event;
10. commit.

Only the controlled function can insert child rows. Ordinary roles have no
direct INSERT/UPDATE/DELETE privileges on Snapshot canonical rows.

## 2. Immediate Checks

On insert:

- Snapshot Header IDs are nonempty CUID/Text;
- Registry=`SNAPSHOT-R1`, Protocol=`R3-BASIS-1-R4`;
- child `snapshotId` exists;
- child `stableKey` is nonempty and unique in Snapshot scope;
- field tags are registry-defined and not duplicated;
- scalar type/presence/value combination is valid;
- parent FK values are non-null where required.

## 3. Deferred Checks at COMMIT

The deferred constraint trigger checks:

```text
Header:
  header record exists exactly once
  registryRevision = SNAPSHOT-R1
  protocolRevision = R3-BASIS-1-R4

Records:
  every required candidate for SelectionRun is represented exactly once
  every candidate has parameter/price/source/review evidence required by its
    status
  no child references another Snapshot/Case/Project/Run
  no duplicate (recordType, stableKey)
  no duplicate rowId inside a record type

Source:
  sourceFieldValueId belongs to exact Snapshot RequirementVersion
  sourceKey is the structured identity of the same FieldValue source
  professional source event belongs to exact Requirement/Version/Policy
  catalog evidence revision belongs to exact catalog item/review

Basis:
  each record is represented in canonical field order
  each Record length equals actual frame length
  body length equals sum of records
  SHA-256 equals canonical Basis
```

Any failure aborts the transaction, removes the `DRAFT` Snapshot and child
rows, and prevents Case pointer advancement.

## 4. Constraint Forms

- `DEFERRABLE INITIALLY DEFERRED` FKs are allowed only for first insertion of
  the Header/current-pointer cycle and multi-row child completeness.
- A deferred constraint trigger runs `AFTER INSERT/UPDATE` on child tables and
  verifies the complete Snapshot at `COMMIT`.
- `FINALIZED` is a database-controlled state; `FINALIZED` Snapshot rows are
  immutable.
- A Snapshot cannot be marked `FINALIZED` while any required child is missing.
- A second finalization attempt is rejected by state/version CAS.

## 5. Concurrency

- The Case row lock serializes Snapshot pointer advancement.
- A Snapshot version is unique by `(caseId,versionNumber)`.
- Concurrent creation attempts produce one winner; the loser rolls back or
  obtains a new version only under the approved policy.
- Source withdrawal occurring concurrently with snapshot creation either
  precedes the transaction's exact source read or causes the transaction to
  fail closed; no mixed basis is allowed.

## 6. Immutability

After `FINALIZED`, ordinary roles cannot:

- update or delete Header;
- insert/update/delete any canonical child;
- replace basis metadata;
- change source binding;
- change Registry/Protocol revision.

Only an append-only integrity quarantine record may describe a later mismatch.
