# P1-3 C-6.2-L8-A7.20-R4-A1-R2-R4 Post-cleanup Installation Manifest Reconciliation

## 0. Final Result

```text
Stage:
C-6.2-L8-A7.20-R4-A1-R2-R4

Date:
2026-11-21

Mode:
READ-ONLY MANIFEST RECONCILIATION

Overall:
READY FOR AUTHORIZATION

Manifest Integrity:
PASS WITH WARNINGS

Installation Readiness:
READY FOR AUTHORIZATION

Native RPC Build Readiness:
BLOCKED

Native RPC Runtime Verification:
NOT EXECUTED

R4-A1 Overall Status:
BLOCKED
```

`READY FOR AUTHORIZATION` only means that the user may consider a separate
R4-A1-R3 installation authorization. It does not mean that installation is
authorized, downloaded, installed, verified or implemented.

## 1. Baseline and Skills

Repository:

```text
D:\thinkbook\Desktop\jieya
```

Git identity:

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8

Git root:
D:/thinkbook/Desktop/jieya

Worktrees:
one only

Staged files:
0

Deleted files:
0
```

Skills actually loaded and applied:

```text
$project-architecture
$security-audit
$testing-and-verification
```

Documents fully read:

1. R4-A1-R2 provisioning design.
2. R4-A1-R2 provisioning readiness report.
3. R4-A1-R2-R1 installation manifest.
4. R4-A1-R2-R1 final readiness report.
5. R4-A1-R2-R2 reappeared-root-file investigation.
6. R4-A1-R2-R3 exact-root-file deletion report.

## 2. Complete Git Status

Observed at stage start:

```text
Tracked modified: 26
Untracked files: 182
Staged: 0
Deleted: 0
```

### 2.1 Tracked modified files — 26

```text
AGENTS.md
apps/web/next-env.d.ts
apps/web/next.config.ts
apps/web/package.json
apps/web/src/modules/files/download-service.ts
apps/web/src/modules/files/upload-service.ts
apps/web/src/server/files/storage.ts
apps/web/tests/e2e/global-setup.ts
apps/web/tests/integration/phase32-upload-service.test.ts
apps/web/tests/integration/phase34-file-processing.test.ts
apps/web/tests/integration/phase35-lease-renewal.test.ts
apps/web/tests/integration/phase35-processing-reliability.test.ts
apps/worker/package.json
apps/worker/src/config.ts
apps/worker/src/file-maintenance.ts
apps/worker/src/file-processing.ts
apps/worker/src/index.ts
apps/worker/src/storage.ts
apps/worker/tsconfig.json
package.json
packages/file-storage/src/errors.ts
packages/file-storage/src/index.ts
packages/file-storage/src/local-private-storage.ts
packages/file-storage/tests/local-private-storage.test.ts
pnpm-lock.yaml
prisma/schema.prisma
```

### 2.2 Staged and deleted files

```text
Staged list: empty
Deleted list: empty
```

No status repair, reset, restore, checkout, clean or stash was performed.

After this required report was added, the final untracked count became 183.
This report is the only new path added by the stage; tracked modified remains
26 and staged/deleted remain zero.

## 3. Exact Root-Path Check

Checked with Node.js `fs` APIs, avoiding shell interpretation of `$`:

```text
D:\thinkbook\Desktop\jieya\$null
Exists: false

D:\thinkbook\Desktop\jieya\$null)
Exists: false
```

R2-R2 recorded File ID:

```text
0x0000000000000000003b000000030085
```

R2-R3 recorded the same File ID in its pre-deletion threshold and then
recorded that the exact path no longer existed. Those two reports are
consistent.

No new exact-name anomaly is present in the current 182-path untracked list.
This is a statement about the current observation only. It does not guarantee
that a command-triggered recreation can never happen again.

## 4. Untracked File Reconciliation

Current untracked paths by top-level area:

| Area | Current paths |
|---|---:|
| `.agents` | 15 |
| `apps/web` | 35 |
| `apps/worker` | 8 |
| `docs` | 104 |
| `packages` | 17 |
| `prisma` | 3 |
| Total | 182 |

Known R2-series membership:

```text
Current untracked count:                    182
Current known R2-series documents present:    6
Current removal of those six:                176
Missing known R2-series documents:             0
```

This matches the numerical reconciliation:

```text
Historical C1-C2 remainder:       176
R2-series documents:                2
R2-R1 documents:                    2
R2-R2 investigation report:         1
R2-R3 deletion report:              1
                                 ----
Expected current total:            182
```

`BASELINE MEMBERSHIP NOT FULLY VERIFIED`: the repository does not contain the
C1-C2 report body or a complete saved 176-path baseline inventory. Therefore:

- every one of the 182 current untracked paths is listed in Appendix A;
- the six named R2-series documents are positively identified as the post-176
  additions;
- the other 176 paths are the correct numerical remainder after removing those
  six known paths;
- it is not proven that each of those remaining 176 paths had exactly the same
  identity at the earlier C1-C2 observation.

No duplicate untracked path was found. No untracked path ends in the anomalous
root filenames `$null` or `$null)`. All 182 paths are below the six recognized
top-level areas; there is no current root-level untracked object.

## 5. Six R2-Series Documents

All six files exist and are included in the current untracked set:

| Document | Length | SHA-256 | Prior identity |
|---|---:|---|---|
| R4-A1-R2 provisioning design | 10286 | `9EEDA23E4B49317ABCC4297DF900DD5CAD2603B7A9787D9F0320E6C96F91C5D4` | current only; prior hash not recorded |
| R4-A1-R2 readiness | 3812 | `C4C429788DDFC6C176E31C94F31AAAAE187E22171850E79F3B4A7A4B6DA60E44` | current only; prior hash not recorded |
| R4-A1-R2-R1 installation manifest | 12700 | `6083F8DA5BDBB84ED02E2F9B2D88BC95151607B3F478717AC69C0A4E28D4B15E` | MATCH |
| R4-A1-R2-R1 final readiness | 6038 | `F0BAA3472BDB8B3CD21140F5E8B1914EB87811B8905265A05D180F8E09F3C754` | MATCH |
| R4-A1-R2-R2 investigation | 11536 | `1882A7453137AA7D0A4BD6F2D7EB84D6FCA3A333A093539A9DF3364E874B8003` | MATCH |
| R4-A1-R2-R3 deletion report | 6919 | `CED365B2AAC626DE1539A05233C7D81A1218FBFCF104613B4B6D0FA5366D7B37` | MATCH |

## 6. Current Windows Toolchain Baseline

Read-only environment observations:

```text
OS:
Microsoft Windows 11 家庭版 中文版

Version:
10.0.26300

Build:
26300

Architecture:
x64

Current user:
LAPTOP-34H6Q1OD\thinkbook

Current shell elevated:
false

PowerShell:
7.6.9

Node.js:
24.22.1

pnpm:
11.25.0
```

System RPC runtime:

```text
C:\Windows\System32\rpcrt4.dll
Version: 10.0.26100.9949 (WinBuild.160101.0800)
```

Development toolchain:

```text
Windows Kits 10 roots:              absent
Visual Studio/Build Tools roots:    absent
vswhere.exe:                        unavailable
midl.exe:                           unavailable
cl.exe:                             unavailable
link.exe:                           unavailable
dumpbin.exe:                        unavailable
RPC SDK headers:                    unavailable
Rpcrt4.lib:                         unavailable
```

Conclusion:

```text
Windows RPC Runtime:
PRESENT

Native RPC Build Toolchain:
ABSENT

Native RPC Build Readiness:
BLOCKED UNTIL AUTHORIZED INSTALLATION AND VERIFICATION
```

## 7. Installation Manifest Verification

### 7.1 Required products and component IDs

| Product / component | Candidate ID | Current assessment |
|---|---|---|
| Visual Studio 2022 Build Tools | `Microsoft.VisualStudio.2022.BuildTools` | valid product candidate; official download endpoint reachable by HEAD |
| C++ desktop workload | `Microsoft.VisualStudio.Workload.VCTools` | current official VS 2022 Build Tools component page contains ID |
| MSVC v143 x64/x86 | `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` | current official page contains ID |
| Windows 11 SDK 26100 | `Microsoft.VisualStudio.Component.Windows11SDK.26100` | current official page contains ID; its exact MIDL/RPC payload remains post-install evidence |
| MSBuild | `Microsoft.Component.MSBuild` | current official page contains ID |

The current official Visual Studio 2022 Build Tools component-ID page was
retrieved successfully on 2026-11-21 and HTTP 200 contained all four workload
or component IDs above.

### 7.2 Current official source checks

| Microsoft source | HTTP status | Current use |
|---|---:|---|
| [Visual Studio Build Tools component IDs](https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools?view=vs-2022) | 200 | confirms current candidate component IDs |
| [Use command-line parameters to install Visual Studio](https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio?view=vs-2022) | 200 | installer command-line design |
| [Windows SDK downloads](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/) | 200 | official SDK entry point |
| [MIDL start page](https://learn.microsoft.com/en-us/windows/win32/midl/midl-start-page) | 200 | classic Windows RPC/COM MIDL |
| [RPC protocol sequence constants](https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants) | 200 | `ncalrpc` transport |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | 200 | per-call RPC identity evidence |

### 7.3 Installer identity and integrity state

Manifest-recorded Build Tools bootstrapper:

```text
URL:
https://download.visualstudio.microsoft.com/download/pr/95995f57-8355-4ff5-8d90-a7e1669fb3b3/310c13b8238876afb4e823a91112230ee2d2c5a45c431d4062af7aadedff9c4c/vs_BuildTools.exe

Manifest version:
17.14.45

Recorded SHA-256:
310c13b8238876afb4e823a91112230ee2d2c5a45c431d4062af7aadedff9c4c

HEAD status:
200

HEAD Content-Length:
4480304
```

Manifest-recorded Windows SDK bootstrapper:

```text
URL:
https://download.microsoft.com/download/f4b30f2a-4fc3-430e-9b03-c842b5f5f9f1/KIT_BUNDLE_WINDOWSSDK_MEDIACREATION/winsdksetup.exe

Manifest version:
10.0.26100.7705

Recorded SHA-256:
6fa0fa27db77a909f5ecb35183cb26a969a6775936780936fe239e4f9c66b458

HEAD status:
200

HEAD Content-Length:
1451232
```

HEAD availability is not a download and does not verify the executable bytes.
The URL-embedded hash is supporting metadata, not cryptographic proof.

Status matrix:

| Evidence state | Build Tools | Windows SDK |
|---|---|---|
| Manifest Recorded | YES | YES |
| Official Source Identified | YES | YES |
| Installer Downloaded | NO | NO |
| Installer Hash Verified | NO | NO |
| Authenticode Publisher Verified | NO | NO |
| Components Installed | NO | NO |
| Components Verified | NO | NO |

### 7.4 Package version consistency

The manifest distinguishes these metadata layers:

```text
Build Tools package metadata:  17.14.45
SDK package metadata:          10.0.26100.7705
VS component-page generation:  17.14.36015.10
```

They are not treated as interchangeable version numbers. Exact installed
component manifests must be recorded after an authorized installation.

### 7.5 Known post-install verification requirements

The following remain `NOT VERIFIED` by design:

- classic `midl.exe` is actually provided by the selected SDK component;
- `rpc.h`, `rpcndr.h`, `rpcdce.h` and `rpcasync.h` are present;
- `Rpcrt4.lib` is present;
- MSVC v143 x64 `cl.exe`, `link.exe` and `dumpbin.exe` versions and paths;
- component download/install size;
- installed component IDs;
- Developer Command Prompt environment initialization;
- PATH / INCLUDE / LIB deltas;
- rollback remains exact if installation changes an existing toolchain.

These are expected installation-stage gates, not current blockers to requesting
installation authorization.

## 8. Isolated Harness Review

The existing design remains consistent with project boundaries:

- native source, IDL/ACF, generated files, objects, binaries and evidence are
  isolated under a future `tools/native-rpc/p13-a1-r2/` tree;
- the harness is not linked into Next.js or Worker production builds;
- no pnpm lockfile change is required;
- no existing TypeScript tsconfig is to be modified;
- no write to `apps/web/.next` or `apps/worker/dist` is permitted;
- historical unknown binaries are not reused;
- the Node driver uses fixed argv, environment allowlist, cwd, timeout, exit
  code and JSON evidence;
- every run must record SDK/MIDL/MSVC versions, executable paths, binary digest
  and toolchain identity;
- Named Pipe, TCP, HMAC and in-process mocks cannot substitute for a real
  `ncalrpc` runtime test.

The design does not claim that `processHandleKey` is a Windows kernel handle.
Native identity evidence must retain a real server-side process handle and
process creation time.

No harness directory, source, IDL, binary, server, client or endpoint was
created in this stage.

## 9. Six Protected Object Hashes

Exact paths derived from the approved documents:

| Object | Exact path | Historical SHA-256 | Current SHA-256 | Result |
|---|---|---|---|---|
| FZ | `docs/architecture/file-lifecycle-p13-design-freeze.md` | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` | MATCH |
| ST | `docs/architecture/file-lifecycle-p13-implementation-status.md` | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` | MATCH |
| DBTP | `docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md` | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` | MATCH |
| Prisma Schema | `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` | MATCH |
| Next environment declaration | `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` | MATCH |
| TypeScript incremental cache | `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` | MATCH |

The A7.18 narrow waiver applies only to the one approved historical
`apps/web/tsconfig.tsbuildinfo` byte transition. It was not broadened by this
stage and does not waive any other file.

These six matches do not establish whole-repository integrity. In particular,
the complete historical `.next`, Worker `dist` and every build artifact remain
`NOT VERIFIED`.

## 10. Warnings and Limitations

1. `BASELINE MEMBERSHIP NOT FULLY VERIFIED` for the 176 pre-R2 untracked paths
   because the C1-C2 report body and full inventory are unavailable.
2. The Build Tools and Windows SDK installer SHA-256 values are recorded, but
   the binaries were not downloaded and their hashes and Authenticode
   signatures were not independently verified.
3. Exact classic MIDL and RPC SDK payloads remain installation-time checks.
4. Exact component download/install size remains `ESTIMATED / NOT VERIFIED`.
5. Installation likely requires administrator elevation; the current process
   is not elevated.
6. Whole `.next` and Worker `dist` historical integrity remains unverified.
7. The R2-R3 deletion used a policy-compatible PowerShell `.NET File Delete`
   instead of the originally named `Remove-Item`; the R2-R3 report records this
   method warning. The current exact paths are absent.

No current blocker prevents requesting installation authorization, but none of
the above warnings authorizes installation or proves successful installation.

## 11. Final Decision Matrix

```text
Manifest Integrity:
PASS WITH WARNINGS

Installation Readiness:
READY FOR AUTHORIZATION

Native RPC Build Readiness:
BLOCKED — TOOLCHAIN ABSENT

Native RPC Runtime Verification:
NOT EXECUTED

R4-A1 Overall Status:
BLOCKED

Overall Recommendation:
READY FOR AUTHORIZATION
```

The user may now consider a separate R4-A1-R3 installation authorization with
an exact product/component list, destination, download-integrity procedure,
administrator elevation, environment delta capture and rollback gates.

## 12. Document Integrity

The report cannot contain its own stable SHA-256 without changing that hash.
The report identity is computed after freezing the file and returned externally
with the completion report.

## Appendix A — Current 182 Untracked Paths

`U` marks a current untracked path whose historical membership is not fully
verified because no complete C1-C2 inventory is available. `R2` marks one of
the six positively identified post-baseline R2-series documents.

```text
U  .agents/skills/file-lifecycle/SKILL.md
U  .agents/skills/file-lifecycle/agents/openai.yaml
U  .agents/skills/file-lifecycle/references/lifecycle-review.md
U  .agents/skills/prisma-db-safety/SKILL.md
U  .agents/skills/prisma-db-safety/agents/openai.yaml
U  .agents/skills/prisma-db-safety/references/database-change-review.md
U  .agents/skills/project-architecture/SKILL.md
U  .agents/skills/project-architecture/agents/openai.yaml
U  .agents/skills/project-architecture/references/architecture-review.md
U  .agents/skills/security-audit/SKILL.md
U  .agents/skills/security-audit/agents/openai.yaml
U  .agents/skills/security-audit/references/adversarial-review.md
U  .agents/skills/testing-and-verification/SKILL.md
U  .agents/skills/testing-and-verification/agents/openai.yaml
U  .agents/skills/testing-and-verification/references/verification-matrix.md
U  apps/web/scripts/build-secure.ts
U  apps/web/scripts/p13-build-audit/cli.ts
U  apps/web/scripts/p13-build-audit/scanner.ts
U  apps/web/scripts/p13-db-tests/barrier.ts
U  apps/web/scripts/p13-db-tests/capabilities.ts
U  apps/web/scripts/p13-db-tests/fixture-builder.ts
U  apps/web/scripts/p13-db-tests/harness.ts
U  apps/web/scripts/p13-db-tests/index.ts
U  apps/web/scripts/p13-db-tests/types.ts
U  apps/web/scripts/p13-deployment-evidence/cli.ts
U  apps/web/scripts/p13-deployment-evidence/evidence-bundle.ts
U  apps/web/scripts/p13-deployment-evidence/evidence.ts
U  apps/web/scripts/p13-deployment-evidence/manual-evidence.template.json
U  apps/web/scripts/p13-deployment-evidence/requirements.ts
U  apps/web/scripts/p13-deployment-evidence/verification-trust.template.json
U  apps/web/scripts/p13-startup-security/cli.ts
U  apps/web/scripts/p13-storage-delete-audit/cli.ts
U  apps/web/scripts/p13-storage-delete-audit/scanner.ts
U  apps/web/scripts/p13-storage-inventory/cli.ts
U  apps/web/scripts/p13-storage-inventory/inventory.ts
U  apps/web/scripts/start-secure.mjs
U  apps/web/src/instrumentation.ts
U  apps/web/src/server/security/startup-gate.ts
U  apps/web/tests/legacy-cleanup-shutdown.test.ts
U  apps/web/tests/p13-a-migration.test.ts
U  apps/web/tests/p13-b-migration.test.ts
U  apps/web/tests/p13-build-audit.test.ts
U  apps/web/tests/p13-db-tooling.test.ts
U  apps/web/tests/p13-deployment-evidence-bundle.test.ts
U  apps/web/tests/p13-deployment-evidence.test.ts
U  apps/web/tests/p13-release-security.test.ts
U  apps/web/tests/p13-startup-powershell-resolver.test.ts
U  apps/web/tests/p13-startup-preflight.test.ts
U  apps/web/tests/p13-storage-delete-audit.test.ts
U  apps/web/tests/p13-storage-inventory.test.ts
U  apps/worker/scripts/build-secure.ts
U  apps/worker/scripts/start-secure.mjs
U  apps/worker/src/bootstrap.ts
U  apps/worker/src/security/startup-gate.ts
U  apps/worker/src/worker-entry.ts
U  apps/worker/tests/legacy-cleanup-shutdown.test.ts
U  apps/worker/tests/storage-capability.test.ts
U  apps/worker/tests/test-worker-entry.ts
U  docs/architecture/file-lifecycle-p13-c5-1-revision.md
U  docs/architecture/file-lifecycle-p13-c6-2-c2-decisions.md
U  docs/architecture/file-lifecycle-p13-c6-2-f-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-g-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-g-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-h-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-i-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-j-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-j-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-k-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-k-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l1-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l1-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l2-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l2-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l3-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l3-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l4-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l4-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l5-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l5-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l6-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l6-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l7-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l7-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a-admin-evidence-guide.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a2-local-inventory-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a3-risk-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a4-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a4-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a5-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a5-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a6-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a6-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-1-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-10-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-11-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-11-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-12-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-13-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-13-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-14-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-15-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-15-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-16-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-1-decision-closure.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-2-semantic-closure.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-3-final-closure.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-17-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-final-disposition.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-waiver-approval.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-2-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-authority-rpc-identity-implementation-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-implementation-and-validation-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r1-feasibility-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r1-native-rpc-toolchain-assessment.md
R2 docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r2-native-rpc-toolchain-provisioning-design.md
R2 docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r2-provisioning-readiness-report.md
R2 docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r2-r1-final-readiness-report.md
R2 docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r2-r1-native-rpc-installation-manifest.md
R2 docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r2-r2-reappeared-root-file-investigation.md
R2 docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r2-r3-exact-root-file-deletion-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-os-authority-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-r-independent-adversarial-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s1-p1-remediation-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s1-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s10-independent-adversarial-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s11-p2-remediation-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s11-r4-a-final-readiness-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s2-independent-adversarial-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s3-authority-remediation-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s3-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s4-independent-adversarial-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s5-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s5-windows-only-ipc-authority-remediation-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s6-independent-adversarial-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s7-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s7-windows-only-authority-sealing-remediation-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s8-independent-adversarial-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s9-implementation-readiness-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s9-warning-remediation-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-3-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-4-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-5-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-6-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-7-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-7-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-8-review.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-9-design.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-9-report.md
U  docs/architecture/file-lifecycle-p13-c6-2-l8a7-review.md
U  docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
U  docs/architecture/file-lifecycle-p13-design-freeze.md
U  docs/architecture/file-lifecycle-p13-implementation-status.md
U  packages/authority-core/package.json
U  packages/authority-core/src/identity.ts
U  packages/authority-core/src/index.ts
U  packages/authority-core/src/server.ts
U  packages/authority-core/src/session-store.ts
U  packages/authority-core/src/types.ts
U  packages/authority-core/tests/authority-identity.test.ts
U  packages/authority-core/tsconfig.build.json
U  packages/authority-core/tsconfig.json
U  packages/build-integrity/package.json
U  packages/build-integrity/src/index.d.ts
U  packages/build-integrity/src/index.mjs
U  packages/build-integrity/src/script-security.mjs
U  packages/build-integrity/src/startup-security.mjs
U  packages/file-storage/src/capabilities.ts
U  packages/file-storage/src/legacy-cleanup.ts
U  packages/file-storage/tests/capabilities.test.ts
U  prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql
U  prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/migration.sql
U  prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/migration.sql
```
