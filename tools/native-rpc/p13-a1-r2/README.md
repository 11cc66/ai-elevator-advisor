# P13 Native RPC Validation Harness

`ISOLATED NATIVE RPC VALIDATION HARNESS — NOT PRODUCTION INTEGRATION`

This tree implements the Build-only R4-A1-R4-B1 contract from the P1-3
architecture review. It contains source for:

- two public RPC managers: `P13Invoke` and `P13LaunchInvoke`;
- the approved 13 Authority operations and 6 Launch operations;
- Windows per-call identity acquisition and process-handle binding;
- four isolated Launch Authority descriptors;
- test-only session, epoch, replay, grant, effect, Job, SEALED and Evidence
  adapters;
- a fixed-toolchain x64 MIDL/MSVC/LINK build.

The generated server and client binaries must never be executed during B1.
Runtime validation requires a separate authorization.

Build:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
```

The build script refuses to execute any generated binary. It invokes only the
fixed MIDL, compiler, linker and `dumpbin` metadata views.

