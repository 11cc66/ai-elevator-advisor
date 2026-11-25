# MVP Known Limitations

## Product limitations

1. AI is a deterministic `MockAIProvider`. It does not call an external model and only recognizes bounded, documented text patterns.
2. Product data is fictional `DEMO_MOCK`. It is not suitable for procurement, engineering or pricing decisions.
3. Preliminary recommendations require professional review and site survey.
4. New-building drawing support records metadata/status only. No drawing parser is connected and no drawing result is invented.
5. Sales assignment currently requires controlled database/seed administration. A full user/role administration UI is not delivered.
6. Quotation, contract, survey, approval, construction, delivery and maintenance workflows remain future scope.

## Repository baseline limitations

### P1-3 upload incompatibility

The existing Phase 3 upload service still transitions a `FileUploadIntent` to `UPLOADING` before creating the required Upload Attempt chain. The P1-3 database trigger correctly rejects that old path:

```text
invalid UPLOADING upload chain counts
```

Fresh `prisma generate` also exposes missing `uploadIntentId`, `uploadAttemptId` and `creationOperationAttemptId` requirements in old upload/integration fixtures.

This was explicitly outside FULL-MVP-BUILD-001 remediation scope. It was not bypassed, weakened or rewritten. Consequently:

- real file upload is unavailable;
- legacy file E2E tests fail;
- repository-wide typecheck fails in the old P1-3 area;
- `pnpm test:db:constraints` reports mixed legacy failures.

### Browser automation

Playwright Chromium is not installed at the expected executable path. Per authorization, no third-party/browser download was attempted. Authenticated server-rendered routes were verified through HTTP instead.

### Secure production build

The Web production build is intentionally guarded and currently rejects the environment:

```text
Missing required build configuration: P13_RELEASE_ID
```

The Gate was not bypassed.

### Root workspace test command

`pnpm test` currently stops at `@elevator/authority-core` because that package does not resolve `vitest`. The relevant packages executed independently. `authority-core` was outside this MVP implementation.

## Security boundaries

- Real AI credentials were neither requested nor accessed.
- No real Storage or customer file operation occurred.
- No Native RPC/Build or PFR/Registry operation occurred.
- No ACL, Owner or service change occurred.
- No Git commit, push, reset, restore, clean, checkout or stash occurred.
- The protected root `$null` object was not read, hashed, modified, moved or deleted.

