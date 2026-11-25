# Policy Approval Owner and Authority Matrix R3-C6

| Command | Capability | Object scope | Author rule |
|---|---|---|---|
| Create Draft | `POLICY_AUTHOR` | policy kind / project | author recorded |
| Submit | `POLICY_AUTHOR` | exact policy | author only |
| Approve | `POLICY_APPROVER` | exact policy | actor != author |
| Reject | `POLICY_APPROVER` | exact policy | actor != author |
| Invalidate | `POLICY_SECURITY_ADMIN` | exact policy | independent |
| Expire | `POLICY_LIFECYCLE` | policy validity | event-driven |
| Supersede | `POLICY_APPROVER` | approved policy | actor != original author |

Database ownership:

```text
PolicyRevision table: table_owner
PolicyReviewEvent table: table_owner
Policy transition functions: function_owner
Broker role: session open/revoke only
Reviewer: execute policy transition only
Auditor: read effective/events views
Runtime Web/Worker: no direct policy DML
```

All policy event/view objects are included in the PostgreSQL privilege audit.

