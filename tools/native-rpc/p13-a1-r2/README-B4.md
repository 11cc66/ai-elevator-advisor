# P13 Native RPC Harness — B4 Remediation

`BUILD-ONLY / NATIVE RUNTIME NOT AUTHORIZED`

The B4 revision implements the operation-policy, Caller identity, Grant/Ticket,
separate lifecycle, restricted-token, Job/handle, SEALED, NDR and test-source
remediation required by R4-A1-R4-B3.

Build:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build-b4.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\verify-static-b4.ps1
```

The build writes only to:

```text
generated/r4-b4/x64
obj/r4-b4/x64
bin/r4-b4/x64
logs/r4-b4
manifest/r4-b4
evidence/r4-b4
```

The build script does not execute the generated server, client or test binary.

Machine-readable policy and test traceability:

```text
manifest/r4-b4/operation-policy.json
manifest/r4-b4/test-traceability.json
```

