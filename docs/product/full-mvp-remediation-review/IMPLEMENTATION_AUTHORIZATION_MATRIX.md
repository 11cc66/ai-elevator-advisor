# Implementation Authorization Matrix

This matrix is an independent review opinion only. It does not grant implementation authorization.

## Matrix

| Work item | Status | Required predecessor |
|---|---|---|
| P1-3 Upload Attempt/Lifecycle integration | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate P1-3 design and isolated security review |
| P1-3 FileVersion chain-field repair | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate authorization; never merge into product remediation |
| Native RPC / deployment / production file changes | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Separate platform-security gate |
| Requirement conditional/double-negation parser | `DESIGN_CORRECTION_REQUIRED` | Add conditional grammar and test matrix |
| Conversation/requirement scenario DB constraints | `DESIGN_CORRECTION_REQUIRED` | Add project/conversation/requirement scenario composite FKs |
| Requirement field source-of-truth | `DESIGN_CORRECTION_REQUIRED` | Choose canonical representation and equality enforcement |
| Project/head relationship DDL | `DESIGN_CORRECTION_REQUIRED` | Add exact unique key and FK order |
| Requirement CAS/transaction implementation | `BLOCKED_BY_OPEN_DECISION` | Approve conversation/current-head policy and canonical field model |
| Initial conversation atomicity | `DESIGN_CORRECTION_REQUIRED` | Add create transaction and failure test |
| Message idempotency response replay | `DESIGN_CORRECTION_REQUIRED` | Add interaction/response record and contract |
| Same-origin shared mutation wrapper | `BLOCKED_BY_INDEPENDENT_SECURITY_REVIEW` | Route inventory, content-type policy, security regression |
| Sales query SQL scoping | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Implementation authorization and regression review |
| Sales snapshot model | `DESIGN_CORRECTION_REQUIRED` | Normalized immutable payload/items and exact FKs |
| Sales snapshot retention policy | `BLOCKED_BY_OPEN_DECISION` | OD-09 business/legal/security decision |
| Sales assignment identity | `DESIGN_CORRECTION_REQUIRED` | User FK/role/scope model |
| Catalog source model | `DESIGN_CORRECTION_REQUIRED` | Immutable source versions and required digest |
| Catalog review model | `DESIGN_CORRECTION_REQUIRED` | Exact typed subject FKs and review authority |
| Catalog review role/permission | `BLOCKED_BY_OPEN_DECISION` | OD-03 and OD-04 |
| Catalog price semantics | `BLOCKED_BY_OPEN_DECISION` | OD-05 |
| Effective-date resolution | `DESIGN_CORRECTION_REQUIRED` | Define `[from,to)` UTC/as-of and overlap behavior |
| DEMO classification migration | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Add immutable classification DDL and legacy preflight |
| DEMO startup guard | `BLOCKED_BY_OPEN_DECISION` | OD-10 exact identity configuration |
| Legacy VERIFIED/handoff disposition | `BLOCKED_BY_OPEN_DECISION` | OD-12 |
| Selection rule-set model | `DESIGN_CORRECTION_REQUIRED` | Typed review evidence, uniqueness and status transitions |
| Formal OPERATIONAL selection | `BLOCKED_BY_TECHNICAL_AUTHORITY` | OD-01, OD-02, OD-13 and independent security review |
| Running `OPERATIONAL` with invalid price | `DESIGN_CORRECTION_REQUIRED` | Separate technical/commercial status |
| Candidate all-result explanation | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Preserve no-drop invariant in implementation |
| Requirement history read/UI | `DESIGN_CORRECTION_REQUIRED` | Add API and browser test |
| Browser/visual acceptance plan | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Separate browser installation/run authorization |
| Root test infrastructure repair | `DESIGN_CORRECTION_REQUIRED` | Identify exact Vitest resolution fix |
| P1-3 exclusion from product remediation | `DESIGN_APPROVED_FOR_FUTURE_AUTHORIZATION` | Keep exclusion boundary; no implementation merge |

## Future Batch Authorization Candidates

Only after the design corrections are reviewed and accepted:

- non-destructive parser/unit tests;
- UI status copy and confirmation screens;
- sales SQL-scoped query implementation with regression tests;
- browser test harness preparation;
- documentation and traceability updates.

These remain subject to separate implementation authorization.

## Must Be Separately Authorized

- Any Prisma migration or PostgreSQL constraint/trigger.
- Cross-project authorization and ownership constraints.
- Catalog source/review/revision migration.
- Sales handoff snapshot migration.
- Same-origin enforcement across all mutations.
- Enabling formal `OPERATIONAL` results.
- Final database/trigger/COMMIT-unknown verification.

## Must Not Be Merged

```text
P1-3 Upload/Lifecycle/FileVersion work
Native RPC / runtime authority
Production deployment
Production Build Gate exceptions
Real AI provider integration
```

## Final Matrix Conclusion

```text
No P1 product module is currently approved for implementation.
Some design directions and non-source plans are approved for future authorization after corrections.
```

