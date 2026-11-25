# Historical Finding Closure Matrix R3-C8

## Rules

- `RESOLVED` means the original design defect is independently closed by static
  design evidence in this review.
- `PARTIAL` means the main design mechanism exists but a directly related
  invariant remains incomplete.
- `NOT RESOLVED` means the original attack/counterexample still has a plausible
  executable path.
- PostgreSQL compilation, Catalog, trigger, ACL and concurrency behavior remain
  `NOT VERIFIED` without database authorization.

## R3-C4

| Finding | Original issue | C8 evidence reviewed | Independent status | Reason |
|---|---|---|---|---|
| `P1-01` stableKey | Ambiguous colon tuple | SK-R2 length-prefixed tuple | `RESOLVED` | Independent C6 vector and tuple encoding pass |
| `P1-02` Basis vector | Delivered bytes/hash disagreed | C6-SNAP-01 rebuilt independently | `RESOLVED` | 15 records, 4036 bytes, exact SHA-256 |
| `P1-03` Registry/Schema/Basis | Basis rows could omit/misbind facts | C8 source/child design | `NOT RESOLVED` | Price content and several source IDs remain unbound; see `REV-R3-C8-P1-01/P1-02` |
| `P1-04` actor/state | Caller could forge actor/transition | Session-bound grant and transition functions | `PARTIAL` | Session binding improved, but role closure and clean bootstrap are incomplete |
| `P2-01` policy equality | Review/event policy mismatch | Composite pointer and event FKs/triggers | `RESOLVED` | Policy/revision/event relations are explicitly constrained |
| `P2-02` deferred validation | Trigger coverage absent | 12 deferred constraint triggers | `RESOLVED STATIC` | Every Snapshot state table has commit-time dispatch; semantic gaps are separately tracked |
| `P2-03` exact FKs | Snapshot parent/source FKs only prose | 64 FKs parsed; all target keys exact | `NOT RESOLVED` | Parent FK mechanics pass, but source-chain IDs in sealed rows remain uncovered |
| `P2-04` privileges | Bypass surfaces omitted | Role matrix and final grants | `NOT RESOLVED` | Session CONNECT and root Grant bootstrap are incomplete; indirect membership closure is unchecked |
| `P2-05` field order | Registry/protocol disagreed | Independent sorting/tag checks | `RESOLVED STATIC` | C6 and scalar vectors pass |
| `P2-06` source domain | ASCII and Unicode domains conflicted | Separate ASCII and UTF-8 handling | `RESOLVED STATIC` | SourceKey NFC and 362-byte checks present |
| `P3-01` wording | “Nine” versus ten record types | Both Registry and tests use ten | `RESOLVED` | Terminology corrected |

```text
R3-C4:
RESOLVED 7/11
PARTIAL 1/11
NOT RESOLVED 3/11
```

## R3-C5

| Finding | C8 evidence reviewed | Independent status | Reason |
|---|---|---|---|
| `P1-02` provenance | Source/child digests and sets | `NOT RESOLVED` | Snapshot rows match sealed rows, but sealed rows can contain unbound Price/Review/Catalog/Requirement source facts |
| `P1-03` session lifecycle | Session role, backend, token, epoch | `PARTIAL` | Instance binding is designed, but database role closure and login CONNECT path are incomplete |
| `P1-04` policy lifecycle | Digest, immutable revision/event, current pointer | `RESOLVED` | Core content/event/pointer design is internally constrained |
| `P2-02` deferred validation | 12 deferred state-table triggers and set checks | `PARTIAL` | Trigger coverage is complete for listed Snapshot tables; price/source semantic checks are not |
| `P2-04` privileges | Role/owner/function grants | `NOT RESOLVED` | No clean bootstrap or session CONNECT path; role closure not fully validated |

```text
R3-C5:
RESOLVED 1/5
PARTIAL 2/5
NOT RESOLVED 2/5
```

## R3-C6

### P1

| Finding | C8 evidence reviewed | Independent status | Reason |
|---|---|---|---|
| `REV-R3-C6-P1-01` | Header/run/candidate root FKs and Snapshot digests | `NOT RESOLVED` | Candidate binding is fixed, but Price and source/review facts remain unbound |
| `REV-R3-C6-P1-02` | Complete function bodies and Registry | `RESOLVED STATIC` | 78 functions have definitions, owners and known call targets |
| `REV-R3-C6-P1-03` | Share locks and final session recheck | `RESOLVED STATIC` | Transition holds shared Session/Epoch locks; revoke uses update locks |
| `REV-R3-C6-P1-04` | Trusted policy digest and append-only events | `RESOLVED STATIC` | Digest computed internally; revision/event mutations guarded |

```text
R3-C6 P1:
RESOLVED 3/4
PARTIAL 0/4
NOT RESOLVED 1/4
```

### P2

| Finding | Independent status | Reason |
|---|---|---|
| `REV-R3-C6-P2-01` | `RESOLVED STATIC` | Status/audit/policy/read views are defined with authority-bound predicates |
| `REV-R3-C6-P2-02` | `RESOLVED STATIC` | DDL/Registry signatures and owners match in the independent parse |
| `REV-R3-C6-P2-03` | `RESOLVED STATIC` | Transition replay precedes stale-sequence rejection; new ledger session issue is separate |
| `REV-R3-C6-P2-04` | `RESOLVED STATIC` | 4096/65536/16 MiB/16777244 bounds are present and vectors pass |
| `REV-R3-C6-P2-05` | `RESOLVED OFFLINE` | 23/23 independent scalar vectors pass |
| `REV-R3-C6-P2-06` | `RESOLVED OFFLINE` | SourceKey boundary and NFC design agree in Node/Python/static SQL review |

```text
R3-C6 P2:
RESOLVED 6/6
PARTIAL 0/6
NOT RESOLVED 0/6
```

## R3-C7

| C7 Finding | Independent status | Basis |
|---|---|---|
| `REV-R3-C7-P1-01` | `RESOLVED STATIC` | Full result digest FK and exact candidate context key are present |
| `REV-R3-C7-P1-02` | `NOT RESOLVED` | Price business values and multiple authoritative source IDs can still be forged; see C8 P1-01/P1-02 |
| `REV-R3-C7-P1-03` | `PARTIAL` | Backend/token/GUC binding exists; role-attribute and recursive privilege closure do not |
| `REV-R3-C7-P1-04` | `NOT RESOLVED` | Owner/broker schema usage added, but session CONNECT and root Grant bootstrap remain absent |
| `REV-R3-C7-P1-05` | `NOT RESOLVED` | Functions exist, but the clean-database path is blocked by the circular grant bootstrap and missing prerequisites |
| `REV-R3-C7-P1-06` | `RESOLVED STATIC` | Status View uses active caller context and subject-scoped audit authority |
| `REV-R3-C7-P2-01` | `RESOLVED STATIC` | Exact header map, tuple arity and 18-digit Decimal checks are present |
| `REV-R3-C7-P2-02` | `RESOLVED STATIC` | SQL applies NFC before SourceKey encoding |
| `REV-R3-C7-P2-03` | `PARTIAL` | Request ledger exists, but stored `session_id` is not compared on replay |
| `REV-R3-C7-P2-04` | `PARTIAL` | Recipient/subject separation is fixed; bootstrap and role-closure gaps remain |
| `REV-R3-C7-P2-05` | `RESOLVED STATIC` | Closed state checks and composite Policy pointer FKs/triggers are present |
| `REV-R3-C7-P2-06` | `PARTIAL` | Selection/Snapshot/Policy guards exist; `professional_review` current state lacks a direct truncate guard |
| `REV-R3-C7-P3-01` | `RESOLVED` | Duplicate `v_content` assignment is absent |

```text
R3-C7:
RESOLVED 6/13
PARTIAL 4/13
NOT RESOLVED 3/13
```

## Conclusion

The C8 mechanism substantially improves the previous design, but it does not
close all historical P1/P2 provenance and privilege-chain issues. The review
therefore cannot advance to an implementation-readiness gate.
