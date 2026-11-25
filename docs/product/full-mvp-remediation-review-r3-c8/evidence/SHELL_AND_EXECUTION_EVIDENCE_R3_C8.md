# Shell and Execution Evidence R3-C8

## Verified PowerShell

The final state checks were executed in a process independently queried by
Windows process APIs:

```text
PowerShell: 7.6.9
PSEdition: Core
ExecutablePath:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
FileVersion: 7.6.9.500
ParentPID: 27624
ParentName: codex
ParentPath:
C:\Program Files\WindowsApps\OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0\app\resources\codex.exe
WorkingDirectory: D:\thinkbook\Desktop\jieya
```

The independent verification script was executed with:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
python -B docs/product/full-mvp-remediation-review-r3-c8/evidence/independent_review_verify.py
```

It generated only:

```text
docs/product/full-mvp-remediation-review-r3-c8/evidence/INDEPENDENT_REVIEW_EVIDENCE_R3_C8.json
docs/product/full-mvp-remediation-review-r3-c8/evidence/OBJECT_INVENTORY_R3_C8.json
```

## Bash Misrouting During This Review

The following read-only command attempts were accidentally dispatched with the
tool shell parameter `bash`. The command text was PowerShell syntax, so Bash
reported command lookup errors before any intended read occurred. No redirection,
deletion, creation or target-process execution was present.

### BM-01

Command:

```powershell
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\README.md'
```

Result:

```text
'Get-Content' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

### BM-02

Command prefix:

```powershell
$repo='D:\thinkbook\Desktop\jieya'
$paths=@(...)
$results=foreach($rel in $paths){ ... Get-Item ... Get-Content ... }
$results | Format-Table -AutoSize
```

Result:

```text
'$repo' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

The intended file list was later rerun successfully under PowerShell.

### BM-03

Command:

```powershell
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\DATABASE_ROLE_PRIVILEGE_MATRIX_R3_C8.md'
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\HISTORICAL_FINDING_CLOSURE_MATRIX_R3_C8.md'
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\P1_P2_P3_ACCEPTANCE_TEST_MATRIX_R3_C8.md'
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\DESIGN_CHANGELOG_R3_C8.md'
```

Result:

```text
'Get-Content' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

### BM-04

Command:

```powershell
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\evidence\README.md'
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\evidence\SUMMARY_R3_C8.json'
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\evidence\DDL_STATIC_AUDIT_R3_C8.json'
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\evidence\C6_BASIS_R3_C8.json'
```

Result:

```text
'Get-Content' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

### BM-05

Command:

```powershell
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\evidence\R6_SCALAR_LIMITS_R3_C8.json'
```

Result:

```text
'Get-Content' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

### BM-06

Command prefix:

```powershell
$repo='D:\thinkbook\Desktop\jieya'
Get-ChildItem -LiteralPath (Join-Path $repo 'docs\product\full-mvp-remediation-design-r3-c7') -Recurse -File | Where-Object Name -match 'r6_encoder' | Select-Object FullName,Length | Format-Table -AutoSize
```

Result:

```text
'$repo' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

### BM-07

Command prefix:

```powershell
$p='D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql'
... Select-String / Get-Content ...
```

Result:

```text
'$p' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

This occurred while locating the Snapshot Basis table and later DDL sections.

### BM-08

Command prefix:

```powershell
$r=Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-review-r3-c8\evidence\INDEPENDENT_REVIEW_EVIDENCE_R3_C8.json' | ConvertFrom-Json
$r.r6_scalar.results | Where-Object result -eq 'FAIL' | Format-List
```

Result:

```text
'$r' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

### BM-09

Command:

```powershell
Get-Content -Raw -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-review-r3-c6\INDEPENDENT_REVIEW_R3_C6_FINDINGS.md'
```

Result:

```text
'Get-Content' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

### BM-10

Command:

```powershell
Select-String -LiteralPath 'D:\thinkbook\Desktop\jieya\docs\product\full-mvp-remediation-design-r3-c8\DATABASE_COMPLETE_DDL_DESIGN_R3_C8.sql' -Pattern '...' | Select-Object LineNumber,Line | Format-Table
```

Result:

```text
'Select-String' is not recognized as a command.
Exit code: non-zero
Side effects: none observed
```

This repeated for multiple read-only line-location searches. Every such line
search used in the final evidence was rerun under PowerShell, and the resulting
evidence JSON contains only the independent Python computation.

### Additional Repeated Failures

The same pre-execution failure occurred for further PowerShell-only probes:

```text
$p=... Get-Content -LiteralPath $p | Select-Object -Skip n -First m
$p=... Select-String -LiteralPath $p -Pattern '...'
$r=... ConvertFrom-Json
$h=... Select-String
$dir=... Get-ChildItem ...
```

Each returned a Bash “command not found” style error before executing the
intended object access. No command contained `>` or `>>` redirection.

The current tool interface did not retain a separate durable shell transcript.
Therefore exhaustive reconstruction of every repeated invocation is
`NOT VERIFIED`; all conclusions used in the report were independently rerun
under PowerShell and are reproducible from the listed commands.

## C8-Reported Historical Bash Event

C8 reported earlier accidental Bash-routed read-only commands during its design
work. This review confirms the current C8 files and hashes, and confirms the
worktree count currently matches the recorded end snapshot. It cannot fully
reconstruct the historical shell process tree or prove the absence of every
write from the C8 report alone.

Therefore:

```text
C8 historical Bash event:
PARTIALLY VERIFIED — no current artifact mismatch; historical process tree NOT VERIFIED

Current review Bash event:
NO WRITES / NO DATABASE / NO STORAGE / NO BUILD / NO RUNTIME
```
