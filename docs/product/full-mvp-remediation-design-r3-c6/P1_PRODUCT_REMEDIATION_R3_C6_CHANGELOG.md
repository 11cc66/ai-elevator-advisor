# P1 Product Remediation Changelog R3-C6

## 1. Source Identity

- Preserved SOURCE_KEY_R3 framing.
- Confirmed 362-byte maximum.
- Added R6 512-byte BYTES limit and 362-byte SourceKey field limit.
- Added max/max+1 and component boundary tests.

## 2. Selection Provenance

- Added sealed SelectionRun.
- Added immutable full SelectionCandidateResult key.
- Bound product/specification/price/parameter/rule-set revisions.
- Added `selectionResultItemId` to Candidate Basis.
- Added RuleSet ID and digest to Header Basis.

## 3. Price

- Added product/source revision.
- Added price basis, tax, applicability.
- Added valid-from/valid-until and quoted-at.
- Added `basisAsOf` and historical-price semantics.

## 4. Trusted Session

- Added TrustedSession, login epoch, session role, assertion, expiry/revocation.
- Added database-side session checks for every transition.
- Added exact session replay/logout tests.

## 5. Policy

- Added immutable PolicyRevision.
- Added PolicyReviewEvent table, sequence/state/request constraints.
- Added approval authority/author separation.
- Added effective policy view.
- Added current view and DDL-level `source_key_r3`/validation functions.
- Extended privilege matrix to authorization/policy/session objects.

## 6. Validation

- Added real `mutation_version`.
- Added complete header/child/TRUNCATE guards.
- Added deferred validator function and transaction/CAS matrix.

## 7. Basis

- New Registry SNAPSHOT-R3.
- New Protocol R3-BASIS-1-R6.
- New C6-SNAP-01:

```text
15 records
4036 bytes
7D3CAC885F839594006650CC500FEF8A59D22AD151E6CB21567008D0D19519EB
```

## 8. Non-Changes

```text
Source code: NOT MODIFIED
Prisma schema/migrations: NOT MODIFIED
Database/Storage: NOT ACCESSED
Runtime/Build/tests: NOT EXECUTED
Git writes: NONE
Historical C1–C5 bytes: PRESERVED
```

