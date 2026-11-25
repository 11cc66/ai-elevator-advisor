# P1 Product Remediation Open Decisions R2

These decisions remain outside Codex authority. R2 uses fail-closed defaults
but does not approve any business or engineering value.

## OD-R2-01 — Authoritative engineering rule set

Question: Which requirement fields, product fields, operators, units and
thresholds may affect hard eligibility?

Owner: elevator technical lead / authorized engineering authority.

Options:

1. Formal Operational disabled until a complete approved rule set exists.
2. Approve a limited rule set by installation scenario.
3. Approve scenario-specific rule sets with explicit exclusions and expiry.

Risks: Option 1 prevents formal selection; premature options 2/3 can produce
incorrect engineering conclusions.

Blocked modules: formal Operational, selection rules, professional review.

Can proceed: parser/model-status work, Demo preliminary UI and tests.

Must decide before migration: no for infrastructure; yes before any rule data
that claims approved status.

## OD-R2-02 — Professional data and review authority

Question: Which measured/confirmed fields require a professional source, who
can submit and approve them, and what evidence is required?

Owner: technical authority and security owner.

Options:

1. Technical/survey role separation with explicit approvals.
2. Single authorized professional with audit-only review.
3. External professional evidence with internal approval.

Risks: weak authority makes professional review cosmetic; strict separation may
block small-team operation.

Blocked modules: OPERATIONAL status, professional review workflow, selection
approval.

Can proceed: source data model, status enums and rejection tests.

Must decide before migration: yes for review role table/permission and approval
transition semantics.

## OD-R2-03 — VERIFIED approval roles and source evidence

Question: Who can submit, approve, reject or revoke manufacturer, brand,
product revision, specification and price revisions?

Owner: product/technical/security leadership.

Options:

1. Separate reviewer role and mandated submitter-reviewer separation.
2. Technical lead approval with optional second review.
3. External source evidence plus automated structural checks only.

Risks: self-approval allows mislabeled DEMO/real data; too many approvals stalls
catalog maintenance.

Blocked modules: catalog approval and formal eligibility.

Can proceed: source/revision tables and exact FK design.

Must decide before migration: yes for permission records and approval state
guards.

## OD-R2-04 — Source content and review expiry

Question: What source content is retained, how often is it re-reviewed, and
what happens when a source is withdrawn or changed?

Owner: legal, product and technical owners.

Options:

1. Digest plus immutable source revision; new content always needs new review.
2. Full source snapshot hashed and retained in internal storage.
3. External locator plus digest only, with no content retention.

Risks: digest-only may not prove content to auditors; retaining third-party
content may have licensing/storage implications.

Blocked modules: source review, catalog evidence and formal recommendations.

Can proceed: SourceRevision schema and digest-required tests.

Must decide before migration: yes for content columns/retention policy.

## OD-R2-05 — Price semantics and validity

Question: What do prices represent, which currency/region/tax and scope keys
are authoritative, and when is a price quote-required?

Owner: commercial/product owner.

Options:

1. Equipment price only with separate installation scope.
2. Installed turnkey price.
3. Multiple price types with explicit selection per evaluation.

Risks: mixed price semantics can produce false budget matches.

Blocked modules: commercial status, budget and `REQUIRES_QUOTE`.

Can proceed: separate price dimensions and fail-closed tests.

Must decide before migration: yes for price columns/constraints and UI labels.

## OD-R2-06 — Project Type changes

Question: May a project change scenario after activity begins?

Owner: product owner.

Options:

1. Immutable after any conversation.
2. Allowed before confirmed requirement.
3. Allowed later through new conversation and invalidated recommendations.
4. Create a new project.

Risks: later mutation can mix scenarios and invalidate historical recommendations.

Blocked modules: project update, scenario constraints and selection.

Can proceed: scenario FK and immutable defaults.

Must decide before migration: yes for update trigger/API policy.

## OD-R2-07 — Project current requirement

Question: Does a project have an explicit current requirement pointer, and who
can set it?

Owner: product owner.

Options:

1. No project head; selection uses requirement ID.
2. Explicit user-selected head.
3. Automatic head on latest customer confirmation.

Risks: automatic latest recreates cross-conversation ambiguity.

Blocked modules: project page, selection entry, sales handoff defaults.

Can proceed: conversation pointer and selection by explicit requirement ID.

Must decide before migration: yes for ProjectRequirementHead table/API.

## OD-R2-08 — Conversation sharing and sales visibility

Question: Can multiple authorized users see a conversation, and can sales see
raw conversation history?

Owner: product and customer-success owners.

Options:

1. All project-authorized users can read; sales receives snapshots only.
2. Only conversation creator and admins can read.
3. Explicit sharing grants.

Risks: broad sharing leaks intent/history; narrow sharing breaks collaboration.

Blocked modules: conversation API/UI, sales handoff.

Can proceed: project/resource authorization and snapshot schema.

Must decide before migration: no for schema; yes for exposure policy.

## OD-R2-09 — Sales snapshot retention and visibility

Question: How long are snapshots, notes and revoked/withdrawn snapshots retained,
who may view them, and may they be exported?

Owner: business/legal/security.

Options:

1. Immutable append-only indefinitely.
2. Retention period with legal hold.
3. Customer-visible and sales-visible redacted views.

Risks: deleting history breaks audit; indefinite retention may conflict with
privacy/contracts.

Blocked modules: snapshot deletion/retention and sales UI.

Can proceed: append-only payload/item model and no-delete default.

Must decide before migration: no for append-only schema; yes before any deletion
or purge implementation.

## OD-R2-10 — Demo environment identity

Question: Which exact database, role, marker, storage root and provider identity
define Demo mode?

Owner: engineering/security.

Options:

1. Strict test-only database/role and Mock Provider.
2. Separate demo database with signed marker.
3. Read-only static demo.

Risks: accidentally connecting production data; demo cannot use realistic data.

Blocked modules: Demo startup, demo catalog and demo recommendation.

Can proceed: server-side status model and demo exclusion tests.

Must decide before startup/migration: yes before enabling Demo startup.

## OD-R2-11 — Effective version ambiguity

Question: What happens when multiple approved specifications/prices/rule sets are
effective at the same `asOf`?

Owner: catalog/product/technical owner.

Options:

1. Fail closed.
2. Choose latest approved with warning.
3. Require explicit version ID in input.

Risks: latest silently selects unapproved context; explicit IDs complicate UI.

Blocked modules: formal selection and catalog resolver.

Can proceed: overlap constraints and deterministic error behavior.

Must decide before formal enablement: yes.

## OD-R2-12 — Legacy data disposition

Question: How are legacy VERIFIED, invalid price/spec, JSON/field mismatch and
unsnapshotted handoff rows handled?

Owner: data/security/product.

Options:

1. Quarantine and require re-review/new handoff.
2. Backfill only when deterministic evidence exists.
3. Preserve as read-only historical; never formal.

Risks: guessing alters historical meaning; quarantine blocks existing demos.

Blocked modules: migration and formal query.

Can proceed: preflight/quarantine flags and no-guess tests.

Must decide before backfill: yes.

## OD-R2-13 — Rule-set approval separation

Question: Who creates, approves, retires and emergency-disables a selection rule
set, and is dual review required?

Owner: technical authority/security.

Options:

1. Separate creator and approver.
2. Technical lead plus security review.
3. Emergency disable by technical authority with retroactive audit.

Risks: self-approved rules can become de facto standards; emergency control can
leave evaluations stale.

Blocked modules: rule set approval and formal Operational.

Can proceed: versioned rule tables and rejection tests.

Must decide before rule data: yes.

## OD-R2-14 — Snapshot canonicalization and hash policy

Question: Is RFC 8785 plus SHA-256 accepted, what fields are in the digest, and
what serialization compatibility policy applies?

Owner: security/technical architecture.

Options:

1. RFC 8785 JCS, UTF-8, SHA-256, versioned schema.
2. Another approved canonical JSON profile.
3. Detached signed payload.

Risks: non-canonical serialization yields unstable digests; unsupported changes
break old verification.

Blocked modules: snapshot creation, replay detection and audit verification.

Can proceed: canonical fixture tests and digest interface.

Must decide before snapshot migration: yes.

## OD-R2-15 — Historical JSON/field mismatch migration

Question: What is the disposition when legacy JSON cannot be mapped
unambiguously to normalized fields?

Owner: data/product/security.

Options:

1. Quarantine and require review.
2. Keep legacy JSON as authoritative for that old record only.
3. Reconstruct with customer confirmation.

Risks: any silent choice may produce a false requirement; retaining legacy-only
records can complicate selection.

Blocked modules: migration of legacy requirements.

Can proceed: normalized schema and quarantine tests.

Must decide before backfill: yes.

## OD-R2-16 — Professional review workflow

Question: What evidence, role separation, return/re-submit rules and expiry
policy apply to professional review?

Owner: technical authority/security/product.

Options:

1. One-stage professional approval with reviewer attestation.
2. Two-stage engineer + technical lead approval.
3. External signed report plus internal acceptance.

Risks: state ambiguity and approval inherited across changed evidence.

Blocked modules: professional review API/UI and OPERATIONAL.

Can proceed: state enum, immutable event model and rejection tests.

Must decide before review workflow: yes.

## OD-R2-17 — Sales assignment identity and scope

Question: What entity assigns a handoff to a sales user, and what project/customer
scope applies?

Owner: sales operations/security.

Options:

1. Project-scoped sales role.
2. Customer-scoped sales role.
3. Explicit handoff assignment plus project role.

Risks: broad role can expose other customers; strict assignment can delay follow-up.

Blocked modules: sales assignment and list scope.

Can proceed: FK/unique and denial tests.

Must decide before sales UI: yes.

## OD-R2-18 — Source review cadence

Question: How long does an approved source/revision remain review-valid?

Owner: product/technical/legal.

Options:

1. Indefinite until changed/withdrawn.
2. Fixed periodic re-review.
3. Event-driven re-review on source change/new revision.

Risks: stale evidence accepted or excessive manual review.

Blocked modules: formal catalog trust.

Can proceed: immutable source revisions and expiration fields.

Must decide before source approval: yes.

## OD-R2-19 — Preliminary result visibility

Question: Which users may see preliminary results with missing data, and where
must they be labeled?

Owner: product/technical/security.

Options:

1. Customer sees preliminary only with missing-data checklist.
2. Internal/admin only until data sufficient.
3. Both with role-specific disclaimers.

Risks: preliminary candidates mistaken for operational recommendations.

Blocked modules: customer recommendation UI and sales handoff of preliminary runs.

Can proceed: status model and hidden/blocked test fixture.

Must decide before demo UI: yes.

## OD-R2-20 — Formal rollout policy

Question: Which rules, roles, evidence, pricing and review gates must be approved
before formal `OPERATIONAL` is enabled?

Owner: product/technical/security.

Options:

1. Enable only after every dependency is approved and independently tested.
2. Enable per scenario with separate gates.
3. Keep behavior preliminary-only for MVP.

Risks: a partial gate creates false confidence; too strict blocks value.

Blocked modules: formal selection, sales recommendations and production.

Can proceed: Demo preliminary implementation and non-Operational tests.

Must decide before production: yes.

