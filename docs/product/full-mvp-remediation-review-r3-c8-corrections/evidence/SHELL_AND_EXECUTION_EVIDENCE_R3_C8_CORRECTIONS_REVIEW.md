# Shell and Execution Evidence R3-C8 Corrections Review

## Accepted PowerShell Identity

```text
PowerShell: 7.6.9
PSEdition: Core
PID at identity check: 15252
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
FileVersion: 7.6.9.500
ProductVersion: 7.6.9 SHA: 3a0b9fb386a321f664ab6dd6a39abaf2313c76bf+3a0b9fb386a321f664ab6dd6a39abaf2313c76bf
ProcessCreationTimeUtc: 2026-11-23T21:47:44.6968558Z
ParentPID: 27624
Parent: codex.exe
ParentPath:
C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex.exe
WorkingDirectory: D:\thinkbook\Desktop\jieya
```

The current process image, in-process version, file version, parent and working
directory were independently read from Windows process/file APIs. Accepted
commands were rerun in this PowerShell process family.

## Execution Boundary

No command used `2>$null`, `2>NUL`, `2>/dev/null` or another error-output
redirection. No command opened `$null` content, hashed `$null`, wrote project
files outside the review directory, contacted PostgreSQL, accessed Storage,
executed a Corrections Tool, built source or ran product/Native tests.

The independent Python checker was invoked only after setting:

```text
PYTHONDONTWRITEBYTECODE=1
python -B
```

Its only write target was:

```text
docs/product/full-mvp-remediation-review-r3-c8-corrections/evidence/INDEPENDENT_REVIEW_EVIDENCE_R3_C8_CORRECTIONS.json
```

## Shell Routing Incidents

### SREV-01

Requested execution mode: Bash.

Actual result: CMD parsed the command and failed before PowerShell execution:

```text
'$PSVersionTable.PSVersion.ToString' is not recognized as an internal or external command
```

Complete command text:

```powershell
$PSVersionTable.PSVersion.ToString(); [System.Diagnostics.Process]::GetCurrentProcess().Path; Get-Location; git status --short --branch; Get-ChildItem -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8-corrections' -Recurse -File | Select-Object FullName,Length,LastWriteTimeUtc | Sort-Object FullName | Format-Table -AutoSize
```

No output from the failed invocation was accepted. The check was rerun under
verified PowerShell.

### SREV-02

Requested execution mode: Bash.

Actual result: CMD could not resolve `Get-Content`; the matrix read did not
execute.

Complete command text:

```powershell
Get-Content -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8/HISTORICAL_FINDING_CLOSURE_MATRIX_R3_C8.md' -Raw
```

### SREV-03

Requested execution mode: Bash.

Actual result: CMD could not resolve `Get-Content`; the two read-only input
reads did not execute.

Complete command text:

```powershell
Get-Content -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8-corrections/OPEN_DECISIONS_REVIEW_R3_C8_CORRECTIONS.md' -Raw; Get-Content -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8-corrections/PRICE_AND_REVIEW_PROVENANCE_AUDIT_R3_C8_CORRECTIONS.md' -Raw
```

### SREV-04

Requested execution mode: Bash.

Actual result: CMD could not resolve `Get-Content`; the four read-only audit
reads did not execute.

Complete command text:

```powershell
Get-Content -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8-corrections/SESSION_ROLE_AND_BOOTSTRAP_AUDIT_R3_C8_CORRECTIONS.md' -Raw; Get-Content -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8-corrections/REQUEST_LEDGER_AND_PRESEAL_AUDIT_R3_C8_CORRECTIONS.md' -Raw; Get-Content -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8-corrections/DDL_PRIVILEGE_AND_OBJECT_AUDIT_R3_C8_CORRECTIONS.md' -Raw; Get-Content -LiteralPath 'docs/product/full-mvp-remediation-review-r3-c8-corrections/VALIDATOR_AND_MUTATION_AUDIT_R3_C8_CORRECTIONS.md' -Raw
```

### SREV-05

Requested execution mode: Bash.

Actual result: CMD interpreted the quoted PowerShell argument string and `rg`
failed during argument parsing. No relation to the target file was searched.

Complete command text:

```powershell
rg -n -C 15 "validate_session_role_r3|datdba|pg_database|direct database CONNECT|WITH RECURSIVE reachable|relowner|proowner|nspowner" 'docs/product/full-mvp-remediation-design-r3-c8-corrections/DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql'
```

### SREV-06

Requested execution mode: Bash.

Actual result: CMD failed to resolve the intended file argument and did not
perform the Catalog search.

Complete command text:

```powershell
rg -n -C 18 "catalog_review_event_r3|source_revision_id|catalog_review_event_digest_v1|create_catalog_review_event_r3" 'docs/product/full-mvp-remediation-design-r3-c8-corrections/DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql'
```

### SREV-07

Requested execution mode: Bash.

Actual result: CMD failed to resolve the intended file argument and did not
perform the Request Ledger search.

Complete command text:

```powershell
rg -n -C 15 "command_request_replay_audit_r3|session_id<>p_session_id|revoked_at|original.*session|trusted_session" 'docs/product/full-mvp-remediation-design-r3-c8-corrections/DATABASE_FINAL_STATE_OVERLAY_R3_C8_CORRECTIONS.sql'
```

### SREV-08

Requested execution mode: PowerShell.

Actual result: a manifest-hash reporting command had a PowerShell parser error
before execution because an `if` statement was piped directly. No file was read
or written by the failed statement.

Complete command text:

```powershell
$paths=@('docs/product/full-mvp-remediation-design-r3-c8-corrections/SHA256SUMS_R3_C8_CORRECTIONS.txt','docs/product/full-mvp-remediation-design-r3-c8/SHA256SUMS_R3_C8.txt','docs/product/full-mvp-remediation-review-r3-c8/SHA256SUMS_R3_C8_REVIEW.txt','docs/product/full-mvp-remediation-design-r3-c7/SHA256SUMS_R3_C7.txt','docs/product/full-mvp-remediation-review-r3-c7/SHA256SUMS_R3_C7_REVIEW.txt'); foreach($p in $paths){ if(Test-Path -LiteralPath $p -PathType Leaf){ $f=Get-Item -LiteralPath $p; $h=Get-FileHash -LiteralPath $p -Algorithm SHA256; [pscustomobject]@{Path=$p;Bytes=$f.Length;Lines=(Get-Content -LiteralPath $p).Count;SHA256=$h.Hash} } else { [pscustomobject]@{Path=$p;Bytes=$null;Lines=$null;SHA256='MISSING'} } } | Format-Table -AutoSize
```

## Prior Handoff Note

The continuation summary reported that several additional read-only requests
before handoff had also selected Bash and failed before execution. Their exact
full command strings are not present in the active transcript. No output from
those attempts was accepted as evidence. Every reported conclusion was
reproduced by an accepted PowerShell or independent Python check.

## Side-Effect Conclusion

```text
Input design:       NOT MODIFIED
Source/Prisma:      NOT MODIFIED
Database:           NOT ACCESSED
Storage:            NOT ACCESSED
Corrections Tool:   NOT EXECUTED
Build/Runtime:      NOT EXECUTED
Git writes:         NONE
Production:         NOT AUTHORIZED
```
