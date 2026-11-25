# Open Decisions Disposition R3-C8

## Classification

All 57 existing decisions remain `PRESENT / OPEN`; none is approved by this
document. The tables below expand every identifier instead of treating a
family range as an individual disposition.

`Proposed` text is a non-binding design recommendation for the named owner. It
is not an approval, default, or implementation authorization.

## R2 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R2-01` | Authoritative engineering rules | Disable formal Operational, approve a limited set, or approve scenario rules with exclusions/expiry; affects hard eligibility and review | Business / engineering authority | Start fail-closed and approve rules by scenario only with explicit exclusions | Formal Operational and approved rule data |
| `OD-R2-02` | Professional data and review authority | Role separation, single professional, or external evidence with internal approval; affects who may create authoritative facts | Security / business | Define submitter/reviewer separation and evidence per field | Professional review permissions |
| `OD-R2-03` | VERIFIED approval roles and evidence | Separated reviewer, technical lead, or external evidence; affects catalog trust and self-approval | Security / product | Require proposer/approver separation for VERIFIED transitions | Catalog approval and formal eligibility |
| `OD-R2-04` | Source content and review expiry | Digest plus immutable revision, full archived snapshot, or locator plus digest; affects auditability and retention cost | Operations / legal / security | Preserve immutable bytes/digest and require re-review after change | Source evidence and catalog review |
| `OD-R2-05` | Price semantics and validity | Equipment-only, turnkey, or typed price families; affects budget matching and quote state | Business / commercial | Separate price type, tax, region, currency, and validity dimensions | Price schema and formal quotation |
| `OD-R2-06` | Project Type changes | Immutable, editable before confirmation, versioned later, or new project; affects historical scenario integrity | Product | Version scenario changes and invalidate downstream selections | Project mutation and scenario backfill |
| `OD-R2-07` | Project current requirement | No head, explicit head, or automatic latest head; affects selection ambiguity | Product | Use an explicit versioned head and never infer across conversations | Project UI and selection entry |
| `OD-R2-08` | Conversation sharing and sales visibility | All project roles, creator/admin only, or explicit grants; affects raw-intent disclosure | Security / product | Default to explicit project-scoped access and snapshots for sales | Conversation and sales APIs |
| `OD-R2-09` | Sales snapshot retention and visibility | Immutable forever, retention/legal hold, or redacted views; affects privacy and audit history | Legal / security | Keep append-only by default and defer deletion until approved policy | Export, deletion, and purge |
| `OD-R2-10` | Demo environment identity | Test-only, signed demo DB, or static demo; affects accidental production exposure | Security / deployment | Require exact database, role, marker, root, and mock-provider proof | Demo startup |
| `OD-R2-11` | Effective-version ambiguity | Fail closed, latest-with-warning, or explicit version; affects reproducibility | Product / data | Fail closed on multiple effective versions | Formal resolver |
| `OD-R2-12` | Legacy data disposition | Quarantine, evidence-backed backfill, or read-only history; affects migration truth | Data / security | Quarantine ambiguous records and never guess | Migration and formal query |
| `OD-R2-13` | Rule-set approval separation | Creator/approver split, technical/security review, or emergency disable; affects rule authority | Security / engineering | Require independent approval and audited emergency disable | Rule activation |
| `OD-R2-14` | Snapshot canonicalization and hash | RFC 8785 JCS/SHA-256, another canonical profile, or signed payload; affects digest stability | Security / data | Keep the approved versioned canonical profile and test compatibility | Snapshot and export |
| `OD-R2-15` | Historical JSON/field mismatch | Quarantine, legacy JSON authority, or customer reconstruction; affects requirement correctness | Data / product | Quarantine and require explicit source-backed repair | Requirement backfill |
| `OD-R2-16` | Professional review workflow | One-stage, two-stage, or external signed report; affects approval validity | Business / security | Define explicit state/evidence rules before enabling review | Professional workflow |
| `OD-R2-17` | Sales assignment identity and scope | Project, customer, or explicit handoff scope; affects cross-project exposure | Security / sales operations | Bind assignment to exact project and active user | Sales assignment and lists |
| `OD-R2-18` | Source review cadence | Indefinite, periodic, or event-driven; affects stale evidence acceptance | Product / legal | Require event-driven re-review and an approved maximum age | Formal catalog trust |
| `OD-R2-19` | Preliminary result visibility | Customer with checklist, internal only, or role-specific disclaimers; affects misuse of incomplete results | Product / security | Keep preliminary results visibly non-operational and scope by role | Customer recommendation UI |
| `OD-R2-20` | Formal rollout policy | All gates, per-scenario gates, or preliminary-only MVP; affects production release | Product / security | Keep preliminary-only until every dependency is independently accepted | Production Operational |

## R3 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R3-01` | Catalog evidence archive and retention | Domain archive, bounded DB bytes plus archive, or external signed artifact; affects evidence availability and encryption | Database security / operations | Choose write-once content-addressed storage with explicit retention and recovery | Source archive schema |
| `OD-R3-02` | Raw bytes versus canonical text | Raw authority, text authority, or dual basis; affects review reproducibility | Data / legal | Make both required and digest-bound when both exist | Review-basis contract |
| `OD-R3-03` | Professional event retention and resubmission | Indefinite, legal hold, or limited history; affects audit and resubmission | Legal / security | Retain append-only history; disposition only through approved policy | Review retention and deletion |
| `OD-R3-04` | Review policy change continuity | No carryover, declared compatibility, or expiry; affects stale authority | Business / security | Default to no automatic carryover | Effective-policy review resolver |
| `OD-R3-05` | Snapshot export, deletion, and retention | Immutable, retention/hold, or redacted views; affects export and privacy | Legal / product | Keep immutable append-only history pending approved export/retention policy | Snapshot export or purge |
| `OD-R3-06` | Unmappable historical scenario | Quarantine, new project, or legacy-only; affects safe migration | Data / product | Quarantine and require an explicit repair record | Legacy mapping |
| `OD-R3-07` | Rule-set creator and approver authority | Separation, lead/security, or emergency retire; affects rule approval | Security / engineering | Reuse independent approval and audited emergency controls | RuleSet transitions |
| `OD-R3-08` | Persisted advisor failure and replay visibility | Typed code, full response, or no persistence; affects exact retry and disclosure | Product / security | Store safe typed outcomes and response digests | Failure replay |
| `OD-R3-09` | Evidence unavailable or lost | Invalidate, quarantine, or replace evidence with new review; affects trust recovery | Legal / security | Quarantine until independent recovery; never silently replace | Evidence recovery |

## R3-C2 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R3-C2-01` | Typed field catalogue and units | Minimal scalar, broader types, or scenario catalogues; affects typed facts and parser rules | Data model / engineering | Start with a minimal closed catalogue and version extensions | Typed value DDL |
| `OD-R3-C2-02` | Evidence verifier identity and archive ownership | Separate verifier, independent DB owner, or external signed service; affects self-verification risk | Security / deployment | Separate evidence verification from catalog editing identity | Archive adapter and verification |
| `OD-R3-C2-03` | Database transition-function ownership | SECURITY DEFINER owner, invoker plus grants, or isolated transition service; affects event-only enforcement | Database security | Use fixed-path owner functions with non-login deployment and no runtime DML | Transition functions |
| `OD-R3-C2-04` | Snapshot basis implementation authority | App generator plus SQL verifier, inverse split, or separate verifier; affects circularity | Data security / architecture | Use independently deployed generator and verifier with fixed vectors | Snapshot implementation |

## R3-C3 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R3-C3-01` | Canonical Text/CUID identity | Retain CUID/Text or perform an identity migration; affects keys and imports | Core data model | Retain only if the owner accepts the exact text-key and collation policy | Schema and data import |
| `OD-R3-C3-02` | Typed field catalogue and units | Minimal, extended, or scenario catalogue; affects authoritative business values | Business / data | Resolve through the technical authority before typed activation | Typed catalogue import |
| `OD-R3-C3-03` | Transition ownership and grants | Owner functions, invoker grants, or transition service; affects privilege bypass resistance | Database security | Require exact fixed-path owner, schema USAGE, and function-only runtime | Function deployment |
| `OD-R3-C3-04` | Evidence archive and verifier | Archive adapter, verifier identity, encryption, retention, and hold; affects evidence trust | Operations / security | Combine with C2 evidence ownership and retention approval | Source evidence |

## R3-C4 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R3-C4-01` | Snapshot Registry R1 approval | Accept, revise, or postpone; affects Basis coverage and Snapshot schema | Product / security | Independently review the exact registry before activation | Snapshot schema |
| `OD-R3-C4-02` | Typed catalogue authority and units | Minimal, extended, or scenario catalogue; affects field semantics | Business / data | Keep unresolved until the technical authority approves exact values | Typed field activation |
| `OD-R3-C4-03` | Event transition role and function owner | SECURITY DEFINER, invoker, or isolated service; affects approval enforcement | Database security | Approve exact owner, fixed search path, EXECUTE, and audit roles | Transition creation |
| `OD-R3-C4-04` | Snapshot registry/version rollout | Registry per snapshot, dual-read migration, or archive; affects old-snapshot verification | Deployment / data | Prefer immutable registry version bound into each snapshot | Production rollout |

## R3-C5 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R3-C5-01` | Trusted identity broker and session binding | Broker, assertion, audience, expiry, revocation, login role, and pool topology; affects all authority | Security / deployment | Require a broker assertion fully bound to one session-role registry and backend | Principal/session deployment |
| `OD-R3-C5-02` | Snapshot-R2 / Basis-R5 rollout | Choose a migration window preserving older versions; affects historical compatibility | Deployment / data | Use explicit version dispatch and reversible offline evidence | Snapshot migration |
| `OD-R3-C5-03` | SourceKey R3 storage derivation | CHECK against immutable function, stored column, or Basis-time reconstruction; affects equality and cost | Core data model / database | Prefer one canonical persisted derivation with deterministic SQL parity | SourceKey DDL |
| `OD-R3-C5-04` | Reviewer/approver separation policy | Single or mandatory dual approval; affects professional authority | Business / security | Require self-approval denial; owner selects one- or two-stage approval | Professional review |
| `OD-R3-C5-05` | Database owner break-glass | Reauthentication, notification, expiration, and evidence; affects emergency privilege | Security / operations | Require time-bound reauthenticated break-glass with independent evidence | Production roles |

## R3-C6 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R3-C6-01` | Session assertion and broker mechanism | Issuer, signature, keys, audience, nonce, role authentication, and HA; affects forgery resistance | Security / deployment | Adopt a versioned signed assertion with rotation and replay registry | Session and transition deployment |
| `OD-R3-C6-02` | Registry R3 / Basis R6 rollout | Approve version coexistence and migration; affects Snapshot compatibility | Deployment / data | Keep C6-SNAP-01 bytes immutable and dispatch by explicit version | Snapshot migration |
| `OD-R3-C6-03` | Price provenance and validity | Price basis/scope, validity, historical/current behavior, timezone; affects quote correctness | Business / product | Keep historical prices immutable and require explicit effective-time selection | Price import and quotation |
| `OD-R3-C6-04` | Session role provisioning and topology | Unique DB login per session and whether login invalidates prior epochs; affects copied credentials | Security / operations | Require per-session role registration and backend identity; prohibit shared pools | Production Session deployment |
| `OD-R3-C6-05` | Policy approval split and effective process | Author/approver roles, dual approval, validity, supersession, emergency invalidation; affects Policy authority | Security / governance | Separate author and approver and bind approval to exact digest | Policy Event implementation |

## R3-C7 Decisions

| ID | Decision | Options and effect | Classification | Proposed disposition, not approved | Implementation blocker |
|---|---|---|---|---|---|
| `OD-R3-C7-01` | Function ownership and deployment identities | Choose non-login owner, deployment principal, grants, rotation; affects privilege closure | Database security / deployment | Use separate table/function owners and fixed-path controlled functions | Schema and migration |
| `OD-R3-C7-02` | PostgreSQL JSON canonicalization/version | Pin a canonicalization behavior and upgrade policy; affects Policy and Basis digests | Database / security | Pin supported PostgreSQL major versions and fixed canonicalization tests | Policy and snapshot activation |
| `OD-R3-C7-03` | Basis resource budget | Approve 16 MiB, 4096 records, and 65536 fields or alter limits; affects capacity and wire safety | Product / database | Keep the proposed fail-closed bounds until owner approval | Basis implementation |
| `OD-R3-C7-04` | Lock timeout, deadlock retry, long transaction | Approve limits and retry classes; affects availability and correctness | Operations / database | Approve finite lock/transaction limits and retry only classified transient errors | Production concurrency |
| `OD-R3-C7-05` | Capability-to-View grants and break-glass audit | Choose capability groups and emergency audit access; affects cross-principal confidentiality | Security | Use subject-scoped capability functions and time-bound, evidenced break-glass | View deployment |
| `OD-R3-C7-06` | Evidence retention/export and archive ownership | Choose retention, export, ownership, and legal hold; affects audit and privacy | Legal / operations / security | Keep append-only evidence until approved disposition exists | Evidence retention/export |

## Classified Totals

| Family | IDs | Count | State | Effect |
|---|---|---:|---|---|
| R2 business/security/rollout | `OD-R2-01..20` | 20 | OPEN | blocks corresponding product work |
| R3 archive/review/evidence | `OD-R3-01..09` | 9 | OPEN | blocks evidence and archive activation |
| R3-C2 database/vector authority | `OD-R3-C2-01..04` | 4 | OPEN | blocks schema authority |
| R3-C3 identity/catalogue/transition/archive | `OD-R3-C3-01..04` | 4 | OPEN | blocks catalogue and transitions |
| R3-C4 registry/catalogue/event/rollout | `OD-R3-C4-01..04` | 4 | OPEN | blocks migration and production |
| R3-C5 identity/basis/review/break-glass | `OD-R3-C5-01..05` | 5 | OPEN | blocks identity deployment and Basis rollout |
| R3-C6 session/registry/price/role/policy | `OD-R3-C6-01..05` | 5 | OPEN | blocks Session and Snapshot implementation |
| R3-C7 function/basis/view/retention | `OD-R3-C7-01..06` | 6 | OPEN | blocks deployment and retention activation |
| **Total** | | **57** | **57 OPEN** | **0 approved** |

## Proposed Technical Designs, Not Approvals

The C8 design proposes:

- one-time activation token and backend binding;
- a command request ledger;
- exact source-row digests;
- session-bound AuthorityGrants;
- capability-only runtime roles;
- complete business creation APIs.

These are `PROPOSED DESIGN`, not owner approvals.

## Blocking Decisions

The following remain hard implementation blockers:

- actual identity broker and assertion format;
- database credential/role provisioning and cleanup;
- connection pool/transaction pool prohibition or approved alternative;
- policy author/approver and effective-policy ownership;
- price validity and historical price policy;
- Basis resource budget approval;
- retention/export of audit evidence;
- deployment role ownership and break-glass procedure.

No Open Decision is silently converted to a default or approval.
