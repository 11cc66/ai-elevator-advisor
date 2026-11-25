# Validator Mutation Coverage R5

## Executed Offline Suites

| Suite | Result |
|---|---|
| R3 formal mutations | 29/29 detected |
| R2 historical mutations | 12/12 detected |
| R4 semantic mutations | 46/46 detected |
| Independent negative rules | 22/22 detected |
| State vectors | 5/5 pass |

Mutation detection means changing the R5 final source causes its named semantic
check to fail. It does not mean PostgreSQL executed the mutation.

## Replaced R4 Cases

The R4 mutation IDs remain canonical. R5 adapts only the implementation target
where R4's unsafe body no longer exists:

| ID | R5 target |
|---|---|
| `R4-TX-01/02/04/05/07/08/09` | terminalization helper |
| `R4-TX-03` | Approve terminalization call |
| `R4-REC-01` | Begin calls current-Root gate |
| `R4-CAND-05` | controlled Candidate `SET` |
| `R4-CAND-06` | final NULL preflight |
| `R4-CAND-07/08` | sealed and snapshot Candidate-only exceptions |
| `R4-CAND-11` | controlled function source freeze |
| `R4-ACL-01` | completion grant in final tail |

All other R4 IDs retain their original semantics.

## IND-MUT-10/20/21/22

```text
IND-MUT-10 current Root Execute recheck:            DETECTED
IND-MUT-20 expired active Attempt replacement:      DETECTED
IND-MUT-21 Candidate per-row durable audit:         DETECTED
IND-MUT-22 non-vacuous response-loss replay:        DETECTED
```

`IND-MUT-22` uses `request_id=req-response-loss-001`,
`first_result=GENERATION:2`, `replay_result=GENERATION:2`, one Ledger row, one
business transition and one Event.

## Fail-Closed Conditions

Validator fails when:

- an input Manifest/key hash changes;
- a required source/function/table disappears;
- a mutation is not detected;
- a state vector contains a NULL replay result;
- a Candidate range or contribution ID is missing;
- final ACL differs from the R4 capability map;
- public function execution is reintroduced;
- required R5 documents are missing.

## Verification Boundary

```text
Static parsing:          COMPLETED
State simulation:        COMPLETED
PostgreSQL grammar:      NOT VERIFIED
PostgreSQL compilation:  NOT VERIFIED
Catalog introspection:   NOT VERIFIED
Trigger/constraint run:  NOT VERIFIED
Runtime concurrency:     NOT VERIFIED
```

