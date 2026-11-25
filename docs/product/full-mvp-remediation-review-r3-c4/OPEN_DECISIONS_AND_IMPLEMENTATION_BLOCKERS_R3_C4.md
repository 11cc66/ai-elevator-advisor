# Open Decisions and Implementation Blockers R3-C4

Date: 2026-11-24

Result:

```text
Open Decisions: OPEN
Implementation authorization: NOT GRANTED
```

## 1. Decision Inventory

Retained and unresolved:

```text
OD-R2-01 OD-R2-02 OD-R2-03 OD-R2-04 OD-R2-05
OD-R2-06 OD-R2-07 OD-R2-08 OD-R2-09 OD-R2-10
OD-R2-11 OD-R2-12 OD-R2-13 OD-R2-14 OD-R2-15
OD-R2-16 OD-R2-17 OD-R2-18 OD-R2-19 OD-R2-20

OD-R3-01 OD-R3-02 OD-R3-03 OD-R3-04 OD-R3-05
OD-R3-06 OD-R3-07 OD-R3-08 OD-R3-09

OD-R3-C2-01 OD-R3-C2-02 OD-R3-C2-03 OD-R3-C2-04
OD-R3-C3-01 OD-R3-C3-02 OD-R3-C3-03 OD-R3-C3-04
OD-R3-C4-01 OD-R3-C4-02 OD-R3-C4-03 OD-R3-C4-04
```

Total: 41.

## 2. Blocker Matrix

| Decision | Nature | Schema/Migration | Data import | Demo/Production |
|---|---|---|---|---|
| R2-01 authoritative engineering rules | Business/technical | no for infrastructure | before approved rule data | yes |
| R2-02 professional authority | Security/business | before review roles/transitions | before professional import | yes |
| R2-03 VERIFIED roles | Security | before approval guards | before verified data | yes |
| R2-04 source content/expiry | Legal/security | before archive columns | yes | yes |
| R2-05 price semantics | Commercial | before price constraints | yes | yes |
| R2-06 scenario changes | Product | before update trigger/API | yes | yes |
| R2-07 project head | Product | before pointer layout | as applicable | yes |
| R2-08 conversation visibility | Security/product | possibly not | no | yes |
| R2-09 snapshot retention | Legal/security | no for append-only | no | before deletion/export |
| R2-10 Demo identity | Security | no | no | before Demo |
| R2-11 effective-version ambiguity | Product/technical | before resolver policy | yes | yes |
| R2-12 legacy disposition | Data/security | migration policy | yes | yes |
| R2-13 rule approval separation | Security | before transition guards | before rules | yes |
| R2-14 canonicalization/hash | Security | before Snapshot digest | yes | yes |
| R2-15 JSON mismatch | Data | migration mapping | yes | yes |
| R2-16 review workflow | Product/security | before workflow | yes | yes |
| R2-17 sales scope | Security | before sales assignment | yes | yes |
| R2-18 source cadence | Product/legal | before expiry fields | yes | yes |
| R2-19 preliminary visibility | Product/security | no | no | yes |
| R2-20 rollout policy | Product/security | no | no | yes |
| R3-01 archive/retention | Security/legal | before evidence columns | yes | yes |
| R3-02 raw vs canonical basis | Legal/technical | before review basis | yes | yes |
| R3-03 review retention | Legal/security | before deletion privileges | yes | yes |
| R3-04 policy continuity | Technical/security | before resolver | yes | yes |
| R3-05 snapshot export/deletion | Legal/business | no for append-only | no | yes |
| R3-06 legacy scenario | Data/product | backfill | yes | yes |
| R3-07 RuleSet authority | Security | before transitions | before rules | yes |
| R3-08 failure replay | Product/security | before replay storage | as applicable | yes |
| R3-09 evidence lost | Legal/security | before recovery workflow | yes | yes |
| C2-01 typed catalogue | Technical | yes | yes | yes |
| C2-02 archive verifier | Security | before archive | yes | yes |
| C2-03 transition ownership | Database/security | before functions | before approval data | yes |
| C2-04 Basis implementation authority | Security/architecture | before Snapshot implementation | yes | yes |
| C3-01 CUID/Text acceptance | Architecture/security | yes | yes | yes |
| C3-02 typed field/units | Technical | yes | yes | yes |
| C3-03 transition function owner | Database/security | yes | before approval events | yes |
| C3-04 archive verifier | Security/legal | yes | yes | yes |
| C4-01 Registry R1 approval | Product/security | yes | yes | yes |
| C4-02 catalogue authority/units | Technical | yes | yes | yes |
| C4-03 event role/function owner | Database/security | yes | before approval events | yes |
| C4-04 registry rollout | Product/security | migration versioning | yes | yes |

## 3. Open Decisions Cannot Waive

- exact FK parent/child column sets;
- collision-safe Registry tuple identity;
- normalized rows sufficient to reconstruct the Basis;
- correct full Basis bytes;
- complete source binding in the digest;
- Event actor/authority binding and transition matrix;
- P1-3 isolation;
- least-privilege database ownership.

## 4. Next Gate

The next gate is a design correction round (`R3-C5`), not implementation.

