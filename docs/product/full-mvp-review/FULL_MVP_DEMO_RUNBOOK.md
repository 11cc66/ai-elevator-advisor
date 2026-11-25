# Full MVP Demo Runbook

Current approval status:

```text
NOT APPROVED FOR EXECUTION
```

This runbook is a preparation document only. It does not create or authorize a database, browser environment, Worker, Storage, deployment or demo session.

## 1. Blocking defects to resolve first

The following must be fixed and independently re-reviewed before normal Demo approval:

1. `"外装不允许"` currently becomes `externalInstallationAllowed=true`.
2. Multiple conversations share project-global requirement state.
3. Requirement scenario can differ from project scenario.
4. `VERIFIED` products can retain a demo source and appear operational.
5. Selection can recommend a product with missing critical travel/shaft/pit/overhead fields.

Do not hide these defects with scripted narration.

## 2. Environment prerequisites

- A separately approved isolated demo/test database whose identity has been verified by the existing test database guard.
- Test-only Worker entry.
- Mock AI only.
- `DEMO_MOCK` products only.
- No production `DATABASE_URL`, real customer data or real Storage root.
- Pinned Playwright browser version installed in a separately authorized environment.
- A clean migration result from an empty isolated database.
- Confirmation that no existing Web/Worker process can reach the demo database.

The operator must not print or place credentials in the runbook, screenshots, terminal transcript or report.

## 3. Required accounts and roles

Use disposable test accounts:

| Role | Required permission profile |
|---|---|
| Admin | global customer/project read and manage; catalog manage; sales/audit visibility |
| Customer | global project creation only; project-scoped advisor, requirement, selection and handoff creation |
| Sales A | assigned to Demo project A only; project-scoped sales manage |
| Sales B/negative | not assigned to Demo project A; used only for denial checks |

The customer account must not have global project read.

## 4. Demo fixtures

Use clearly fictional records:

### Customer

```text
DEMO 演示客户
Data classification: DEMO_MOCK
```

### Old-building project

```text
用途：住宅
楼层：8
层高：3 m
预算：40-50 万
外装：可以考虑
```

### New-building project

```text
用途：学校
楼层：12
层高：3 m
预算：45-55 万
外装：可以考虑
图纸状态：有图纸，尚未解析
```

### Renovation project

Until MVP-R-01 is fixed, do not make a negative external-installation claim in the chat. If the demo must proceed under explicit warning:

- use positive or unspecified external language in chat;
- manually set the external condition through the structured form;
- call out that this is a temporary workaround and not a passing test.

After MVP-R-01 is fixed, use:

```text
用途：办公
楼层：10
层高：3.5 m
预算：60-70 万
外装：不允许
原有电梯：载重 800 kg，现状待专业核实
改造目标：更新与改善
```

## 5. Pre-demo checklist

- Confirm only Mock AI and `DEMO_MOCK` labels are visible.
- Confirm no file upload step is included.
- Confirm the test database guard is the only database target.
- Confirm no real customer data appears.
- Confirm price labels say reference/DEMO and not quotation.
- Confirm professional survey and engineering-review disclaimers are visible.
- Confirm the selected customer has more than one project.
- Confirm Sales A is assigned only to Demo project A.

## 6. Scenario A — Old-building addition

1. Sign in as Customer.
2. Create an old-building project.
3. Start a Mock AI conversation.
4. Enter the old-building requirement.
5. Show structured fields and missing-field state.
6. Correct one ordinary field in the structured form.
7. Save and show the incremented requirement version.
8. Confirm the requirement.
9. Run preliminary selection.
10. Show:
    - recommendation;
    - budget assessment;
    - matching reasons;
    - DEMO classification;
    - professional review warning;
    - site survey warning.

Expected result: the current P1-02 restriction requires only one conversation in this project.

## 7. Scenario B — New-building installation

1. Create a new-building project.
2. Start one Mock AI conversation.
3. Enter the new-building requirement.
4. Show drawing state as `AVAILABLE_NOT_ANALYZED`.
5. Verify the UI explicitly states that drawing parsing is not connected.
6. Confirm the requirement and run selection.

Do not claim that drawing contents were recognized.

## 8. Scenario C — Existing-elevator renovation

1. Create a renovation project.
2. Start one conversation.
3. Capture original elevator condition and renovation goal.
4. Follow the temporary external-installation restriction in section 4.
5. Manually review every structured condition before confirmation.
6. Run preliminary selection.

Do not describe the result as a formal renovation design.

## 9. Requirement modification

1. Change a customer-stated value, such as floor count or budget.
2. Save through the structured form.
3. Show that a new version is created.
4. Show that missing fields are recalculated.
5. Confirm only after the visible values are correct.

Do not imply that customer confirmation is professional engineering confirmation.

## 10. Recommendation comparison

Show:

- primary and alternative candidates;
- budget category;
- capacity/speed;
- floor/travel values;
- source/version labels;
- warnings.

State that absent constraints and unapproved derived targets are known review findings until fixed.

Do not present “OPERATIONAL” as production-approved.

## 11. Admin catalog management

1. Sign in as Admin.
2. Show the existing DEMO catalog.
3. Create one new `DEMO_MOCK` product using clearly fictional manufacturer/brand/model.
4. Edit the product to create a new specification/price version.
5. Show the audit entry.

Do not change the product to `VERIFIED` during the current unremediated demo.

## 12. Sales handoff

1. As Customer, create the sales handoff for Demo project A.
2. Sign out.
3. Sign in as Sales A.
4. Show only authorized handoff details:
   - project;
   - customer requirement;
   - latest displayed selection;
   - budget concern;
   - follow-up notes.
5. Add a DEMO follow-up note.
6. State that the handoff currently uses latest project state, not an immutable snapshot.

The system must not create a formal quotation or contract.

## 13. Negative authorization checks

Optionally show without exposing unnecessary data:

- unauthenticated protected API returns 401;
- Customer B cannot read Customer A's project;
- Sales B cannot update an unassigned handoff;
- customer cannot access product-management API.

## 14. Required viewer disclosures

Say explicitly:

- the AI is deterministic Mock AI, not a real model;
- products and prices are fictional `DEMO_MOCK`;
- results are preliminary;
- the customer cannot confirm professional engineering data;
- site survey, structural review and technical approval remain mandatory;
- no real files, quotes, contracts or production data are involved;
- current review status is `NOT DEMO-READY` until P1 remediation is complete.

## 15. Failure handling

If any of the following occurs, stop the demo:

- structured external condition differs from entered meaning;
- wrong project or conversation data appears;
- a product loses its DEMO label;
- a recommendation contains missing critical engineering parameters;
- database identity cannot be proven;
- any real Storage or customer data path appears;
- browser console shows an unexplained security or data error.

Do not edit the database, disable a security gate, switch to a real provider or conceal the failure.

## 16. Post-demo evidence

Record:

- Git branch/HEAD and clean-of-new-source-change status;
- test database identity result;
- exact MVP test command and summary;
- screenshots only if approved and free of secrets;
- observed defects with request IDs;
- confirmation that no real AI/Storage/Native/PFR operation occurred.

