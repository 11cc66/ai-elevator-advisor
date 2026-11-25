# Policy Review Event Schema and Transitions R3-C6

## 1. Transition Function

The complete function body is defined in
`POLICY_TRANSITION_DDL_R3_C6.md`. No arbitrary `new_state` parameter exists.

## 2. Event Invariants

- current state = latest event under row lock;
- expected sequence/state version must match;
- command must map from current state;
- actor is derived from active TrustedSession;
- AuthorityGrant must match POLICY_APPROVER/POLICY_AUTHOR and
  policy content/project scope;
- author cannot approve own policy;
- policy content digest must match;
- request replay with same hash returns prior event;
- changed hash conflicts;
- one immutable event per sequence/state/request;
- UPDATE/DELETE/TRUNCATE unavailable.

## 3. Audit

Every event includes actor principal, authority grant, request ID/hash, decision,
reason and timestamp. No caller-provided actor/authority values are trusted.

