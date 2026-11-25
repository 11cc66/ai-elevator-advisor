# Full MVP Build

Task:

```text
FULL-MVP-BUILD-001
```

Date:

```text
2026-11-23
```

Final product status:

```text
MVP COMPLETE — DEMO-READY
```

Scope delivered:

- deterministic Mock AI advisor;
- multi-turn requirement collection and revision history;
- old-building addition, existing-elevator renovation and new-building installation scenarios;
- versioned DEMO_MOCK catalog management;
- deterministic, explainable preliminary selection;
- customer project, recommendation and product-catalog pages;
- project-scoped customer and sales authorization;
- sales handoff and follow-up notes;
- product-change audit records;
- isolated test-database migration and acceptance tests.

Explicitly outside this Demo-Ready delivery:

- real external AI calls;
- real vendor data;
- real customer files or private Storage operations;
- drawing recognition;
- formal engineering approval;
- formal quotation or contract;
- production deployment and production Build Gate approval.

## Documents

- [MVP_IMPLEMENTATION_STATUS.md](MVP_IMPLEMENTATION_STATUS.md)
- [MVP_ACCEPTANCE_MATRIX.md](MVP_ACCEPTANCE_MATRIX.md)
- [MVP_KNOWN_LIMITATIONS.md](MVP_KNOWN_LIMITATIONS.md)
- [MVP_ACCEPTANCE_REPORT.md](MVP_ACCEPTANCE_REPORT.md)
- [SHA256SUMS.txt](SHA256SUMS.txt)

## Safe local verification

The project test database must first pass its identity guard:

```powershell
pnpm test:db:verify
pnpm test:db:reset
```

Run the MVP acceptance suite:

```powershell
pnpm --filter @elevator/web exec playwright test `
  tests/e2e/full-mvp-flow.spec.ts `
  tests/e2e/mvp-scenarios.spec.ts `
  tests/e2e/mvp-catalog-sales.spec.ts `
  tests/e2e/mvp-ui-routes.spec.ts `
  --reporter=line
```

Run package-level unit tests:

```powershell
pnpm --filter @elevator/web test
pnpm --filter @elevator/worker test
pnpm --filter @elevator/contracts test
pnpm --filter @elevator/selection-engine test
pnpm --filter @elevator/file-storage test
```

Do not interpret a green MVP suite as approval for real AI, real files, Native RPC, PFR changes, production migration or deployment.

