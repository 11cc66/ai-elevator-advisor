# Shell and Execution Evidence R3-C8 Corrections

## Verified PowerShell

```text
PowerShell: 7.6.9
PSEdition: Core
Executable:
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
FileVersion: 7.6.9.500
Parent: codex.exe
WorkingDirectory: D:\thinkbook\Desktop\jieya
```

The final offline generator, registry builder and validator were invoked with:

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
python -B docs/product/full-mvp-remediation-design-r3-c8-corrections/tools/generate_complete_ddl_r3_c8_corrections.py
python -B docs/product/full-mvp-remediation-design-r3-c8-corrections/tools/build_function_registry_r3_c8_corrections.py
python -B docs/product/full-mvp-remediation-design-r3-c8-corrections/tools/validate_corrections.py
```

No C8 or C8 Review generator, validator, Server, Client, Native Tests, database,
Storage, Build or Runtime process was invoked.

## Shell Routing Incident

During this corrections session, a group of five Skill `Get-Content` commands
was accidentally sent with the Bash shell parameter:

```powershell
Get-Content -Raw -LiteralPath '...\.agents\skills\...\SKILL.md'
```

Bash failed with:

```text
'Get-Content' is not recognized as a command.
```

The same reads were then executed with verified PowerShell and are recorded in
the report. No Bash output was used as review evidence.

Two later Python commands were also accidentally sent with Bash and failed
before Python started:

```powershell
python -B docs/product/full-mvp-remediation-design-r3-c8-corrections/tools/build_function_registry_r3_c8_corrections.py
```

```text
The system cannot find the specified path.
```

They were immediately rerun with PowerShell. No files, database, Storage,
Runtime or Git state changed from the failed invocations.

## Side-Effect Boundary

```text
Git writes:       NONE
Database:         NOT ACCESSED
Storage:          NOT ACCESSED
Build/Runtime:    NOT EXECUTED
PFR/ACL/Service:  NOT MODIFIED
```
