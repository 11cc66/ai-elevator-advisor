# Canonical Identity Adversarial Review

Date: 2026-11-24

## Current Implementation

The current Prisma models use CUID/Text identifiers:

- Project, Conversation, Message and Requirement IDs are `String` with CUID
  defaults.
- Existing foreign keys are text references.
- No current business table uses native UUID IDs.

## R3-C3 Selection

R3-C3 correctly chooses to retain CUID/Text identity and changes the Basis
record row ID to canonical text. This avoids a repository-wide UUID conversion.

## SourceKey Construction

The declared namespaces are:

```text
assertion:<id>
professional-event:<id>
catalog-evidence:<id>
session-system:<ruleSetRevisionId>:<assertionId>
```

The field IDs are bounded ASCII text/CUID values. The sourceKey is stored as
Text and paired with the typed source FK.

## Finding

The canonical ID grammar permits `:`. The multi-part `session-system` key uses
`:` as a delimiter. A legacy or imported ID containing `:` makes the
sourceKey string non-reversible without typed columns. This is not a
database-source ownership bypass when the typed FK is present, but it is a
real ambiguity for audit reconstruction, parsing and migration tooling.

A second residual issue is that C3 chooses CUID/Text but leaves
`OD-R3-C3-01` open. Until architecture/security accepts that choice, Schema
and Migration remain blocked.

## Required Correction

Choose one:

1. restrict canonical IDs to separator-free CUIDs;
2. length-prefix each sourceKey component;
3. declare sourceKey non-parseable and require typed columns for reverse
   lookup;
4. store namespace and source ID in separate columns.

## Verification

- sourceKey round-trip for colon-bearing legacy IDs;
- uniqueness across namespace/source ID tuples;
- CUID vs UUID rejection;
- migration conflict/quarantine behavior;
- Snapshot sourceKey copy equality.

## Result

```text
CUID/TEXT STRATEGY: APPROVED WITH DEPENDENCY
SOURCEKEY DELIMITER REVERSIBILITY: CORRECTION REQUIRED
```
