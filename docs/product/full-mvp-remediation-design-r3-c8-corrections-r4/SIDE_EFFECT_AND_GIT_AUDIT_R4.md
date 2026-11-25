# Side Effect and Git Audit R4

## Initial Baseline

The R4 directory did not exist at the beginning of this design round. The
recorded phase baseline was:

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Tracked modified:
41

Untracked entries shown by status:
71

Untracked files -uall:
774

Staged:
0

Deleted:
0

Porcelain status lines:
112
```

A later read-only snapshot after the first 11 R4 files were created observed
785 `-uall` untracked files and the same branch, HEAD, modified, staged and
deleted counts. The 11-file delta matched the initial R4 directory contents.

## Execution Identity

The Guard launcher verified:

```text
PowerShell: 7.6.9
PSEdition: Core
Executable: pwsh.exe
FileVersion: 7.6.9.500
Parent: codex
Python candidate selected: D:\python\python.exe
Python: 3.15.1
Bytecode generation: disabled with -B and PYTHONDONTWRITEBYTECODE=1
```

The exact process record is in `tools/R4_EXECUTION_EVIDENCE.json`; every tool
invocation is appended to `tools/R4_EXECUTION_HISTORY.jsonl`.

## Shell Routing Incidents

Two read-only checks were sent to the wrong wrapper earlier in the round:

1. Registry inspection was sent as Bash and the actual CMD wrapper failed at
   the PowerShell `&` call operator.
2. A `Select-String` inspection was sent as Bash and CMD could not recognize
   the PowerShell cmdlet.

Both failed before accepting output or writing a file. They were rerun under
verified PowerShell.

One Git read-only query initially returned `dubious ownership` because the
repository is owned by the sandbox identity. No Git configuration was changed.
All subsequent Git reads used a command-scoped
`-c safe.directory=D:/thinkbook/Desktop/jieya` argument.

## Authorized Writes

All writes are confined to:

```text
docs/product/full-mvp-remediation-design-r3-c8-corrections-r4/
```

Categories:

- R4 design documents;
- R4 Complete DDL and Overlay;
- R4 Function Registry;
- R4 evidence and Manifest;
- R4-only offline validation tools.

## Forbidden Operations

```text
R2/R3 input modification: NONE
Prisma Schema/Migration modification: NONE
Application/Worker source modification: NONE
Database connection/SQL/Migration: NONE
Storage access: NONE
Build: NOT EXECUTED
Native RPC: NOT EXECUTED
Runtime: NOT EXECUTED
ACL/Owner/Service/Scheduler modification: NONE
Git add/commit/reset/restore/clean/checkout/stash: NONE
Production action: NONE
```

## Protected Objects

```text
$null:
  NOT READ
  NOT HASHED
  NOT MODIFIED/DELETED/MOVED

$null' and $null():
  NOT CREATED OR MODIFIED

apps/web/.next:
  NOT BUILT/STARTED/MOVED/MODIFIED

apps/worker/dist:
  NOT BUILT/STARTED/MOVED/MODIFIED
```

No `.env`, `.env.test`, secret, password, private key or API key was read.

## Final State

Immediately before final Manifest creation, the observed state was:

```text
Initial untracked files -uall: 774
R4 files excluding Manifest: 25
Current untracked files -uall (including stale Manifest to be replaced): 800
Tracked modified: 41
Staged: 0
Deleted: 0
Porcelain status lines: 112
```

The delta is exactly 25 R4 regular files excluding Manifest. Final Manifest
replaces the stale Manifest, so the expected final `-uall` count remains 800.
This expectation is verified by path comparison and the final user report; it
is not inferred from count alone.

`$null'` and `$null()` do not exist. `$null` exists as before and was not read,
hashed or changed. `apps/web/.next` and `apps/worker/dist` exist and were not
built, started, moved or changed.
