# R3-C8 Corrections R3 Finding Traceability

All statuses are `RESOLVED — DESIGN` only; PostgreSQL execution is unverified.

## P1

| ID | R2 failure | R3 correction | DDL objects | Tests | Status |
|---|---|---|---|---|---|
| `R2-P1-01` Bootstrap recovery structure | invalid `root_session_id`; mutable Lifecycle history; immediate generation order | historical FKs use immutable Generation; valid `session_id`; deferrable State/Lifecycle FK; issuance attempt | Generation, Approval, Root Session, Lifecycle, issuance attempt | FK matrix, 8 root mutations, recovery failure matrix | RESOLVED — DESIGN |
| `R2-P1-02` Catalog FKs | non-unique Binding targets; missing Professional candidate | Source FK uses Source PK; Event FK uses Binding PK + binding-copy trigger; Professional candidate columns/triggers | Binding, Event, Selection/Snapshot Professional | exact FK targets, 9 catalog mutations | RESOLVED — DESIGN |
| `R2-P1-03` PUBLIC EXECUTE | new definer helpers omitted from final revoke | final all-function/all-routine PUBLIC revoke after all definitions, then explicit grants | app/app_private function ACL | ACL mutation matrix | RESOLVED — DESIGN |

## P2

| ID | R2 failure | R3 correction | Status |
|---|---|---|---|
| `R2-P2-01` Recovery duplicates/idempotency | multiple recovery instances; terminal check before replay | one recovery per Request; approval/execute claim replay first | RESOLVED — DESIGN |
| `R2-P2-02` Bootstrap replay/interruption | old Generation lookup before claim; no failed issuance recovery | request-first claims; expiry/deny; failed-issuance LOCKED path | RESOLVED — DESIGN |
| `R2-P2-03` Owner lock mismatch | documentation claimed absent lock | `pg_advisory_xact_lock` implemented | RESOLVED — DESIGN |
| `R2-P2-04` Principal ACTIVE | no completion recheck | Root/Approver ACTIVE checks under lock | RESOLVED — DESIGN |
| `R2-P2-05` Catalog actor Grant | single Grant ID | exact Session/Grant/Principal composite FK | RESOLVED — DESIGN |
| `R2-P2-06` Validator gaps | text-only marker checker | structural FK/column/key/ACL/state checks plus 29 mutations | RESOLVED — DESIGN |

## P3

| ID | R2 failure | R3 correction | Status |
|---|---|---|---|
| `R2-P3-01` timestamp/state invariants | incomplete state/timestamp checks | named checks for Generation, Root Session, bootstrap recovery and result recovery | RESOLVED — DESIGN |
| `R2-P3-02` Guard evidence | no child outcome | R3 launcher records exit code and finish time | RESOLVED — DESIGN |

## Boundaries

No item is `INDEPENDENTLY VERIFIED`. Each awaits separate review and real
PostgreSQL validation.
