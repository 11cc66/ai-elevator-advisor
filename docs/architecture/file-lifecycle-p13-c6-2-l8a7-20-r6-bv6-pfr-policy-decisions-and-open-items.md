# P1-3 C-6.2-L8-A7.20-R6-BV6
# PFR Policy Decisions and Open Items

## 0. Purpose and Status

This companion register separates:

- historical facts;
- proposed design decisions;
- assumptions that still require evidence;
- decisions requiring independent review;
- items that remain blocked;
- authorization status.

No decision below approves current PFR 38/19, creates a PFR exception, changes a
Build Gate, or authorizes implementation.

Default status vocabulary:

```text
HISTORICAL FACT
PROPOSED — REQUIRES INDEPENDENT REVIEW
OPEN — REQUIRES INDEPENDENT REVIEW
BLOCKED — EVIDENCE MISSING
NOT APPLICABLE
NOT AUTHORIZED
```

Default implementation authorization:

```text
NONE
```

## 1. Security and Baseline Decisions

### D-PFR-01 — Role of Fixed Global Exact Hash

```text
Decision ID:
D-PFR-01

Topic:
Fixed global PFR SHA-256 policy

Proposed Decision:
Retain the historical 46/23 exact digest as a forensic/history identifier and
regression comparator, not as the permanent per-build availability policy.

Security Rationale:
Exact hashing detects all logical array/order changes and has no parser attack
surface. Its use must remain limited because unrelated Windows activity changes
PFR and creates false blocking.

Alternatives:
- Continue permanent fixed hash.
- Accept arbitrary current hash.
- Parse only counts.

Dependencies:
- BV5 historical evidence.
- Current build-script call sites.

Required Evidence:
- Independent review acceptance that history recognition is not baseline
  authorization.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-02 — Role of Explicit Snapshot Exception

```text
Decision ID:
D-PFR-02

Topic:
Explicit exact-snapshot exception

Proposed Decision:
Allow only as a separately approved, single-use, expiring emergency state, with
exact raw bytes, type, machine identity and Build ID.

Security Rationale:
It proves an exact approved state but not build-window continuity or path-safe
semantics.

Alternatives:
- Reuse old 38/19 count exception.
- Approve by SHA only.
- Never permit an exact exception.

Dependencies:
- Snapshot schema.
- Build ID/replay controls.
- Independent authority.

Required Evidence:
- Exact scope and rollback/expiry design approved.
- Current candidate separately reviewed.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-03 — Dynamic Policy Selection

```text
Decision ID:
D-PFR-03

Topic:
Controlled Dynamic PFR Baseline

Proposed Decision:
Adopt as the recommended future policy, conditional on closing parser,
prefix, manifest-trust and toolchain-closure blockers.

Security Rationale:
It evaluates the exact current queue per build and adds continuous notification
and exact post-comparison without agreeing to permanent global state.

Alternatives:
- Policy A only.
- Policy B only.
- No PFR gate.

Dependencies:
- D-PFR-04 through D-PFR-20.

Required Evidence:
- BV7 independent adversarial review.
- Implementation design closure.

Approval Status:
CONDITIONALLY RECOMMENDED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-04 — Current 38/19 Candidate

```text
Decision ID:
D-PFR-04

Topic:
Current PFR candidate

Proposed Decision:
Keep it as CANDIDATE ONLY and do not inherit the old 38/19 exception.

Security Rationale:
The current and historical values share counts but not content or digest.

Alternatives:
- Treat equal counts as approval.
- Update the old exception in place.
- Restore the historical queue.

Dependencies:
- BV5 evidence.
- Policy B exact-snapshot controls if ever considered.

Required Evidence:
- Separate explicit approval.
- Current exact raw state captured under an authorized future phase.

Approval Status:
NOT APPROVED

Implementation Authorization:
NONE
```

### D-PFR-05 — Gate Read-Only Boundary

```text
Decision ID:
D-PFR-05

Topic:
PFR mutation authority

Proposed Decision:
The gate has no mutation path and can only open query/notify handles and create
evidence files outside the registry.

Security Rationale:
A security gate that repairs its own input can erase evidence and create a
confused-deputy cleanup path.

Alternatives:
- Auto-clear known safe items.
- Rebuild PFR before build.
- Modify PFR after detection.

Dependencies:
- Code review of allowed Win32 imports.
- Least-privilege access mask.

Required Evidence:
- Static import/API review.
- Negative tests for KEY_SET_VALUE and write APIs.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

## 2. Snapshot Decisions

### D-PFR-06 — Raw Byte Authority

```text
Decision ID:
D-PFR-06

Topic:
Snapshot authority

Proposed Decision:
Exact raw bytes plus exact byte length and REG_MULTI_SZ type are authoritative.
SHA-256 is an index and auxiliary equality check.

Security Rationale:
A hash cannot prove that the stored evidence was complete or correctly typed.

Alternatives:
- Hash only.
- PowerShell logical string array only.
- Parsed operations only.

Dependencies:
- RegQueryValueExW exact-buffer design.
- Evidence store.

Required Evidence:
- Tests with same hash/length manipulation, type mismatch and truncated buffer.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-07 — Stable Double Read

```text
Decision ID:
D-PFR-07

Topic:
Initial-read consistency

Proposed Decision:
Require two complete reads with identical type, length and bytes, with the
watcher armed, before accepting a pre-snapshot.

Security Rationale:
Registry query does not provide an atomic snapshot. A second read reduces
silent torn-read risk; the notification event remains authoritative for
detecting changes during and after the read.

Alternatives:
- Single read.
- Retry until size stabilizes without byte comparison.
- Before/after build reads only.

Dependencies:
- Watcher ordering.
- Bounded retry policy.

Required Evidence:
- Size-change and same-size-content-change tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-08 — Missing/Empty/Wrong Type

```text
Decision ID:
D-PFR-08

Topic:
Snapshot state distinction

Proposed Decision:
Value absent, present-empty, zero-length invalid, wrong type and read failure are
distinct states. Absence and invalid zero length block.

Security Rationale:
Silently mapping multiple states to an empty safe queue can turn an access or
format failure into authorization.

Alternatives:
- Treat all empty/absent states as zero operations.
- Use previous hash.

Dependencies:
- Snapshot schema.

Required Evidence:
- Registry fixture tests for each state.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-09 — Size Limit

```text
Decision ID:
D-PFR-09

Topic:
Snapshot resource limit

Proposed Decision:
Set policy v1 maximum raw PFR bytes to 1,048,576; exceeding the limit blocks.

Security Rationale:
Bounds parser, resolver and evidence resource consumption.

Alternatives:
- No limit.
- 64 KiB.
- Dynamic limit based only on current value.

Dependencies:
- Parser operation-count budget.
- Evidence storage budget.

Required Evidence:
- Independent review accepts the limit.
- Boundary/performance tests.

Approval Status:
OPEN — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-10 — Evidence Redaction and Retention

```text
Decision ID:
D-PFR-10

Topic:
Raw PFR evidence storage

Proposed Decision:
Store exact bytes in protected build evidence with restrictive ACLs; ordinary
logs contain identifiers, counts, hashes and verdicts, not all system paths.

Security Rationale:
Exact comparison requires raw bytes, while broad path disclosure in routine
logs is unnecessary.

Alternatives:
- Put all paths in ordinary logs.
- Store only hash.
- Store nothing.

Dependencies:
- Evidence-store ACL design.
- Retention and access authority.

Required Evidence:
- Data classification and evidence ACL approval.

Approval Status:
OPEN — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

## 3. Parser Decisions

### D-PFR-11 — No Generic String Split

```text
Decision ID:
D-PFR-11

Topic:
PFR parser structure

Proposed Decision:
Use a versioned raw-byte parser with path-preserving operation records; prohibit
shell splitting, duplicate removal, repair and per-operation skipping.

Security Rationale:
Generic multi-string handling can lose empty destinations and expose parser
confusion.

Alternatives:
- PowerShell array split.
- .NET MultiString helper alone.
- Regex extraction.

Dependencies:
- Raw terminator specification.

Required Evidence:
- Parser vectors and negative tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-12 — Raw Terminator Form

```text
Decision ID:
D-PFR-12

Topic:
Exact REG_MULTI_SZ/PFR byte boundaries

Proposed Decision:
Accept only independently proven canonical raw terminator forms. Any ambiguous
or extra terminator form blocks parsing.

Security Rationale:
The reviewed official documentation defines conceptual delete/rename forms but
does not fully enumerate byte-level combinations around final operations and
registry list termination.

Alternatives:
- Infer boundaries from NUL count.
- Trust one helper implementation.
- Accept best-effort parsing.

Dependencies:
- Official-document interpretation.
- Controlled fixture evidence from supported Windows builds.

Required Evidence:
- Byte-level vector matrix for delete/rename sequences and final terminators.
- Independent parser review.

Approval Status:
OPEN — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
BLOCKED
```

### D-PFR-13 — Unknown Modifier Prefix

```text
Decision ID:
D-PFR-13

Topic:
`*1\??\` and `*2\??\` PFR prefixes

Proposed Decision:
Classify as UNKNOWN_MODIFIER and block until authoritative semantics and
conversion rules are approved.

Security Rationale:
The reviewed Microsoft API pages do not define these prefixes. Stripping them
by string pattern would make path classification unproven.

Alternatives:
- Strip `*N` and treat the remainder as a path.
- Treat prefixes as non-security metadata.

Dependencies:
- Authoritative documentation or independently validated platform evidence.
- Parser/path resolver integration design.

Required Evidence:
- Source-backed semantics.
- Positive/negative fixtures.

Approval Status:
OPEN — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
BLOCKED
```

### D-PFR-14 — Empty Destination Semantics

```text
Decision ID:
D-PFR-14

Topic:
DELETE representation

Proposed Decision:
Only an empty destination element recognized by the approved raw parser denotes
DELETE. Empty destinations are never collapsed or skipped.

Security Rationale:
Official MoveFileEx documentation defines null destination as delete, and
empty-element loss is a parser-confusion threat.

Alternatives:
- Delete when destination string length is zero after trimming.
- Drop empty strings and pair remaining.

Dependencies:
- Raw parser.

Required Evidence:
- Single, multiple and final-delete vectors.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

## 4. Manifest Decisions

### D-PFR-15 — Protected Path Categories

```text
Decision ID:
D-PFR-15

Topic:
Protected path categories

Proposed Decision:
Protect the entire project tree, exact six protected objects, `$null`, Harness
source/evidence/output trees, exact toolchain roots, approved system dependency
identities and build temporary roots.

Security Rationale:
Project-tree protection closes ancestor/descendant bypasses; toolchain closure
protects compilation prerequisites.

Alternatives:
- Protect only six files.
- Protect only `tools/native-rpc`.
- Use substring matching.

Dependencies:
- Manifest schema and trust root.
- Toolchain closure inventory.

Required Evidence:
- Independent list completeness review.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-16 — Manifest Trust Root and Rollback

```text
Decision ID:
D-PFR-16

Topic:
Manifest authority

Proposed Decision:
Require deterministic encoding, external/hash-pinned trust, approval authority,
monotonic generation, expiry and explicit rejection of rollback/replay.

Security Rationale:
An unsigned mutable path list can authorize deletion of omitted protected paths.

Alternatives:
- In-repo JSON only.
- Reuse release manifest without separate approval.
- Operator-selected paths.

Dependencies:
- Trust-root selection.
- Approval workflow.
- Evidence/audit store.

Required Evidence:
- Signed/hash-pinned manifest design approved.
- Rollback and expiry tests.

Approval Status:
OPEN — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
BLOCKED
```

### D-PFR-17 — Toolchain Closure

```text
Decision ID:
D-PFR-17

Topic:
Complete build toolchain dependency set

Proposed Decision:
Use exact approved identities for MIDL, CL, LINK, DUMPBIN, SDK/MSVC
inputs/libraries and a reviewed dependency closure. Unknown dependency identity
blocks.

Security Rationale:
Pinning only executable names ignores replacement or planned deletion of loaded
dependencies.

Alternatives:
- Protect only compiler executables.
- Assume System32 is irrelevant.
- Protect all of C:\Windows.

Dependencies:
- Approved static import inventory.
- Approved runtime module inventory method.

Required Evidence:
- Independent toolchain closure evidence.

Approval Status:
OPEN — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
BLOCKED
```

## 5. Path Resolver Decisions

### D-PFR-18 — Identity-Based Path Resolution

```text
Decision ID:
D-PFR-18

Topic:
Path comparison basis

Proposed Decision:
Use namespace, volume identity, normalized final path and existing File ID.
Text prefix is never sufficient.

Security Rationale:
Aliases, hard links, links, devices and case differences defeat substring
checks.

Alternatives:
- StringStartsWith.
- Normalize case only.
- Compare only `jieya`.

Dependencies:
- D-PFR-19 and D-PFR-20.

Required Evidence:
- Path resolver vector suite.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-19 — Existing Objects

```text
Decision ID:
D-PFR-19

Topic:
Existing source/destination identity

Proposed Decision:
Open with read attributes only, share normally, non-following final component,
and record volume GUID/serial, File ID, object type, final path and reparse
state.

Security Rationale:
Proves object identity independently of a single textual path.

Alternatives:
- `GetFullPathName` only.
- File name equality.

Dependencies:
- Path resolver implementation.
- Error mapping.

Required Evidence:
- Hard-link, junction, symlink, mount and identity tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-20 — Non-existent Objects

```text
Decision ID:
D-PFR-20

Topic:
Missing path resolution

Proposed Decision:
Resolve the nearest existing ancestor through a non-following handle hierarchy,
canonicalize only the missing tail, and block if any component or alias remains
ambiguous.

Security Rationale:
A missing target can reappear before reboot; path text cannot be trusted alone.

Alternatives:
- Compare raw text.
- Treat missing paths as safe.
- Use only parent string.

Dependencies:
- D-PFR-18/19.

Required Evidence:
- Missing parent, reparse-race and alias tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-21 — Unsupported Namespaces

```text
Decision ID:
D-PFR-21

Topic:
UNC, ADS, relative and unknown namespaces

Proposed Decision:
Block UNC, ADS, relative, unexpanded environment-variable and unknown device
namespaces. Block unresolved aliases rather than continue.

Security Rationale:
The policy is for local NTFS tools; unresolved namespaces cannot support a
trustworthy identity comparison.

Alternatives:
- Expand variables.
- Best-effort normalize.
- Treat unresolved as non-conflict.

Dependencies:
- Namespace classification.

Required Evidence:
- Negative namespace suite.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

## 6. Conflict and Window Decisions

### D-PFR-22 — Conflict Precedence

```text
Decision ID:
D-PFR-22

Topic:
Protected-path conflict

Proposed Decision:
Any exact, ancestor, descendant, File ID or alias conflict blocks the whole
build. One operation cannot be waived while others continue.

Security Rationale:
PFR operates at reboot and one missed delete/rename can destroy protected state.

Alternatives:
- Warn-only conflict.
- Operator override.
- Ignore unrelated project paths.

Dependencies:
- Manifest and resolver.

Required Evidence:
- Full conflict matrix tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-23 — Key-Level Notification

```text
Decision ID:
D-PFR-23

Topic:
Change notification semantics

Proposed Decision:
Watch the entire Session Manager key with REG_NOTIFY_CHANGE_LAST_SET and treat
any notification as INVALIDATED for this attempt.

Security Rationale:
The API does not offer a value-specific notification or writer identity; a
conservative Key event avoids a false-negative alternative.

Alternatives:
- Poll after build only.
- Ignore non-PFR value events.
- Infer writer from event.

Dependencies:
- Native watcher implementation.

Required Evidence:
- Watcher tests and API review.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-24 — Watcher Lifetime

```text
Decision ID:
D-PFR-24

Topic:
Watcher ordering and lifetime

Proposed Decision:
Arm before initial read and keep armed through post-snapshot completion. Do not
reset/rearm after notification.

Security Rationale:
Before/after reads alone cannot detect change-and-restore.

Alternatives:
- Snapshot then subscribe.
- Reset and retry after event.
- Monitor only during compiler execution.

Dependencies:
- State machine.

Required Evidence:
- Change-before/read, during-build and change-restore tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-25 — Monitor Loss

```text
Decision ID:
D-PFR-25

Topic:
Monitor uncertainty

Proposed Decision:
Watcher thread crash, handle loss, unexpected wait state or host restart makes
the attempt UNKNOWN. It cannot become PASS.

Security Rationale:
Missing monitoring evidence is not evidence of no change.

Alternatives:
- Restart watcher and continue.
- Use before/after equality as fallback.
- Treat monitor failure as warning.

Dependencies:
- State machine.
- Evidence schema.

Required Evidence:
- Failure-injection tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-26 — TOCTOU Boundary

```text
Decision ID:
D-PFR-26

Topic:
Atomicity between final check and build launch

Proposed Decision:
Do not claim an atomic lock. Use pre-armed notification, a final zero-time
check, Build Start Intent binding and invalidate on any observed notification.

Security Rationale:
Windows registry notification cannot atomically lock build process creation.

Alternatives:
- Claim TOCTOU-free launch.
- Add a new global mutex that does not block PFR writers.
- Require LocalSystem token.

Dependencies:
- Build launcher integration.

Required Evidence:
- Race and adversarial review.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-27 — Build Cancellation

```text
Decision ID:
D-PFR-27

Topic:
Notification after build starts

Proposed Decision:
Mark INVALIDATED and request cooperative cancellation through existing process
architecture. Do not add termination authority or claim guaranteed prevention.

Dependencies:
- R4/R5 process architecture.

Security Rationale:
Gate correctness requires withholding downstream acceptance, not inventing new
OS authority.

Alternatives:
- Terminate with broad rights.
- Let build complete and accept output.

Required Evidence:
- Cancellation/failure integration review.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-28 — Manual Override Prohibition

```text
Decision ID:
D-PFR-28

Topic:
Operator override

Proposed Decision:
No manual override for parser, manifest, monitor, change-notification or path
conflict. A new complete attempt is required.

Security Rationale:
An override turns all structural controls into advisory warnings.

Alternatives:
- Administrator checkbox.
- `--force`.
- Environment variable.

Dependencies:
- CLI/launcher design.

Required Evidence:
- Negative CLI/API tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

## 7. Evidence and Integration Decisions

### D-PFR-29 — Build ID and Replay Binding

```text
Decision ID:
D-PFR-29

Topic:
Snapshot binding

Proposed Decision:
Bind snapshot to Build ID, Gate Invocation ID, machine identity, Windows build,
policy version and manifest generation/hash. Replay or crossed Build ID blocks.

Security Rationale:
Prevents a previous successful snapshot from authorizing a different build.

Alternatives:
- Path-based evidence identity.
- Timestamp only.
- Operator-entered Build ID only.

Dependencies:
- Build launcher identity.
- Evidence store.

Required Evidence:
- Replay/cross-build tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-30 — Evidence Persistence

```text
Decision ID:
D-PFR-30

Topic:
Durable gate evidence

Proposed Decision:
Pre-snapshot, manifest validation, parser/path decisions, watcher health,
Build ID, exit code, post-snapshot and final verdict form one append-only
evidence bundle.

Security Rationale:
A verdict without complete raw evidence cannot be independently reviewed.

Alternatives:
- Console output only.
- Summary hash only.
- Mutable JSON updated in place.

Dependencies:
- Evidence storage design.

Required Evidence:
- Integrity and persistence failure tests.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-31 — Build Gate Integration Point

```text
Decision ID:
D-PFR-31

Topic:
Where the policy gate executes

Proposed Decision:
The approved Harness build entry must invoke the PFR gate before compilation
and must consume the same gate invocation through post-snapshot. Build completion
cannot be accepted if the PFR verdict is not available.

Security Rationale:
A separate advisory script can be bypassed by calling the compiler directly.

Alternatives:
- Keep PFR checking as a manually invoked advisory script.
- Check only after compilation.
- Integrate only into one historical build script.

Dependencies:
- Exact implementation source/exe path.
- Signing/trust decision.
- R5-R3A authorization.

Required Evidence:
- Entry-point and bypass review.

Approval Status:
OPEN — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-32 — Current Build Scripts

```text
Decision ID:
D-PFR-32

Topic:
Existing fixed-hash call sites

Proposed Decision:
Keep `build.ps1`, `build-b4.ps1` and static verifiers unchanged until a
separate implementation phase is authorized.

Security Rationale:
Premature edits would create an unreviewed policy implementation and could
accidentally relax fail-closed behavior.

Alternatives:
- Patch one script now.
- Add an environment override.
- Delete the old checks.

Dependencies:
- BV7 review.
- Implementation authorization.

Required Evidence:
- BV6 completion and later independent review.

Approval Status:
HISTORICAL CURRENT STATE / MUST REMAIN

Implementation Authorization:
NONE
```

### D-PFR-33 — PFR Gate vs Release/Startup Gate

```text
Decision ID:
D-PFR-33

Topic:
Relationship to production Startup Gate and signed release manifest

Proposed Decision:
PFR policy is a Windows build-host preflight control. It is not a substitute
for signed release identity, Startup Gate, Source Tree Digest, Artifact Digest,
runtime dependency closure or six protected-object hashes.

Security Rationale:
The approval of build-host transient state cannot authenticate a release.

Alternatives:
- Treat PFR PASS as release attestation.
- Put PFR policy solely in startup code.

Dependencies:
- Existing build-integrity design.

Required Evidence:
- Architecture cross-consistency review.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-34 — Future Reboot Boundary

```text
Decision ID:
D-PFR-34

Topic:
PFR changes after build PASS

Proposed Decision:
State explicitly that a build-window PASS does not protect the next reboot from
later PFR changes. A separate reboot-time control is out of scope.

Security Rationale:
Prevents the gate from claiming system-wide future safety it cannot observe.

Alternatives:
- Claim permanent host safety.
- Clear PFR after build.

Dependencies:
- Threat model.

Required Evidence:
- Independent threat-model acceptance.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

### D-PFR-35 — Admin/SYSTEM Trust Boundary

```text
Decision ID:
D-PFR-35

Topic:
Trust boundary

Proposed Decision:
Explicitly exclude Local Administrator, SYSTEM, kernel, Codex-host or policy
binary compromise from the PFR gate's protection claim.

Security Rationale:
Such an actor can modify PFR, watcher state, memory and evidence.

Alternatives:
- Claim host-attestation semantics.
- Add a self-signed manifest only.

Dependencies:
- Threat model approval.

Required Evidence:
- Independent review confirms limitations are explicit.

Approval Status:
PROPOSED — REQUIRES INDEPENDENT REVIEW

Implementation Authorization:
NONE
```

## 8. Scope and Next-Gate Decisions

### D-PFR-36 — D1 and R5-R3A

```text
Decision ID:
D-PFR-36

Topic:
Frozen design and Build-only scope

Proposed Decision:
Preserve D1 v1 and R5-R3A boundaries. Do not add D1 v2 symbols or expand
R5-R3A source/build scope through this policy.

Security Rationale:
Prevents an infrastructure policy from silently expanding the Native RPC TCB.

Alternatives:
- Implement policy inside D1 v2.
- Add Runtime behavior to R5-R3A.

Dependencies:
- R7/R8 reviews.
- D1 freeze.

Required Evidence:
- Future implementation review.

Approval Status:
HISTORICAL FACT / MUST REMAIN

Implementation Authorization:
NONE
```

### D-PFR-37 — Linux

```text
Decision ID:
D-PFR-37

Topic:
Cross-platform implementation

Proposed Decision:
Linux v1 remains OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED.

Security Rationale:
PFR and its registry semantics are Windows-specific.

Alternatives:
- Abstract an unapproved Linux analog.

Dependencies:
- None for current Windows design.

Required Evidence:
- Future separate design if needed.

Approval Status:
NOT APPLICABLE TO BV6

Implementation Authorization:
NONE
```

### D-PFR-38 — Independent Review

```text
Decision ID:
D-PFR-38

Topic:
Next gate

Proposed Decision:
Require R6-BV7 — Independent Adversarial PFR Policy Review before implementation.

Security Rationale:
BV6 contains significant parser, path, trust-root and TOCTOU design risk and
cannot self-approve.

Alternatives:
- Implement directly.
- Include policy implementation in R5-R3A Build-only.

Dependencies:
- BV6 document hashes.

Required Evidence:
- Independent adversarial findings disposition.

Approval Status:
REQUIRED

Implementation Authorization:
NONE
```

### D-PFR-39 — Build/Runtime Authorization

```text
Decision ID:
D-PFR-39

Topic:
Build and Runtime authority

Proposed Decision:
BV6 grants no build, runtime, deployment or exception authority.

Security Rationale:
This is a design phase.

Alternatives:
- Treat design acceptance as build authorization.

Dependencies:
- All prior gates.

Required Evidence:
- Separate user authorization after BV7.

Approval Status:
NOT AUTHORIZED

Implementation Authorization:
NONE
```

## 9. Open Blocker Summary

| Decision | Blocker | Required resolution |
|---|---|---|
| D-PFR-12 | Exact PFR raw terminator/boundary form | Official plus fixture-backed byte matrix and BV7 approval |
| D-PFR-13 | `*1`/`*2` prefix semantics | Authoritative semantics and approved conversion table |
| D-PFR-16 | Manifest trust root/generation ledger | Approved trust and rollback design |
| D-PFR-17 | Complete toolchain dependency closure | Reviewed inventory and exact identity list |
| D-PFR-31 | Gate integration/bypass boundary | Exact approved entry point and source/exe ownership |

While any blocker remains open:

```text
PFR DYNAMIC POLICY IMPLEMENTATION:
BLOCKED

CURRENT BUILD GATE:
UNCHANGED / FAIL-CLOSED
```

## 10. Candidate Status Register

| Item | Status |
|---|---|
| Historical 46/23 `0FF69E...` | HISTORICAL ONLY |
| Old 38/19 `54CC89...` | EXPIRED EXACT EXCEPTION |
| Current 38/19 `8EE40F...` | CANDIDATE ONLY — NOT APPROVED |
| Policy C | CONDITIONALLY RECOMMENDED |
| Protected-path manifest | OPEN / NOT APPROVED |
| Raw PFR parser spec | OPEN / NOT APPROVED |
| Path resolver spec | PROPOSED / REQUIRES REVIEW |
| Build integration | OPEN / NOT AUTHORIZED |
| `$null` content | NOT READ / NOT VERIFIED |
| R6-NULL-002 | NOT APPROVED |
| Native Build | NOT AUTHORIZED |
| Native Runtime | NOT AUTHORIZED |

## 11. BV6 Non-actions

```text
Live PFR registry read:
NO

PFR modification:
NO

PFR exception:
NO

Build Gate modification:
NO

Source/IDL/test modification:
NO

MIDL/MSVC/Build:
NO

Native Runtime:
NO

Database/Storage:
NO

Service/ACL/IAM/audit-policy change:
NO

`$null` content/hash/change:
NO

Git write:
NO
```

## 12. Final Decision

```text
Overall:
PASS WITH WARNINGS — POLICY DESIGN COMPLETE; INDEPENDENT REVIEW REQUIRED

Policy Recommendation:
CONTROLLED DYNAMIC PFR BASELINE — CONDITIONAL

Open Design Blockers:
5

Current Candidate:
NOT APPROVED

Implementation:
NOT AUTHORIZED

Next Gate:
R6-BV7 — INDEPENDENT ADVERSARIAL PFR POLICY REVIEW
```

This register does not approve any item marked OPEN, BLOCKED or NOT APPROVED.

## 13. Document Integrity

This companion document cannot contain its own final SHA-256 without changing
its bytes. The external digest is calculated after the final write.
