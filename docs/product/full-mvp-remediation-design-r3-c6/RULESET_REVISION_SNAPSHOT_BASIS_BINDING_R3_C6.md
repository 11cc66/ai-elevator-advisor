# RuleSet Revision Snapshot/Basis Binding R3-C6

## 1. Identity

```text
RuleSetRevision
  id
  contentDigest
  status event-only
  immutable content columns
```

`SelectionRun` binds exact RuleSet ID and digest.

## 2. Header Basis Fields

`SNAPSHOT-R3` Header includes:

| Tag | Field |
|---:|---|
| 8 | selectionRunId |
| 9 | ruleSetRevisionId |
| 10 | ruleSetContentDigest |
| 11 | basisAsOf |

Thus RuleSet identity and digest are actually serialized. The Crosswalk no longer
claims an absent field.

## 3. Exact FK

```text
Snapshot(selectionRunId,ruleSetRevisionId,ruleSetContentDigest)
-> SelectionRun(id,ruleSetRevisionId,ruleSetContentDigest)
```

Each Snapshot Candidate's ruleSetRevisionId must also equal the sealed
SelectionRun's value through its exact SelectionCandidateResult FK.

## 4. Immutability

RuleSet revision content is event-only immutable. A new rule set creates a new
revision. Existing Run/Snapshot references are never rewritten.

## 5. Rejections

- Snapshot RuleSet differs from Run RuleSet;
- content digest differs from the exact revision;
- unapproved RuleSet;
- replacement of finalized RuleSet content;
- Candidate references another RuleSet;
- RuleSet field omitted from Basis.

