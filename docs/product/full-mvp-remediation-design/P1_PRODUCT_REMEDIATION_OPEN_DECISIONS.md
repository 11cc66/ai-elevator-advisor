# P1 Product Remediation Open Decisions

These items must not be filled by inference or implementation convenience. Until decided, the safe default is Preliminary/Insufficient/Denied rather than Operational.

## OD-01 — Authoritative engineering rules

Decision owner: elevator technical lead / authorized professional.

Must define:

- which requirement fields are mandatory for each installation scenario;
- which product fields are mandatory for any technical comparison;
- which rule keys are hard eligibility constraints;
- exact units, comparison semantics and thresholds for approved rules;
- authority source and effective version;
- who approves, changes and retires a rule set.

No numeric threshold is proposed in this design. Existing floor-to-capacity/speed logic must remain non-authoritative.

Implementation while open:

- formal `OPERATIONAL` results disabled;
- Demo results `PRELIMINARY` only;
- missing/unauthorized rules produce `REQUIRES_PROFESSIONAL_REVIEW`.

## OD-02 — Professional engineering data acquisition

Decision owner: technical and product owners.

Must define:

- minimum professionally confirmed building data before technical selection;
- whether shaft, pit, overhead and door data enter through survey measurement only;
- how measured data is linked to requirement versions and selection snapshots;
- who may confirm it.

Until decided, customer-authored requirements cannot be presented as formally verified engineering conditions.

## OD-03 — VERIFIED review authority

Decision owner: product/security/technical leadership.

Must define:

- whether `catalog.review` is a new role or belongs to an existing technical role;
- whether submitter and reviewer must be different people;
- approval stages for manufacturer, brand, product revision, specification and price;
- who can revoke approval;
- whether System Admin has any technical review authority.

Safe default:

- `PRODUCT_ADMIN` submits;
- `SYSTEM_ADMIN` does not approve engineering content;
- self-approval is rejected.

## OD-04 — Source evidence standard

Decision owner: product/technical/legal owners.

Must define:

- acceptable manufacturer official vs authorized vs public sources;
- required evidence for each catalog dimension;
- source content digest and retention requirements;
- review cycle and expiry policy;
- handling of retracted documents.

The design stores source type, locator, digest, validity, review and withdrawal metadata, but does not invent source policy values.

## OD-05 — Price semantics and validity

Decision owner: commercial/product owners.

Must define:

- equipment-only vs installed vs project-total price;
- VAT/tax basis;
- regions, currencies and price units;
- validity period and quote-required behavior;
- whether any price can be shown as customer-visible before sales review.

Safe default:

- no effective approved price means `REQUIRES_QUOTE`;
- no formal budget match from expired/unapproved price;
- no price commitment.

## OD-06 — Project Type changes

Decision owner: product owner.

Recommended policy:

- type is set at project creation;
- reversible only before any conversation exists;
- after any conversation/requirement, use a new project or separately approved migration workflow.

Must decide whether a project can legitimately change from old-building addition to renovation or new-building installation.

## OD-07 — Project current requirement

Decision owner: product owner.

Options:

1. no project-level current requirement; selection always takes a requirement ID;
2. explicit project head updated only by customer action;
3. automatic head update on every confirmation.

Recommended: option 1 for MVP, with option 2 added only if the UI needs it. Option 3 risks recreating cross-conversation ambiguity.

## OD-08 — Conversation sharing

Decision owner: product and customer-success owners.

Must decide:

- whether multiple authorized customer users can see every conversation in a project;
- whether sales can view raw conversations or only confirmed handoff snapshots;
- who can close/reopen/archive a conversation.

Safe default:

- no deletion;
- closed conversation is read-only;
- sales sees only explicit handoff snapshots;
- requirements never share mutable state across conversations.

## OD-09 — Sales handoff retention

Decision owner: business/legal/security owners.

Must define:

- snapshot retention period;
- legal/audit treatment after customer changes;
- whether handoff snapshots are visible to customers;
- retention of sales notes and withdrawn snapshots.

Design default: immutable append-only snapshots with no deletion.

## OD-10 — Demo isolation

Decision owner: engineering/security owner.

Must approve:

- exact demo database/storage identity marker;
- Demo startup configuration names;
- whether Demo runs only with test database role;
- provider allowlist (`MockAIProvider` only);
- how demo mode is displayed.

The client must not select Demo/Formal mode via query or body parameter.

## OD-11 — Active version resolution when no unique version exists

Decision owner: catalog/product owner.

Options:

- block formal selection;
- select latest approved and warn;
- require explicit effective version ID in evaluation input.

Recommended: block formal selection until exactly one effective approved version exists.

## OD-12 — Legacy data disposition

Decision owner: data/security/product owners.

Need approval for:

- existing `VERIFIED` records without review evidence;
- existing spec/price rows with null or contradictory effective dates;
- existing sales handoffs with no requirement/selection IDs;
- existing requirement rows with ambiguous conversation identity.

Recommended safe default:

- mark as `LEGACY_REVIEW_REQUIRED` or `LEGACY_UNSNAPSHOTTED`;
- exclude from formal recommendation;
- require new handoff/review;
- never invent evidence or historical snapshot.

## OD-13 — Rule-set approval separation

Decision owner: technical authority/security.

Must decide:

- whether the same role can create and approve a selection rule set;
- whether rule changes require dual review;
- who can retire/emergency-disable a rule;
- approval cadence and effective dates.

Safe default: creator cannot be the sole approver, and no approved rule set means no Operational result.

## Open-decision effect summary

```text
No engineering threshold: NO OPERATIONAL
No complete critical data: NO OPERATIONAL
No approved source/review: NOT FORMAL ELIGIBLE
No effective price: REQUIRES QUOTE
No explicit requirement/selection snapshot: NO SALES HANDOFF
Ambiguous legacy data: STOP AND REVIEW
```

