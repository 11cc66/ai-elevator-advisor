# Response-Loss Replay Review R5

## Finding

```text
REV-R3-R3-P2-03:
PARTIALLY RESOLVED
```

The vacuous `None == None` comparison was removed, but its replacement still
does not satisfy the authorization's non-hardcoded business-result requirement.

## Actual R5 Implementation

At `tools/validate_r5.py` line 240:

```python
self.ledger[request_id] = "GENERATION:2"
```

The replay method returns the same dictionary value. No value is derived from a
parsed SQL transition, a durable row model, a Generation counter, or a
server-committed result object.

The evidence therefore contains:

```text
request_id:           req-response-loss-001
first_result:         GENERATION:2
replay_result:        GENERATION:2
ledger_rows:          1
business_transitions: 1
event_count:          1
```

The values are non-NULL, but the first result is an injected literal.

## Positive SQL Finding

The final Execute function claims/locks the Request Ledger before current-state
rejection and returns the stored result on replay. A completed request does not
enter a second Generation transition.

This is evidence that the SQL design contains a plausible replay branch. It is
not evidence that the R5 test derives and compares a real first result.

## Independent Negative Result

```text
IND-MUT-22: FAIL
Reason: change to the injected result would only mutate the same hardcoded
fixture; it would not prove the SQL result or Ledger contract.
```

Required correction: derive first execution result from the simulated/parsed
business transition and Ledger, then delete/null/change the Ledger, result,
transition count, Event count and Request identity in separate mutations.

Runtime COMMIT visibility remains `NOT VERIFIED`.

