# Shell and Execution Notes R3-C8 Corrections R2

## Guarded Execution

All accepted R2 generator, Registry, Validator, vector and self-test commands ran
through:

```text
tools/Invoke-R2GuardedTool.ps1
```

The launcher verified PowerShell 7.6.9 Core, actual `pwsh.exe`, FileVersion
7.6.9.500, PID, Parent PID, parent image, repository root, candidate paths and
the absolute Python child relationship. Python ran with `-B` and
`PYTHONDONTWRITEBYTECODE=1`.

## SREV-R2-01 — Python Candidate Alias

The first guarded generator invocation selected a Windows Apps `python.exe`
alias that terminated with Windows exit code `9009` before Python tool code ran.

```text
GUARDED_TOOL_RESULT=FAIL exit_code=9009
```

The launcher now executes and version-tests each absolute Python 3 candidate.
The verified candidate is recorded in
`SHELL_GUARD_EVIDENCE_R3_C8_CORRECTIONS_R2.json`.

## SREV-R2-02 — Registry Command Routed to CMD

Requested execution mode: Bash.

Actual result: CMD failed on the PowerShell call operator before the Registry
tool started:

```text
The ampersand (&) character is not allowed.
```

No Registry output was accepted from the failed invocation. It was rerun under
verified PowerShell and the Guard returned PASS.

## SREV-R2-03 — Open Decision Count Routed to CMD

Requested execution mode: Bash.

Actual result: CMD treated the PowerShell variable text as a command and failed
before reading the file.

No output was accepted. The count was rerun under PowerShell and returned
57 IDs / 57 unique IDs.

## SREV-R2-04 — Vector Command Routed to CMD

Requested execution mode: Bash.

Actual result: CMD failed on the PowerShell call operator before the vector tool
started.

No vector output was accepted. The command was rerun under verified PowerShell
and the Guard returned PASS.

## SREV-R2-05 — Static SQL Scan Routed to CMD

Requested execution mode: Bash.

Actual result: CMD split the PowerShell single-quoted pattern at `AND` and
failed before `rg` searched the file.

No output was accepted and no file was written. The scan was rerun under
PowerShell and returned no placeholder/debug matches.

## Direct-Python Negative Test

`python -B tools/guard.py` was intentionally run outside the launcher.

```text
{"guard": "FAIL", "reason": "Python parent is not the verified PowerShell process"}
DIRECT_PYTHON_GUARD_EXIT=2
```

This is the required fail-closed result.

## Protected Path

`$null` was checked for existence only. It was not opened, read, hashed, modified,
deleted or used as a temporary filename.
