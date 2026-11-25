# Open Decisions and Implementation Blockers R3-C7

## Decision Preservation

```text
Historical: 46 PRESENT / 46 OPEN
R3-C6:       5 PRESENT /  5 OPEN
R3-C7:       6 PRESENT /  6 OPEN
Total:      57 PRESENT / 57 OPEN
```

All C6 identifiers remain unchanged and explicitly listed in the R3-C7 Open
Decisions file.

## R3-C7 Decisions

| ID | Decision | State |
|---|---|---|
| `OD-R3-C7-01` | function ownership/deployment identity | OPEN |
| `OD-R3-C7-02` | PostgreSQL JSON canonicalization/version | OPEN |
| `OD-R3-C7-03` | 16 MiB/4096-record/65536-field budget | OPEN |
| `OD-R3-C7-04` | lock timeout/deadlock retry/long transaction | OPEN |
| `OD-R3-C7-05` | View grants/break-glass audit access | OPEN |
| `OD-R3-C7-06` | evidence retention/export/archive ownership | OPEN |

No approval evidence exists.

## Implementation Blockers

| Area | Status |
|---|---|
| Snapshot provenance | BLOCKED by P1-01/P1-02 |
| Function execution | BLOCKED by P1-04 |
| Session identity | BLOCKED by P1-03 |
| Selection/Professional create path | BLOCKED by P1-05 |
| Session audit View | BLOCKED by P1-06 |
| SQL R6 encoder equivalence | BLOCKED by P2-01/P2-02 |
| Retry/idempotency | BLOCKED by P2-03 |
| Policy authority evidence | BLOCKED by P2-04/P2-05 |
| Selection evidence truncation | BLOCKED by P2-06 |

An R3-C8 design correction stage is required. This review does not authorize it.
