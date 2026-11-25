# Historical Finding Closure Matrix R3-C7

## R3-C4

| Finding | Original Severity | R3-C5 | R3-C6 | R3-C7 | Basis |
|---|---|---|---|---|---|
| `P1-01` stableKey | P1 | RESOLVED | RESOLVED | RESOLVED | C6 vector independently reproduced |
| `P1-02` Basis vector | P1 | RESOLVED | RESOLVED | RESOLVED | independent 4036-byte reconstruction |
| `P1-03` Registry/Schema/Basis | P1 | OPEN | OPEN | NOT RESOLVED | P1-02 completeness |
| `P1-04` actor/state | P1 | OPEN | OPEN | PARTIAL | authority/session path exists but session binding incomplete |
| `P2-01` policy equality | P2 | RESOLVED | RESOLVED | RESOLVED | exact review/event composite FK |
| `P2-02` deferred validation | P2 | OPEN | OPEN | RESOLVED static DDL | trigger table/function coverage present |
| `P2-03` exact FKs | P2 | OPEN | OPEN | NOT RESOLVED | Snapshot Candidate/context content gaps |
| `P2-04` privileges | P2 | OPEN | OPEN | NOT RESOLVED | missing owner/broker grants |
| `P2-05` field order | P2 | RESOLVED | RESOLVED | RESOLVED | deterministic sorting |
| `P2-06` source domain | P2 | RESOLVED | RESOLVED | RESOLVED static | SourceKey rules present; DB NFD mismatch is within-domain P2 |
| `P3-01` wording | P3 | RESOLVED | RESOLVED | RESOLVED | record types correctly described |

```text
R3-C4:
RESOLVED 7/11
PARTIAL 1/11
NOT RESOLVED 3/11
```

## R3-C5 Unresolved

| Finding | Severity | R3-C6 | R3-C7 | Basis |
|---|---|---|---|---|
| `P1-02` provenance | P1 | OPEN | NOT RESOLVED | candidate/child provenance gaps |
| `P1-03` session lifecycle | P1 | OPEN | NOT RESOLVED | shared-role/connection binding fails |
| `P1-04` policy lifecycle | P1 | OPEN | FULLY RESOLVED at core content/event level | digest, immutable revision, append-only event present |
| `P2-02` deferred validation | P2 | OPEN | PARTIAL | full trigger DDL, incomplete completeness checks |
| `P2-04` privileges | P2 | OPEN | NOT RESOLVED | owner/broker execution rights missing |

```text
R3-C5 unresolved:
FULLY RESOLVED 1/5
PARTIAL 2/5
NOT RESOLVED 2/5
```

## R3-C6 Findings

| Finding | R3-C7 Status | Reason |
|---|---|---|
| `REV-R3-C6-P1-01` | NOT RESOLVED | Snapshot Candidate result FK is partial; derived children not content-bound |
| `REV-R3-C6-P1-02` | RESOLVED static | all function bodies/signatures now exist; runtime blocked by P1-04 |
| `REV-R3-C6-P1-03` | RESOLVED at lock-race level | race fixed; session-role/connection binding remains new P1-03 |
| `REV-R3-C6-P1-04` | RESOLVED at content/event level | trusted digest and append-only DDL present |
| `REV-R3-C6-P2-01` | RESOLVED at View-DDL level | all Views complete; session-status caller bug is new P1-06 |
| `REV-R3-C6-P2-02` | RESOLVED | definitions and grants match |
| `REV-R3-C6-P2-03` | RESOLVED | replay lookup precedes stale sequence |
| `REV-R3-C6-P2-04` | RESOLVED | global resource bounds and vectors |
| `REV-R3-C6-P2-05` | RESOLVED offline | 23/23 independent scalar classification |
| `REV-R3-C6-P2-06` | RESOLVED offline | 19/19 SourceKey Node/Python boundary evidence; SQL normalization mismatch is new P2-02 |

```text
R3-C6 P1: RESOLVED 3/4
R3-C6 P2: RESOLVED 6/6
```
