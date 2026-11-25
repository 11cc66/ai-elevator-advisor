# Execution Identity Guard R3-C8 Corrections R2

## Purpose

All R2 offline tools that read or write the R2 output tree must pass the
execution identity guard before tool code runs.

## Required Identity

```text
Windows
PSEdition: Core
PowerShell: 7.6.9
Executable image: pwsh.exe
FileVersion: 7.6.9.500
Working root: D:\thinkbook\Desktop\jieya
Parent: approved codex.exe or pwsh.exe process
```

## Preflight

`tools/Invoke-R2GuardedTool.ps1`:

1. reads the actual current process image;
2. checks internal and file versions;
3. reads Parent PID and parent image;
4. discovers absolute `pwsh.exe` candidates from PATH and `Get-Command -All`;
5. adds and normalizes the current executable candidate;
6. writes a nonce evidence record under R2 `evidence/`;
7. launches only an absolute `python.exe` with `-B`;
8. sets `PYTHONDONTWRITEBYTECODE=1`.

## Python Child

`tools/guard.py` re-queries the actual parent process with Windows process APIs
and requires:

- parent PID equals the launcher PID;
- image path equals the verified `pwsh.exe`;
- process creation time equals the launcher evidence;
- nonce in the environment equals the evidence file;
- target output root resolves under the R2 directory.

Environment variables or command-line text alone are not accepted as identity
proof.

## Failure Rules

- Wrong shell: exit before Python.
- Wrong PowerShell version: exit before Python.
- Unverified parent: exit before Python.
- Tool path outside R2: exit before Python.
- Python parent mismatch: tool exits non-zero.
- Output path escape: tool exits non-zero.
- Any failure result: no PASS evidence.

## Misrouting

If Bash or CMD receives a PowerShell command, the output is discarded. The
command, requested route and failure stage are recorded. Retry is allowed only
through verified PowerShell. No fallback downgrade is permitted.

The protected historical `$null` file is only checked for existence. It is never
opened, hashed, modified or used as a temporary path.

## Evidence

The guard writes:

```text
evidence/SHELL_GUARD_EVIDENCE_R3_C8_CORRECTIONS_R2.json
evidence/SHELL_GUARD_HISTORY_R3_C8_CORRECTIONS_R2.jsonl
```

The main run evidence also records the guard context returned to each tool.
