# P1-3 R6-BV8 — PFR Correction Traceability and Validation

## 0. Status

```text
Stage: R6-BV8
Mode: DESIGN CORRECTION / TRACEABILITY ONLY

Conclusion:
READY FOR INDEPENDENT REVIEW

Policy C implementation:
NOT AUTHORIZED

Build Gate:
UNCHANGED / FAIL-CLOSED

Tests executed:
NONE

Live PFR Registry Read:
NOT PERFORMED

Native Build / Runtime:
NOT EXECUTED

Git Writes:
NOT EXECUTED
```

This document traces every BV7 P1 and the two BV8-required P2 findings to the
corrected design, attack model, required evidence and independent-review
criteria. “Closed at design” does not mean implemented or verified.

## 1. Inputs and Baseline

Input hashes:

| Input | SHA-256 | Result |
|---|---|---|
| BV6 main | `6B23D81A99A34F5DD46CA06D2B1B9C4B310E4DAEA269BFFBED3610EA07700996` | MATCH |
| BV6 decisions | `DA1083B7E845D556DD21B5B09C3512673B850B63210045E4A7756BAF10F79A0D` | MATCH |
| BV7 review | `DEBE62222C03A07E3C430860013A173B1A62CEE446593C646895BFCB2A1FE480` | MATCH |

Git baseline:

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked: 261
Staged: 0
Deleted: 0
```

After two BV8 files, expected untracked count is 263.

## 2. BV7 Finding Closure Matrix

| Finding | BV8 decision | Design evidence | Implementation evidence | Status |
|---|---|---|---|---|
| P1-01 raw parser | Canonical V1 grammar and strict reject | Main §5 | Parser vectors not executed | CLOSED AT DESIGN |
| P1-02 prefix | No prefix recognized; hard rejection | Main §6 | Prefix profile unresolved | CLOSED AT DESIGN |
| P1-03 manifest trust | Root/KeySet/Bundle/Anchor chain | Main §7 | Keys/anchor not provisioned | CLOSED AT DESIGN |
| P1-04 path binding | Immutable ACL path boundary | Main §8 | ACL/path evidence absent | CLOSED AT DESIGN |
| P1-05 toolchain closure | Signed closure + inventory + observation | Main §9 | Inventory absent | CLOSED AT DESIGN |
| P1-06 build entry | Broker-only fixed plans + OS ACL | Main §10 | Broker/ACLs absent | CLOSED AT DESIGN |
| P2-01 RegRestoreKey | Explicit privileged out-of-scope boundary | Main §12 | No detection claim | CLOSED AT DESIGN |
| P2-02 watcher thread | Persistent non-thread-agnostic one-shot thread | Main §11 | Runtime test absent | CLOSED AT DESIGN |

Additional BV7 P2/P3 disposition:

| Finding | BV8 disposition |
|---|---|
| P2-03 evidence trust | Final publication is bound to Broker Build ID and signed Policy/Closure; evidence signature details remain implementation evidence |
| P2-04 invalidated artifacts | Broker stages artifacts and publishes only after full PASS |
| P2-05 post-snapshot scope | Build-window-only scope remains explicit; no reboot-wide claim |
| P3-01 size limit | Still requires measured justification before implementation |
| P3-02 design tests | Explicitly NOT EXECUTED |

## 3. P1-01 — Parser Traceability

### 3.1 Design checks

- Exact raw bytes and length are preserved.
- Type is `REG_MULTI_SZ`.
- No caller-supplied terminator is added to raw evidence.
- Empty list is exactly two NUL code units.
- One list terminator is removed for non-empty values.
- Body must end in an element terminator.
- Empty elements are not removed.
- Element count must be positive and even.
- Empty source is malformed.
- Empty destination is DELETE.
- Non-empty destination is RENAME.
- Odd bytes, missing/extra NULs, invalid UTF-16 and unconsumed bytes block.
- Error contains reason, offset, expected grammar and observed length.

### 3.2 Byte vector register

| Vector | Class | Expected |
|---|---|---|
| PV-01 `00 00 00 00` | legal boundary | zero operations |
| PV-02 `41 00 00 00 00 00 00 00` | legal | DELETE A |
| PV-03 `41 00 00 00 42 00 00 00 00 00` | legal | RENAME A→B |
| PV-04 `41 00 00 00 00 00 42 00 00 00 00 00 00 00` | legal multiple | DELETE A, DELETE B |
| PV-05 missing final terminator | malformed | block |
| PV-06 extra final terminator | malformed | block |
| PV-07 rename missing final | malformed | block |
| PV-08 rename destination unterminated | malformed | block |
| PV-09 empty source | malformed | block |
| PV-10 odd byte length | malformed | block |
| PV-11 one NUL | malformed | block |
| PV-12 only empty elements | malformed | block |
| PV-13 unpaired surrogate | malformed | block |

### 3.3 Required future tests

| Test ID | Setup | Expected |
|---|---|---|
| B8-PARSE-01 | Empty canonical value | zero ops |
| B8-PARSE-02 | One DELETE | one op and exact offsets |
| B8-PARSE-03 | One RENAME | source/destination exact |
| B8-PARSE-04 | Mixed operations | order and pair count exact |
| B8-PARSE-05 | Duplicate sources | duplicates retained |
| B8-PARSE-06 | Last DELETE | final terminator handled |
| B8-PARSE-07 | Two deletes | empty destinations retained |
| B8-PARSE-08 | Truncated tail | BLOCKED |
| B8-PARSE-09 | Extra NUL | BLOCKED |
| B8-PARSE-10 | Odd bytes | BLOCKED |
| B8-PARSE-11 | Invalid surrogate | BLOCKED |
| B8-PARSE-12 | Fractional operation | BLOCKED |
| B8-PARSE-13 | Unknown prefix | BLOCKED |
| B8-PARSE-14 | Offset bijection | every byte accounted once |

## 4. P1-02 — Prefix Traceability

### 4.1 Evidence

- Microsoft MoveFileExW does not define `*1` or `*2`.
- Installed Windows SDK and MSVC static search found no definition.
- BV5 historical values use these prefixes.
- No authoritative mapping exists in reviewed project evidence.

### 4.2 Corrected behavior

```text
Known prefixes = none
Pattern-detected *N\ records = UNKNOWN_MODIFIER
Decision = BLOCKED_UNKNOWN_PREFIX
Suffix path resolution = prohibited
Manifest override = prohibited
Operator override = prohibited
```

### 4.3 Current candidate impact

```text
historical 46/23: BLOCKED
old 38/19: BLOCKED
BV5 current 38/19: BLOCKED
```

No historical state is approved or changed.

### 4.4 Required future tests

| Test ID | Input | Expected |
|---|---|---|
| B8-PREFIX-01 | `*1\??\A` | BLOCKED_UNKNOWN |
| B8-PREFIX-02 | `*2\??\A` | BLOCKED_UNKNOWN |
| B8-PREFIX-03 | `*9\??\A` | BLOCKED_UNKNOWN |
| B8-PREFIX-04 | malformed prefix | MALFORMED |
| B8-PREFIX-05 | unprefixed valid path | prefix layer passes to path parser |
| B8-PREFIX-06 | future approved profile | accepted only with matching policy profile hash |

## 5. P1-03 — Trust Traceability

### 5.1 Trust assertions

- Root public key is external to the mutable repository.
- Key Set is root-signed.
- Policy Bundle is signer-signed.
- Approval Record is approver-signed.
- Proposer, signer and approver are distinct roles.
- Trust Anchor is admin-provisioned and Broker-read-only.
- Manifest covers all mandatory categories.
- Bundle generation and prior hash prevent rollback.
- Revocation generation invalidates old signatures.
- Expired bundle/key fails closed.
- Missing trust material fails closed.

### 5.2 Attack register

| Attack | Expected result |
|---|---|
| Self-signed manifest | BLOCKED |
| Public key in writable repo | BLOCKED |
| Omit project root | BLOCKED |
| Omit mandatory category | BLOCKED |
| Same generation different bytes | BLOCKED |
| Generation rollback | BLOCKED |
| Old signed bundle replay | BLOCKED |
| Revoked signer | BLOCKED |
| Expired bundle | BLOCKED |
| Anchor unavailable | BLOCKED |
| Proposer approves own bundle | BLOCKED |

### 5.3 Required future tests

| Test ID | Requirement |
|---|---|
| B8-TRUST-01 | root fingerprint pin |
| B8-TRUST-02 | Key Set signature and generation |
| B8-TRUST-03 | signer/approver role separation |
| B8-TRUST-04 | mandatory category completeness |
| B8-TRUST-05 | prior-bundle hash chain |
| B8-TRUST-06 | same-generation collision |
| B8-TRUST-07 | rollback |
| B8-TRUST-08 | revocation |
| B8-TRUST-09 | expiry |
| B8-TRUST-10 | rotation |
| B8-TRUST-11 | root compromise ceremony |
| B8-TRUST-12 | Trust Anchor ACL |

## 6. P1-04 — Immutable Path Traceability

### 6.1 Selected architecture

The design does not claim a persistent cross-reboot file handle. It uses:

```text
approved local volume
+ non-reparse complete path
+ immutable ancestor ACL
+ existing source File ID
+ approved destination parent
+ untrusted identities unable to replace namespace
```

### 6.2 Attack register

| Attack | Expected result |
|---|---|
| DOS path in mutable temp | BLOCKED if untrusted can replace |
| UNC | BLOCKED |
| ADS | BLOCKED |
| relative/env path | BLOCKED |
| unknown device path | BLOCKED |
| Junction/symlink | BLOCKED |
| mount point alias | BLOCKED unless separately proven |
| missing DELETE source | BLOCKED |
| missing RENAME destination with immutable parent | eligible after all checks |
| hard link to protected object | FAIL/BLOCKED |
| different volume same suffix | no conflict only after both volumes resolve |
| same File ID different name | FAIL/BLOCKED |
| drive remap by untrusted | impossible under boundary; admin excluded |
| ACL changes after Gate | watcher/ACL health invalidates or blocks |

### 6.3 Required future tests

| Test ID | Requirement |
|---|---|
| B8-PATH-01 | ordinary immutable DOS path |
| B8-PATH-02 | non-existent destination under immutable parent |
| B8-PATH-03 | missing source rejected |
| B8-PATH-04 | UNC/ADS/relative rejected |
| B8-PATH-05 | Junction/symlink/mount rejected |
| B8-PATH-06 | hard-link identity |
| B8-PATH-07 | volume GUID/device path |
| B8-PATH-08 | different volume same suffix |
| B8-PATH-09 | 8.3/long path |
| B8-PATH-10 | case behavior |
| B8-PATH-11 | parent ACL denies replacement |
| B8-PATH-12 | parent ACL permits replacement |
| B8-PATH-13 | path changes during inspection |
| B8-PATH-14 | drive mapping |

## 7. P1-05 — Toolchain Closure Traceability

### 7.1 Complete coverage requirements

The closure includes:

- MIDL/CL/LINK/DUMPBIN;
- compiler/linker helpers and subprocesses;
- preprocessors and code generators;
- PE imports, delay imports and ordinary DLLs;
- CRT and system modules;
- Windows SDK include/library files;
- SxS components;
- response files;
- scripts;
- environment and search paths;
- temporary/working directories;
- conditional/runtime-loaded modules.

### 7.2 Closure attacks

| Attack | Expected result |
|---|---|
| replace tool executable | BLOCKED |
| replace private DLL | BLOCKED |
| inject PATH directory | BLOCKED |
| inherit malicious environment | BROKER STRIPS/BLOCKS |
| undeclared helper process | INVALIDATED/UNKNOWN |
| delayed-load unknown DLL | INVALIDATED/UNKNOWN |
| response file injected | BLOCKED |
| unlisted include/library | BLOCKED |
| observation unavailable | UNKNOWN |
| closure manifest expired/rolled back | BLOCKED |

### 7.3 Required future tests

| Test ID | Requirement |
|---|---|
| B8-TOOL-01 | direct tool import closure |
| B8-TOOL-02 | delay-load closure |
| B8-TOOL-03 | private helper process |
| B8-TOOL-04 | system module identity |
| B8-TOOL-05 | SDK/MSVC include/lib closure |
| B8-TOOL-06 | environment allowlist |
| B8-TOOL-07 | PATH/search order |
| B8-TOOL-08 | response file binding |
| B8-TOOL-09 | unexpected module during build |
| B8-TOOL-10 | closure replacement |
| B8-TOOL-11 | closure observation loss |
| B8-TOOL-12 | post-build closure recheck |

Inventory execution is not authorized in BV8.

## 8. P1-06 — Build Entry Traceability

### 8.1 Entry attacks

| Attack | Required result |
|---|---|
| `pnpm build` Native invocation | No Native tools executed |
| direct `cl.exe` by developer | OS ACL denies execute |
| direct `link.exe` by developer | OS ACL denies execute |
| direct `midl.exe` by developer | OS ACL denies execute |
| arbitrary arguments to Broker | rejected |
| copied build script | no Build ID/evidence |
| old Build ID replay | rejected |
| Build process escapes Job | Broker invalidates |
| PFR event during build | no final artifact publication |
| post-snapshot failure | no final artifact publication |
| evidence missing | no PASS/publication |

### 8.2 Required future tests

| Test ID | Requirement |
|---|---|
| B8-ENTRY-01 | root pnpm does not invoke Native |
| B8-ENTRY-02 | Broker request authentication |
| B8-ENTRY-03 | caller/build-plan allowlist |
| B8-ENTRY-04 | arbitrary tool path rejected |
| B8-ENTRY-05 | arbitrary arguments rejected |
| B8-ENTRY-06 | direct compiler ACL denied |
| B8-ENTRY-07 | direct linker ACL denied |
| B8-ENTRY-08 | direct MIDL ACL denied |
| B8-ENTRY-09 | Build ID uniqueness/replay |
| B8-ENTRY-10 | Build Job ownership |
| B8-ENTRY-11 | PFR invalidation withholds publication |
| B8-ENTRY-12 | evidence/publication binding |

## 9. P2-A/B Traceability

### P2-A RegRestoreKey

```text
Detection claim: NOT MADE
Required privileges: SE_BACKUP_NAME and SE_RESTORE_NAME
Trust boundary: privileged restore explicitly out of scope
Build identity rule: must not hold those privileges
Final-value change: caught by exact post snapshot
Transient restore-and-revert: acknowledged residual
```

Test IDs:

```text
B8-RESTORE-01 verify build identity lacks backup/restore privileges
B8-RESTORE-02 privileged restore final-value difference caught
B8-RESTORE-03 restore-and-revert documented as undetected/out-of-scope
```

### P2-B Watcher lifecycle

```text
Thread: dedicated persistent OS thread
Thread-agnostic flag: prohibited
Event: manual-reset, non-inheritable
Registration: before first PFR read
First notification: INVALIDATED
Reset/rearm: prohibited
Thread exit/handle failure: UNKNOWN/BLOCKED
```

Test IDs:

```text
B8-WATCH-01 no change, stable build
B8-WATCH-02 registration failure
B8-WATCH-03 notification before snapshot
B8-WATCH-04 notification during parse
B8-WATCH-05 notification during build
B8-WATCH-06 notification before post snapshot
B8-WATCH-07 change-and-restore
B8-WATCH-08 other key value change
B8-WATCH-09 thread exit
B8-WATCH-10 handle closure
B8-WATCH-11 wait error
B8-WATCH-12 host crash
B8-WATCH-13 build success with event
B8-WATCH-14 monitor loss with equal snapshots
```

## 10. Cross-Problem Validation

| Check | Evidence | Result |
|---|---|---|
| Parser feeds prefix | Main §5.4 step 10 | DESIGN PASS |
| Unknown prefix blocks path resolution | Main §6.3 | DESIGN PASS |
| Manifest covers project/ancestors/toolchain | Main §7.6 | DESIGN PASS |
| Toolchain closure bound to Broker plan | Main §9–10 | DESIGN PASS |
| Path identity covered through deferred window | Main §8 | DESIGN PASS |
| Watcher armed before read | Main §11 | DESIGN PASS |
| Event makes transaction non-publishable | Main §13 | DESIGN PASS |
| Manifest generation bound to evidence | Main §7, §10 | DESIGN PASS |
| Unknowns fail closed | Main §§5–14 | DESIGN PASS |
| R4/R5 authority unchanged | Main §15 | DESIGN PASS |

## 11. Remaining Open Evidence

```text
OPEN-01 PFR parser implementation and byte-vector execution
OPEN-02 Prefix semantics for `*1`/`*2`
OPEN-03 Policy root, signer, approver and revocation keys
OPEN-04 External Trust Anchor provisioning and ACL
OPEN-05 Immutable Path Boundary ACL evidence
OPEN-06 Approved volume/namespace inventory
OPEN-07 Complete toolchain closure evidence
OPEN-08 Build Broker binary/service identity
OPEN-09 Compiler execution ACL
OPEN-10 Process/image/file closure observation
OPEN-11 PFR Gate implementation and evidence schema
OPEN-12 Target-version watcher/restore evidence
```

These remain blockers for implementation, not for this design review.

## 12. Future Independent Review Checklist

The next independent reviewer must:

1. Attempt to reject PV-01 through PV-13.
2. Determine whether the canonical grammar can still be misunderstood.
3. Attempt unknown-prefix bypass.
4. Attack Trust Anchor rollback, same generation, revocation and key rotation.
5. Test mandatory coverage omission.
6. Attack immutable ACL assumptions and deferred path resolution.
7. Attempt direct compiler invocation and Broker bypass.
8. Audit toolchain closure completeness and search order.
9. Attack watcher lifecycle and change-and-restore.
10. Confirm `RegRestoreKey` is excluded explicitly.
11. Verify no R4/R5 Runtime authority is expanded.
12. Verify no current baseline or PFR exception is approved.
13. Keep implementation disabled until all evidence is closed.

## 13. Decision Change Register

| ID | Prior decision | BV8 correction |
|---|---|---|
| D-PFR-12 | Raw terminator form open | Fixed canonical grammar; all others block |
| D-PFR-13 | Prefix semantics open | All prefixes unknown/blocked |
| D-PFR-16 | Trust architecture open | Root/KeySet/Bundle/Anchor design |
| D-PFR-18/20 | Identity resolver only | Immutable ACL namespace and absent-source rejection |
| D-PFR-17 | Toolchain closure open | Signed closure manifest and observation plan |
| D-PFR-31 | Build integration open | Broker-only fixed plans and OS ACL |
| D-PFR-23/24 | Watcher semantics incomplete | Persistent one-shot non-thread-agnostic thread |
| D-PFR-35 | Admin/system boundary | Explicit RegRestoreKey limitation |
| D-PFR-04 | Current candidate not approved | Remains not approved and now prefix-blocked |

## 14. Side Effects

```text
Live PFR read: NO
Registry write: NO
PFR write/clear: NO
Build Gate change: NO
Source/IDL/test change: NO
MIDL/CL/LINK/DUMPBIN: NO
Native Build: NO
Native Runtime: NO
Database: NO
Storage: NO
ACL/Service/IAM: NO
$null access: NO
Git write: NO
```

Only the two files in `docs/architecture/r6-bv8-pfr-policy-corrections/` were
added.
