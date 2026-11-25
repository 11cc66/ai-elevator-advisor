# Historical Finding Closure Matrix R3-C8 Corrections

## Previous R3-C8 Findings

### P1

| Finding | Status | Independent reason |
|---|---|---|
| `REV-R3-C8-P1-01` price content | RESOLVED STATIC | Full Price fact/digest and exact Selection/Snapshot bindings are present |
| `REV-R3-C8-P1-02` source/review provenance | PARTIAL | Requirement and ProfessionalReview improve; Catalog source-target identity remains open |
| `REV-R3-C8-P1-03` role closure | PARTIAL | Recursive membership/options/direct ACLs exist; protected ownership is accepted |
| `REV-R3-C8-P1-04` bootstrap/CONNECT | PARTIAL | Seed, approvals, root session/Grant and dynamic CONNECT exist; root identity/recovery remain open |

```text
R3-C8 P1: RESOLVED 1/4, PARTIAL 3/4, NOT RESOLVED 0/4
```

### P2

| Finding | Status | Independent reason |
|---|---|---|
| `REV-R3-C8-P2-01` ledger session | PARTIAL | Session/epoch comparison and replay audit exist; original Session revocation is undefined |
| `REV-R3-C8-P2-02` Review TRUNCATE | RESOLVED STATIC | Explicit ProfessionalReview and TrustedSession TRUNCATE guards exist |
| `REV-R3-C8-P2-03` validator overclaim | NOT RESOLVED | The new validator misses root Principal, protected-owner and Catalog source-target invariants |
| `REV-R3-C8-P2-04` Source-Aux | RESOLVED STATIC | Shared validation runs before Seal; Runtime is unverified |

```text
R3-C8 P2: RESOLVED 2/4, PARTIAL 1/4, NOT RESOLVED 1/4
```

### P3

| Finding | Status | Independent reason |
|---|---|---|
| `REV-R3-C8-P3-01` arbitrary overwrite | RESOLVED STATIC | Corrections tools use fixed paths; runner identity remains external |
| `REV-R3-C8-P3-02` Grant revocation | RESOLVED STATIC | Missing/already-revoked targets reject and active scope is uniquely indexed |
| `REV-R3-C8-P3-03` shell misrouting | PARTIAL | Rules/evidence improved, but mismatches recurred and the runner guard is not implemented |

```text
R3-C8 P3: RESOLVED 2/3, PARTIAL 1/3, NOT RESOLVED 0/3
```

## R3-C4

| Finding | Status | Independent reason |
|---|---|---|
| `P1-01` stableKey | RESOLVED | C6/SK-R2 bytes independently reproduced |
| `P1-02` Basis vector | RESOLVED | 4036-byte vector and SHA match |
| `P1-03` Registry/Schema/Basis | NOT RESOLVED | CatalogReview source-to-target binding remains open |
| `P1-04` actor/state | PARTIAL | Role closure improved; database-owner acceptance remains |
| `P2-01` policy equality | RESOLVED | Policy Event/Revision FKs/triggers present |
| `P2-02` deferred validation | RESOLVED STATIC | Trigger coverage present; runtime unverified |
| `P2-03` exact FKs | NOT RESOLVED | FK arity passes, but source-target semantic binding remains incomplete |
| `P2-04` privileges | PARTIAL | Direct Session CONNECT and root bootstrap added; database-owner rejection absent |
| `P2-05` field order | RESOLVED STATIC | C6/R6 vectors pass |
| `P2-06` source domain | RESOLVED STATIC | NFC and SourceKey checks present |
| `P3-01` wording | RESOLVED | terminology retained |

```text
R3-C4: RESOLVED 7/11, PARTIAL 1/11, NOT RESOLVED 3/11
```

## R3-C5

| Finding | Status | Independent reason |
|---|---|---|
| `P1-02` provenance | PARTIAL | Price/Review chains improved; Catalog source-target gap remains |
| `P1-03` session lifecycle | PARTIAL | backend/session binding exists; role-owner closure gap remains |
| `P1-04` policy lifecycle | RESOLVED STATIC | digest/event/pointer tables present |
| `P2-02` deferred validation | PARTIAL | triggers exist; semantic source gap remains |
| `P2-04` privileges | PARTIAL | bootstrap/CONNECT added; database ownership not rejected |

```text
R3-C5: RESOLVED 1/5, PARTIAL 4/5, NOT RESOLVED 0/5
```

## R3-C6

```text
R3-C6 P1:
RESOLVED 3/4
PARTIAL 0/4
NOT RESOLVED 1/4

R3-C6 P2:
RESOLVED 6/6
PARTIAL 0/6
NOT RESOLVED 0/6
```

The unresolved C6 P1 is provenance: new source chains improve the model, but
CatalogReview source-to-target identity is not independently closed.

## R3-C7

```text
INDEPENDENTLY RESOLVED: 7/13
PARTIAL: 6/13
NOT RESOLVED: 0/13
```

| Finding | Status |
|---|---|
| `P1-01` candidate binding | RESOLVED STATIC |
| `P1-02` child/source completeness | PARTIAL — Catalog source-target gap |
| `P1-03` session binding | PARTIAL — owner closure gap |
| `P1-04` privilege graph | PARTIAL — database-owner acceptance remains |
| `P1-05` creation path | PARTIAL — automatic bootstrap recovery gap |
| `P1-06` status view | RESOLVED STATIC |
| `P2-01` R6 parity | RESOLVED STATIC |
| `P2-02` SourceKey NFC | RESOLVED STATIC |
| `P2-03` replay | PARTIAL — original revoked Session semantics unclear |
| `P2-04` AuthorityGrant | PARTIAL — bootstrap Principal mismatch |
| `P2-05` Policy lifecycle | RESOLVED STATIC |
| `P2-06` truncate | RESOLVED STATIC |
| `P3-01` duplicate assignment | RESOLVED |

## Corrections Findings

The prior Corrections P1s are not independently closed:

- `REV-R3-C8-CORRECTIONS-P1-01` root Principal binding: NOT RESOLVED.
- `REV-R3-C8-CORRECTIONS-P1-02` database owner closure: NOT RESOLVED.
- `REV-R3-C8-CORRECTIONS-P1-03` Catalog source-target: NOT RESOLVED.

The design remains `DESIGN-ADDRESSED` in the other areas, but no design PASS is
promoted to historical `RESOLVED` without independent evidence.
