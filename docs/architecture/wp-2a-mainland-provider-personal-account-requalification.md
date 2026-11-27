# WP-2A Mainland Provider Personal-Account Requalification

## 0. Decision

```text
BLOCKED — NO MAINLAND PROVIDER YET PROVEN TO SATISFY BOTH
PERSONAL-ACCOUNT ELIGIBILITY AND ROUTE C-MINIMAL
CONDITIONAL-CREATE + VERSIONING INTEGRITY
```

Provider ordering for any future narrowly authorized Sandbox work:

```text
1. Baidu BOS — conditional first candidate
2. Huawei OBS — technically disqualified for current Route C-Minimal
3. Tencent COS — no new admissible conditional mechanism found
4. Alibaba OSS — historical rejection retained; no new admissible mechanism found
```

AWS China remains technically stronger in its official S3 documentation, but
is excluded from the current account path because the project cannot obtain a
China enterprise subject.

Baidu BOS is not admitted. Two evidence gaps prevent admission:

1. `PERSONAL ELIGIBILITY CONFLICT`: the BOS onboarding page describes a
   personal advanced-verification path, while the later-updated general BOS
   FAQ says BOS requires enterprise advanced verification. The stricter,
   later statement cannot be ignored.
2. `COMBINATION NOT DOCUMENTED — SANDBOX BLOCKER`: BOS documents
   `If-None-Match: *` for `PutObject` and `CompleteMultipartUpload`, and
   separately documents Bucket Versioning, but does not document the combined
   behavior, delete-marker behavior, concurrent-winner semantics or an atomic
   guarantee.

A Baidu Sandbox experiment is worth doing only after the personal-account
eligibility conflict is resolved. The experiment is technically valuable
because it can settle the one remaining conditional-create/versioning
question against a Provider whose other documented APIs fit the Adapter
contract. It must not be treated as production qualification.

No cloud resource was created or queried. No credential was used.

## 1. Scope and evidence levels

This is a read-only requalification completed on 2026-11-26.

| Evidence level | Meaning |
|---|---|
| `OFFICIAL DOCUMENTED` | First-party China documentation explicitly states the behavior |
| `SOURCE VERIFIED` | Current repository source supports the statement |
| `CONDITIONAL` | Evidence exists but a material eligibility or semantic gap remains |
| `NOT VERIFIED` | No first-party execution evidence exists |
| `UNSUPPORTED` | The required invariant is absent from the reviewed API surface |
| `SANDBOX BLOCKER` | The ambiguity or incompatibility prevents design admission until resolved |

The following are separate evidence states:

```text
Official Provider documentation
Personal account actually admitted by the Provider
Technical capability observed in a dedicated Sandbox
Web/Worker + PostgreSQL integration
Production identity, data and deployment
```

This report reaches only part of the first two levels. No Sandbox was created.

## 2. Current repository baseline

### 2.1 Git

Before creating this report:

```text
Repository:                    D:/thinkbook/Desktop/jieya
Branch:                        codex/public-github-sync
HEAD:                          101e8a362e430f4fa7b31b67c56823cb702eb1e6
local origin/main:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
live origin/main via ls-remote:101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:              23
Staged:                        0
Deleted:                       0
Untracked status entries:      123
Untracked files, recursive:    129
```

The live remote check succeeded. The current worktree still differs from
published HEAD.

### 2.2 Required reports

The required reports exist with these actual whole-file digests:

```text
wp-2a-provider-capability-identity-cutover-qualification.md
76919365091BBD8EECBE1582760D8F97EC999083BD197040D8E338D9FC8E1405
42454 bytes

wp-2a-system-level-file-lifecycle-risk-consolidation.md
DCEA6AD3175301FC64A64892565B1B6252A757DD15E80A9997E3691D8586CE98
37641 bytes

wp-2a-aws-china-sandbox-admission.md
0656E424119108A42256FD4F0B64615C06FBC6C5D6859ABA537AFB36835E166E
50820 bytes
```

The target requalification report did not exist before this task.

### 2.3 Route C-Minimal source invariants

The Provider-neutral contract remains:

- [object-storage-adapter.ts:3-10](../../packages/file-storage/src/object-storage-adapter.ts)
  requires `providerKind`, account scope, Region, Bucket, object key, exact
  Provider version ID and optional generation.
- [object-storage-adapter.ts:22-66](../../packages/file-storage/src/object-storage-adapter.ts)
  returns size, SHA-256, ETag and request ID for write/read/discovery.
- [object-upload-service.ts:158-171](../../apps/web/src/modules/files/object-upload-service.ts)
  rejects any Adapter unless immutable write, exact-version read,
  exact-version identity, checksum readback and exact-write discovery are all
  `SUPPORTED`.
- [object-upload-service.ts:318-324](../../apps/web/src/modules/files/object-upload-service.ts)
  generates a new canonical UUID object key and application recovery key.
- [object-upload-service.ts:1146-1218](../../apps/web/src/modules/files/object-upload-service.ts)
  reads the exact returned version and recomputes SHA-256 over the bytes.
- [storage.ts:41-50](../../apps/web/src/server/files/storage.ts) keeps the real
  production Provider adapter absent and therefore fail-closed.

The Provider rules therefore require both:

```text
Provider-enforced no-overwrite on the canonical key
Provider exact version identity plus exact byte readback
```

Object-key randomness is a collision reduction measure, not a substitute for
the Provider precondition.

## 3. Provider ranking and rationale

| Rank | Provider | Personal-account status | Conditional create with versioning | Current disposition |
|---:|---|---|---|---|
| 1 | Baidu BOS | Conflicting official statements | `If-None-Match: *` documented; combination not documented | Best conditional Sandbox candidate; no admission |
| 2 | Huawei OBS | Personal real-name path documented | No PUT/Complete conditional-create API found | Fails required API invariant |
| 3 | Tencent COS | Not re-researched after technical failure | Forbid-overwrite header ineffective with versioning | Not selected |
| 4 | Alibaba OSS | Not re-researched after technical failure | Forbid-overwrite header invalid with versioning | Not selected |
| Excluded | AWS China S3 | Enterprise China account required | Previously documented | Account eligibility unavailable |

AWS China is not newly rejected on technical grounds. It is removed from the
current Sandbox path because the project lacks the required enterprise subject.

### 3.1 Personal-account qualification matrix

| Provider | Individual registration/verification evidence | Enterprise subject required by reviewed material | Current personal-account conclusion |
|---|---|---|---|
| Baidu BOS | General personal face/bank-card verification exists; BOS pages disagree on whether BOS accepts it | Older BOS page: no; later BOS FAQ: yes | `BLOCKED` pending authoritative eligibility confirmation |
| Huawei OBS | Personal Alipay/bank-card/face/document verification documented | No enterprise requirement found in account-authentication docs | `OFFICIAL DOCUMENTED` at account level; OBS fails another hard invariant |
| Tencent COS | Not re-researched after technical disqualification | Not determined in this round | `NOT VERIFIED / NOT SELECTED` |
| Alibaba OSS | Not re-researched after technical disqualification | Not determined in this round | `NOT VERIFIED / NOT SELECTED` |
| AWS China S3 | China enterprise account required | Yes | Excluded by current account capability |

An account-level pass does not imply a Route C-Minimal technical pass.

## 4. Baidu BOS personal-account qualification

### 4.1 General personal real-name path

Baidu Cloud documents personal real-name verification using either:

- personal face verification; or
- personal bank-card verification.

The bank-card method requires name, ID number, a UnionPay card, a mobile number
and SMS verification. It is an alternative, not an additional mandatory step
when another method succeeds. The face method supports specified mainland,
Hong Kong/Macao/Taiwan and foreign-permanent-resident identity types.

The personal FAQ states:

- one ID can verify at most five Baidu Cloud accounts;
- personal verification cannot normally be unlinked;
- users under 14 cannot complete personal verification.

Status: `OFFICIAL DOCUMENTED` for general Baidu Cloud personal accounts.

This report does not ask the user to disclose any identity number, passport,
bank card, mobile number or face image to Codex.

Sources:

- [Baidu Cloud personal advanced verification overview](https://cloud.baidu.com/doc/UserGuide/s/Jkuwf0lep)
- [Personal face verification](https://cloud.baidu.com/doc/UserGuide/s/ql1xbgodl)
- [Personal bank-card verification](https://cloud.baidu.com/doc/UserGuide/s/nl1xbgfvc)
- [Personal verification FAQ](https://cloud.baidu.com/doc/UserGuide/s/vl28nlti4)

### 4.2 BOS-specific eligibility conflict

BOS onboarding states that BOS requires advanced real-name verification in
addition to initial verification, and describes both a personal and an
enterprise advanced-verification route. That page was updated 2024-06-27.

The BOS general FAQ, updated 2026-08-20, states:

> “由于工信部要求，BOS 类产品都需要做企业高级实名认证后才可进行使用。”

This later statement says enterprise advanced verification is required. It
directly conflicts with the onboarding page's personal route.

Status:

```text
General Baidu personal verification:       OFFICIAL DOCUMENTED
BOS personal advanced verification page:   OFFICIAL DOCUMENTED
Latest BOS FAQ enterprise-only statement:  OFFICIAL DOCUMENTED
Actual personal eligibility for a new BOS account:
                                            NOT VERIFIED / BLOCKED
```

BOS MUST NOT be treated as personally available until the user obtains an
authoritative account-eligibility answer through Baidu's official console,
support or onboarding flow. Choosing the less restrictive stale page would
violate the repository's fail-closed rule.

Sources:

- [Baidu BOS getting started and advanced verification](https://cloud.baidu.com/doc/BOS/s/Jk4xttg03)
- [Baidu BOS general FAQ](https://cloud.baidu.com/doc/BOS/s/zjwvysh1k)

### 4.3 Purchase and API restrictions

No official restriction was found that separately bars a personal account from
creating a BOS Bucket, using its API or paying by postpaid billing. However,
that absence does not override the explicit enterprise-only FAQ statement.

Current code/API limits relevant to this project:

- a main account can create at most 100 Buckets by default;
- a simple PUT supports objects up to 5 GB;
- project uploads are limited to 20 MiB, so simple PUT is sufficient;
- standard single-Bucket upload QPS and bandwidth limits are far above the
  Sandbox workload;
- per-account AccessKey creation is limited;
- public outbound traffic is billable.

Status: `OFFICIAL DOCUMENTED`, subject to the unresolved account-type conflict.

Source:

- [Baidu BOS usage limits](https://cloud.baidu.com/doc/BOS/s/Kjwvyq4sy)

### 4.4 IAM users, roles and custom policies

Baidu IAM documentation and BOS integration document:

- a main account can create IAM subusers with their own AccessKeys;
- subuser permissions can be limited to specific actions and resources;
- custom policies are supported;
- roles can be created and authorized with system or custom policies;
- BOS recommends least privilege and Prefix-scoped access.

Status:

```text
IAM subusers:                       OFFICIAL DOCUMENTED
IAM roles:                          OFFICIAL DOCUMENTED
Custom policies:                    OFFICIAL DOCUMENTED
Distinct Publisher/Reader subusers:  OFFICIAL DOCUMENTED IN PRINCIPLE
Personal-account use of those features:
                                     NOT VERIFIED
```

The dedicated identities should preferably be two subusers with independent
credentials, not a shared main-account key. A role can be layered later when
the deployment supplies a trustworthy workload identity. A role itself does not
prove which OS process used it; credential custody and startup assertions are
still required.

Sources:

- [BOS IAM main/sub-user access control](https://cloud.baidu.com/doc/BOS/s/5k1rlj1lk)
- [BOS multi-user access-control configuration](https://cloud.baidu.com/doc/BOS/s/Pjwvyr8i5)
- [Baidu IAM role creation](https://cloud.baidu.com/doc/IAM/s/kjxljbeiz)
- [Baidu IAM policy syntax](https://cloud.baidu.com/doc/IAM/s/8jwvyc3ai)

## 5. BOS Region matrix

### 5.1 Guangzhou and Beijing

| Item | Guangzhou `gz` | Beijing `bj` | Effect |
|---|---|---|---|
| Endpoint family | `gz.bcebos.com` | `bj.bcebos.com` | Must pin Region and endpoint |
| Bucket Versioning | Supported | Supported, feature whitelist required | Guangzhou is first Sandbox choice |
| Multi-AZ storage | Available by ticket | Available by ticket | Both are conditional |
| Versioning + Multi-AZ | Incompatible | Incompatible | Sandbox must use single-AZ Standard |
| Archive versioning | Unsupported | Unsupported | Do not use ARCHIVE |
| AppendObject versioning | No new version | No new version | Do not use append upload |
| Bucket access logs | Documented | Documented | Best-effort delivery |
| BCT/CloudTrail platform audit | Documented | Documented | Region/retention details not verified |
| Server-side encryption | AES256 or SM4 | AES256 or SM4 | Customer-managed KMS not verified |
| Public entry | HTTP and HTTPS endpoint | HTTP and HTTPS endpoint | Sandbox must require HTTPS/private access |
| Latency from project users | Not measured | Not measured | `NOT VERIFIED` |
| Exact Region feature parity | Not exhaustively tested | Not exhaustively tested | Sandbox must capture actual state |

The BOS versioning guide states that only Guangzhou and Beijing currently
support versioning, with Beijing requiring a feature whitelist. It also states
that Multi-AZ generally does not support versioning and that Guangzhou supports
versioning. The multi-AZ guide separately states that multi-AZ use requires a
work-order permission and cannot be changed after Bucket creation.

Sources:

- [BOS Region and Endpoint](https://cloud.baidu.com/doc/BOS/s/akrqd2wcx)
- [BOS versioning console guidance](https://cloud.baidu.com/doc/BOS/s/4m7sf78tm)
- [BOS versioning overview](https://cloud.baidu.com/doc/BOS/s/Ylxuahuws)
- [BOS multi-AZ storage](https://cloud.baidu.com/doc/BOS/s/0k1rkuyuc)

### 5.2 Recommended initial Region

```text
Primary Sandbox Region: Guangzhou, gz
Reason: versioning documented without Beijing's feature whitelist
Storage class: STANDARD, single-AZ
Backup candidate: Beijing only if whitelist and commercial review are completed
```

Guangzhou is not claimed to have the lowest measured latency. It is selected
to avoid a second eligibility gate before testing the mandatory versioned,
non-Multi-AZ capability.

## 6. BOS conditional create and versioning

### 6.1 What is documented

`PutObject` documents:

- `If-Match` compares the stored ETag and otherwise returns `412`.
- `If-None-Match` supports `*`.
- With `If-None-Match: *`, the write succeeds only when BOS does not have an
  object with the requested name.
- If that object name exists, the response is `412 Precondition Failed`.
- With multiple condition headers, evaluation follows RFC 7232 ordering.
- `x-bce-forbid-overwrite: true` is a separate header and returns `409` on a
  same-name upload attempt.

`CompleteMultipartUpload` documents the same `If-None-Match: *` condition.

This proves a conditional PUT-like API surface, but not the versioned Bucket
case.

Sources:

- [BOS PutObject](https://cloud.baidu.com/doc/BOS/s/Ikc5nv3wc)
- [BOS CompleteMultipartUpload](https://cloud.baidu.com/doc/BOS/s/Nkc5vzayc)

### 6.2 The forbidden mechanism

The BOS versioning overview explicitly states:

> “如果Bucket已开启版本控制，上传文件时附加的覆盖同名文件请求头
> x-bce-forbid-overwrite 将不生效。”

Therefore `x-bce-forbid-overwrite` is not a candidate and must never be
reported as the no-overwrite control in this architecture.

Source:

- [BOS versioning overview](https://cloud.baidu.com/doc/BOS/s/Ylxuahuws)

### 6.3 Missing combined semantics

The reviewed official BOS documents do **not** state any of the following:

- whether `If-None-Match: *` is evaluated against current versions only,
  historical versions, or the logical object name;
- whether it remains effective when versioning is enabled;
- whether a current delete marker makes the name absent, deleted, or
  historically present;
- response precedence when a concurrent write and delete race;
- whether two simultaneous conditional PUTs are serialized atomically;
- whether a loser receives `412`, `409`, or another response;
- whether `If-None-Match: *` on multipart completion has the same atomicity;
- any read-after-write consistency guarantee relevant to exact discovery.

Required classification:

```text
COMBINATION NOT DOCUMENTED — SANDBOX BLOCKER
```

The BOS API documents state only that `If-None-Match: *` checks whether an
object with that name exists. A strict interpretation must not invent what
“exists” means across versions and delete markers.

### 6.4 Conditional outcome matrix

| Scenario | Official documented result | Admissible conclusion |
|---|---|---|
| New key, no object/version | PUT with `If-None-Match: *` succeeds | `DOCUMENTED` |
| Current object with same key | `412 Precondition Failed` | `DOCUMENTED` |
| Versioning enabled, same key absent in current view | Not stated | `NOT VERIFIED` |
| Versioning enabled, older versions exist | Not stated | `NOT VERIFIED` |
| Current version is a delete marker | Not stated | `NOT VERIFIED` |
| Two concurrent conditional creates, one key absent | No concurrency guarantee stated | `NOT VERIFIED` |
| Conditional complete-multipart race | `If-None-Match` header exists; race semantics not stated | `NOT VERIFIED` |
| `409` from `x-bce-forbid-overwrite` | Same-name upload returns `409` | Not usable with versioning |
| `409` from `If-None-Match` conflict | Not documented | Do not assume |

### 6.5 Why a Sandbox experiment is still worth considering

Subject to account eligibility, a minimal Sandbox can answer the missing
question directly:

1. Enable versioning on a private Guangzhou single-AZ Bucket.
2. Create an absent key with `If-None-Match: *`.
3. Repeat with different bytes.
4. Race two independently authenticated writers.
5. Delete without a version ID to create a delete marker, then repeat the
   conditional create.
6. Inspect every version and exact-version read.

The experiment is valuable because BOS is currently the only Provider in this
review whose PUT API explicitly supports `If-None-Match: *` and whose object
API supports exact version IDs and upload SHA-256.

The experiment is not authorized now. Account eligibility must be resolved
first.

## 7. BOS exact version and integrity

### 7.1 Exact version identity

BOS documentation states:

- when versioning is enabled, each new object receives a globally unique random
  version ID;
- `PutObject` returns `x-bce-version-id`;
- `GetObject?versionId=...` reads the specified version;
- `GetObjectMeta` (`HEAD`) accepts `versionId`;
- responses return `x-bce-version-id`;
- current reads without `versionId` return the latest version;
- if the latest version is a delete marker, GET without a version ID returns
  `404`;
- specifying a historical version returns that version.

Status: `OFFICIAL DOCUMENTED`.

The Adapter must persist the exact BOS version ID and never reconstruct it from
ETag, Last-Modified, checksum or object key.

Sources:

- [BOS versioning overview](https://cloud.baidu.com/doc/BOS/s/Ylxuahuws)
- [BOS delete markers](https://cloud.baidu.com/doc/BOS/s/Blxubhnfj)
- [BOS GetObject](https://cloud.baidu.com/doc/BOS/s/xkc5pcmcj)
- [BOS GetObjectMeta](https://cloud.baidu.com/doc/BOS/s/6kc5suqj3)

### 7.2 SHA-256

BOS `PutObject` documents `x-bce-content-sha256`:

- BOS verifies the uploaded data against the supplied SHA-256;
- a mismatch causes PUT failure.

BOS `UploadPart` documents the same header for each part.

The reviewed `GetObject` response documents CRC-32 and ETag, not a provider
returned SHA-256 field. Therefore:

```text
Upload-side SHA-256 verification:            OFFICIAL DOCUMENTED
Provider-returned SHA-256 on download:       NOT VERIFIED
Application SHA-256 after exact byte read:   SOURCE VERIFIED
```

The Adapter must:

1. Compute SHA-256 before upload.
2. Encode `x-bce-content-sha256` exactly as the BOS API/SDK requires; the
   reviewed page documents the checksum semantics but does not settle the
   Adapter's encoding choice.
3. Read the exact Provider version.
4. Recompute SHA-256 over the returned bytes.
5. Compare size and digest with the database snapshot.

### 7.3 ETag

BOS describes ETag as the HTTP entity tag of the object and documents a
separate SHA-256 header. ETag MUST NOT be persisted as the application SHA-256
or used as the Provider version identity.

## 8. IAM and access-control feasibility

### 8.1 Target identities

If the personal account is approved, the minimum target is:

| Identity | Allowed purpose | Forbidden |
|---|---|---|
| Qualification admin | Create/configure/inspect/later clean the isolated Sandbox | Normal runtime use |
| Web Publisher | `PutObject` with condition; exact/current version discovery; exact read for verification | Delete, lifecycle, Bucket ACL/versioning administration |
| Worker Reader | Exact-version GET/HEAD and bounded inventory | Put, overwrite, delete, lifecycle, public ACL |

Two IAM subusers are acceptable for the capability probe. Only the Web process
receives the Publisher credential. The Worker receives the Reader credential.
The browser receives neither.

### 8.2 Credential and process identity

Baidu IAM roles may improve short-lived credential handling when the ultimate
hosting platform supplies a reliable workload identity. They do not prove
process identity by themselves.

The implementation must still bind:

```text
deployment/service account
-> secret custody
-> actual Provider account
-> actual Bucket/Region
-> approved Provider credential
```

The Sandbox must test:

- Reader cannot Put/Delete.
- Publisher cannot Delete or configure versioning/lifecycle/public access.
- A deleted/disabled credential is rejected promptly.
- Different AccessKeys identify the correct subuser in logs.

Status: `OFFICIAL DOCUMENTED` capability, `NOT VERIFIED` against a personal
BOS account.

## 9. Audit and logging

BOS documents two different evidence paths:

1. Bucket access logs record requestor, Bucket, time and operation, but BOS
   describes delivery to the target Bucket as “best effort”. Logs usually
   arrive within 2-3 hours and may be delayed substantially.
2. Baidu CloudTrail/BCT records platform operation logs and can deliver them to
   BLS for near-real-time analysis.

Neither is a transaction coordinator or immediate commit proof. Access-log
delivery delay cannot be used to decide whether a write succeeded.

Sandbox requirements:

- enable Bucket access logging to a separate private Bucket;
- select and configure an approved BCT/BLS audit path if available to personal
  accounts;
- retain Provider request IDs and raw responses separately;
- record whether each operation appears in both audit paths;
- verify whether object-level data operations are covered, not just Bucket
  administration;
- define log retention, cost and access controls.

Status:

```text
Bucket access logging:                     OFFICIAL DOCUMENTED
Best-effort delivery / 2-3 hour typical:   OFFICIAL DOCUMENTED
BCT platform operation audit:              OFFICIAL DOCUMENTED
Personal-account BCT/BLS availability:     NOT VERIFIED
Object-level completeness:                 NOT VERIFIED
```

Sources:

- [BOS Bucket access logging](https://cloud.baidu.com/doc/BOS/s/zk1rm7uwr)
- [BOS monitoring and audit overview](https://cloud.baidu.com/doc/BOS/s/okr08o1f8)

## 10. Encryption, lifecycle and account durability hazards

### 10.1 Encryption

BOS documents server-side AES256 and SM4 for upload/copy operations and Bucket
default encryption APIs. Customer-managed KMS key selection, key ownership,
rotation, grant/revoke behavior and audit integration were not found in the
reviewed official BOS encryption material.

Status:

```text
AES256 / SM4 server-side encryption:        OFFICIAL DOCUMENTED
Customer-managed KMS:                       NOT VERIFIED
```

Source:

- [BOS server-side encryption](https://cloud.baidu.com/doc/BOS/s/Yk1rl5rrg)

### 10.2 Lifecycle and versioning conflicts

BOS versioning is incompatible with:

- Bucket compliance-retention policy;
- Bucket recycle bin;
- archive objects;
- Multi-AZ storage.

The Sandbox must use:

```text
STANDARD storage
Single-AZ
Versioning enabled
Recycle bin disabled
Compliance-retention disabled
No archive objects
No lifecycle deletion rule
```

### 10.3 Arrears can erase Sandbox evidence

The BOS billing FAQ states that after an overdue account stops service, data is
retained for 15 days while storage charges continue; if not replenished, BOS
clears the data and sends notification.

This is not acceptable as an unexamined production retention policy. It also
means Sandbox evidence must be copied to an approved local evidence store
before the account can become overdue.

Source:

- [BOS billing FAQ](https://cloud.baidu.com/doc/BOS/s/4keuvw5wc)

## 11. Failure and concurrency test matrix

No row below was executed. “Documented” means only the API field exists.

| ID | Scenario | Expected safe result | Current status |
|---|---|---|---|
| `BOS-F01` | Connection fails before any request bytes leave | No object/version appears; retry as a new operation is safe | `NOT VERIFIED` |
| `BOS-F02` | Provider accepts write but client loses response | Exact-key/version discovery finds it and verifies bytes; no blind second write | `NOT VERIFIED` |
| `BOS-F03` | Provider remains silent until adapter timeout | State becomes `UNKNOWN` or equivalent; preserve and discover | `NOT VERIFIED` |
| `BOS-F04` | Same application request is repeated after known success | Exact key/version is discovered; a duplicate FileVersion is not created | `NOT VERIFIED` |
| `BOS-F05` | Two independent writers conditional-create the same absent key | Exactly one succeeds; loser receives a documented conflict/precondition response | `NOT VERIFIED` |
| `BOS-F06` | Same test after versioning is enabled | Same single-winner result; this is the central unknown | `NOT VERIFIED` |
| `BOS-F07` | One conditional create races with delete | No overwrite or ambiguous success; exact final versions explain outcome | `NOT VERIFIED` |
| `BOS-F08` | Current version is a delete marker | Safe result must prevent reuse of a historically occupied canonical key, or fail closed | `NOT VERIFIED` |
| `BOS-F09` | Current version changes after conditional success | Exact returned version remains readable; latest change does not alter binding | `NOT VERIFIED` |
| `BOS-F10` | Reader or Publisher credential is revoked | New request is denied; no fallback credential is used | `NOT VERIFIED` |
| `BOS-F11` | Web process crashes after Provider success | Restart discovers exact key/version and verifies SHA-256 | `NOT VERIFIED` |
| `BOS-F12` | Read-after-write follows immediately | Exact version is discoverable/readable within required consistency | `NOT VERIFIED` |
| `BOS-F13` | SHA-256 header is wrong | Provider rejects the PUT; no unverified object is accepted | `OFFICIAL DOCUMENTED`, Sandbox not run |
| `BOS-F14` | Downloaded exact version differs in bytes | Adapter detects size/SHA-256 mismatch and fails closed | `SOURCE VERIFIED`, Sandbox not run |
| `BOS-F15` | Bucket access log arrives late or not at all | Business result does not depend on log delivery | `DESIGN REQUIREMENT`, not verified |
| `BOS-F16` | Account balance/availability enters arrears | Evidence already preserved; no automatic acceptance that object history persists | `OFFICIAL HAZARD DOCUMENTED`, no account test |

Mandatory pass criteria for the conditional-create question:

```text
Only one of two concurrent writers may succeed.
Every success response must return a unique exact version ID.
Every non-success must be explainable by a documented or Sandbox-reproduced
  precondition/conflict response.
A key with any historical version or delete marker must never be silently
  rebound as a new immutable logical object.
No success may depend on a best-effort access log.
```

If BOS permits both concurrent writers or reuses a historically occupied key
without an explicit safe result, the Adapter cannot enforce Route C-Minimal
through `If-None-Match: *`.

## 12. Huawei OBS reassessment

### 12.1 Personal real-name

Huawei Cloud explicitly supports personal account verification through:

- personal Alipay verification;
- bank-card verification;
- face recognition;
- personal-document verification.

No enterprise subject is required by the linked account-authentication process.

Status: `OFFICIAL DOCUMENTED`.

Source:

- [Huawei Cloud real-name authentication](https://support.huaweicloud.com/usermanual-account/account_auth_00001.html)

### 12.2 Versioning and exact version read

OBS documents:

- Bucket Versioning can be enabled or suspended and cannot be fully turned off
  after first enablement;
- enabled versioning returns `x-obs-version-id`;
- `GetObject?versionId=...` reads an exact version;
- `HeadObject` accepts an exact `versionId`;
- current-delete-marker reads fail when no version is specified.

Status: `OFFICIAL DOCUMENTED`.

Sources:

- [Huawei OBS SetBucketVersioning](https://support.huaweicloud.com/api-obs/obs_04_0037.html)
- [Huawei OBS GetObject](https://support.huaweicloud.com/api-obs/obs_04_0083.html)
- [Huawei OBS HeadObject](https://support.huaweicloud.com/api-obs/obs_04_0084.html)

### 12.3 PUT conditional-create result

The reviewed `PutObject` and `CompleteMultipartUpload` API pages contain no
`If-None-Match` or `If-Match` request header.

`If-Match` and `If-None-Match` appear on `GetObject` and `HeadObject` as
conditional GET/HEAD behavior. As instructed, this is not treated as PUT
conditional creation.

Status:

```text
PUT conditional create:             UNSUPPORTED by reviewed API
CompleteMultipart conditional create: UNSUPPORTED by reviewed API
GET/HEAD conditional requests:      OFFICIAL DOCUMENTED
```

Sources:

- [Huawei OBS PutObject](https://support.huaweicloud.com/api-obs/obs_04_0080.html)
- [Huawei OBS CompleteMultipartUpload](https://support.huaweicloud.com/api-obs/obs_04_0102.html)

### 12.4 Integrity

The reviewed OBS PUT API documents:

- `Content-MD5`;
- `x-obs-checksum-crc64ecma`;
- no `x-obs-content-sha256`.

GET returns CRC64/ETag, not a documented SHA-256 field. Application SHA-256
readback could still be implemented after exact GET, but the missing conditional
create already fails the architecture.

### 12.5 IAM and audit

OBS documents IAM identity policies, Bucket policies and action/resource
authorization. Dedicated IAM users can be created.

Status:

```text
IAM / Bucket Policy:                 OFFICIAL DOCUMENTED
Exact personal-account policies:      NOT VERIFIED
Audit coverage on personal account:   NOT VERIFIED
```

Huawei OBS is not selected. A Sandbox cannot repair an absent documented PUT
conditional-create API without changing the storage architecture.

## 13. Tencent COS and Alibaba OSS minimal recheck

The historical evidence remains sufficient for the required decision:

| Provider | PUT `If-None-Match` | PUT `If-Match` | Only no-overwrite header | Header with versioning | Result |
|---|---:|---:|---|---|---|
| Tencent COS | Not found | Not found | `x-cos-forbid-overwrite` | Explicitly ineffective when versioning enabled | Fails current invariant |
| Alibaba OSS | Not found | Not found | `x-oss-forbid-overwrite` | Explicitly invalid when versioning enabled/suspended | Fails current invariant |

As instructed, no more generic S3-compatibility research was performed. S3
compatibility does not inherit AWS or BOS semantics.

Sources:

- [Tencent COS PUT Object](https://www.tencentcloud.com/document/product/436/7749)
- [Tencent COS versioning overview](https://www.tencentcloud.com/document/product/436/19883)
- [Alibaba OSS PutObject](https://www.alibabacloud.com/help/en/oss/developer-reference/putobject)
- [Alibaba OSS GetObject](https://www.alibabacloud.com/help/en/oss/developer-reference/getobject)

## 14. P0/P1/P2/P3 findings

### P0

None. No production Provider path is enabled.

### P1

| ID | Finding | Current status |
|---|---|---|
| `MAIN-P1-01` | BOS personal-account eligibility is contradicted by later official enterprise-only FAQ text | `BLOCKED` |
| `MAIN-P1-02` | BOS `If-None-Match: *` and versioning are individually documented but their combined atomic semantics are absent | `SANDBOX BLOCKER` |
| `MAIN-P1-03` | BOS delete-marker and concurrent-winner behavior is unspecified | `NOT VERIFIED` |
| `MAIN-P1-04` | No real Provider Sandbox evidence exists for any candidate | `NOT VERIFIED` |
| `MAIN-P1-05` | Provider workload identity and process-to-credential binding remain unproven on a personal account | `NOT VERIFIED` |
| `MAIN-P1-06` | BOS access logs are best effort and account arrears can erase retained data after 15 days | `HAZARD DOCUMENTED` |
| `MAIN-P1-07` | No production Provider adapter exists; code remains fail-closed outside local/test | `SOURCE VERIFIED ABSENT` |

### P2

| ID | Finding | Current status |
|---|---|---|
| `MAIN-P2-01` | Guangzhou/Beijing latency remains unmeasured | `NOT VERIFIED` |
| `MAIN-P2-02` | BOS audit completeness, BCT/BLS personal eligibility and retention are unverified | `NOT VERIFIED` |
| `MAIN-P2-03` | BOS customer-managed KMS capability is unverified | `NOT VERIFIED` |
| `MAIN-P2-04` | Versioning, Multi-AZ, recycle bin and compliance retention cannot be combined as desired | `DOCUMENTED CONFLICT` |
| `MAIN-P2-05` | BOS read-after-write consistency is not clearly documented in the reviewed material | `NOT VERIFIED` |
| `MAIN-P2-06` | BOS conditional-multipart version-ID response and atomic completion semantics are unclear | `NOT VERIFIED` |

### P3

| ID | Finding | Current status |
|---|---|---|
| `MAIN-P3-01` | Official BOS pages have stale/conflicting personal-versus-enterprise messages | `OPEN` |
| `MAIN-P3-02` | Huawei audit and Alibaba/Tencent audit depth was not exhaustively researched after technical disqualification | `OUT OF SCOPE` |

Counts:

```text
P0 = 0
P1 = 7
P2 = 6
P3 = 2
```

## 15. Minimal Sandbox resource request

This list is not authorized.

### 15.1 Prerequisite eligibility step

Before creating a resource, the user or authorized account owner must resolve
the BOS personal/enterprise conflict without sending identity documents to
Codex. A screenshot-free written answer from Baidu official support or an
account-console eligibility result is sufficient evidence; credentials and
personal documents must stay outside the repository.

### 15.2 If personal BOS eligibility is confirmed

| Resource | Minimum |
|---|---|
| Baidu Cloud account | One personal-real-name Sandbox account owned by the user |
| Region | Guangzhou `gz` |
| Bucket | One private single-AZ STANDARD Bucket |
| Versioning | Enabled |
| Lifecycle deletion | Absent |
| Recycle bin | Disabled |
| Compliance retention | Disabled |
| Encryption | AES256 Bucket default, unless an approved KMS path is found |
| IAM Publisher | One subuser; conditional Put plus minimum exact/read discovery |
| IAM Reader | One subuser; exact-version GET/HEAD only |
| Qualification admin | One temporary admin/subuser for setup and later evidence-preserving cleanup |
| Access-log Bucket | One separate private log Bucket |
| Audit | Bucket access logs plus approved BCT/BLS path if available |
| Synthetic files | Deterministic PDF, JPEG and PNG below 1 MiB |
| PostgreSQL | Not required for the first Provider-only probe |
| Evidence store | Local/approved retained copy outside the charge account |
| Budget | Explicit cap and low-balance alerts required |

The business Bucket and log Bucket must have no public-read ACL and must not be
used through public object URLs.

## 16. Cost categories and approval

| Cost item | Evidence/status |
|---|---|
| Storage for current and historical versions | `OFFICIAL DOCUMENTED`; versioning itself is not separately charged, but every version consumes storage |
| PUT/GET/list and other requests | `OFFICIAL DOCUMENTED`; Console/SDK calls also become API requests |
| Public Internet downlink | `OFFICIAL DOCUMENTED` |
| Internal/upload traffic | Official FAQ says external upload and internal transfer are free; exact contract terms `NOT VERIFIED` |
| Data processing | `OFFICIAL DOCUMENTED` category |
| Bucket access logs | Log objects consume storage and may add request/data-transfer cost |
| BCT/BLS audit | Exact personal-account availability, retention and price `NOT VERIFIED` |
| Multi-AZ | Not used because incompatible with versioning; price irrelevant to current probe |
| KMS | `NOT VERIFIED` |
| Arrears | Service stop followed by documented data clearing after 15 days |

No maximum monetary approval exists. Before account/resource creation, the user
must approve:

```text
hard monthly CNY cap
budget alert threshold
low-balance preservation rule
maximum object count/version count
maximum test duration
audit-log retention
who may perform cleanup
where evidence is duplicated before cleanup
```

The expected synthetic data volume is small, but “small” is not a budget
approval and does not justify omitting a cap.

## 17. Required authorization before a real Sandbox

The next stage requires explicit approval for:

1. A BOS personal-account eligibility preflight through the official account
   console/support path, without transmitting sensitive identity information to
   Codex.
2. Creation of one Guangzhou BOS Sandbox Bucket and one private log Bucket.
3. Enabling Bucket Versioning and AES256 default encryption.
4. Creation of separate Publisher and Reader IAM subusers and custom
   least-privilege policies.
5. A temporary qualification administrator and a bounded credential lifetime.
6. Bucket access logging and, if available, BCT/BLS audit.
7. Deterministic synthetic files and the concurrency/failure test matrix in
   Section 11.
8. A hard spending limit, low-balance alert and evidence-preservation rule.
9. A cleanup procedure that preserves evidence and never deletes before the
   evidence copy is verified.
10. A separate authorization before any BOS Adapter source implementation,
    PostgreSQL integration, Web/Worker execution or production use.

None of items 1-10 is approved by this report.

## 18. Required answers

1. **Can Baidu BOS be opened with personal real-name verification?**

   Not currently established. General Baidu personal verification exists, and
   the older BOS onboarding page describes personal advanced verification.
   However, the later-updated BOS FAQ explicitly says enterprise advanced
   verification is required for BOS. The conflict must be resolved against the
   real account before BOS can be admitted.

2. **Does a Guangzhou Bucket satisfy versioning prerequisites?**

   Yes at `OFFICIAL DOCUMENTED` level. Versioning is documented for Guangzhou
   without the Beijing feature-whitelist requirement. It must be tested on a
   real Bucket. Multi-AZ must not be selected because it is incompatible with
   versioning.

3. **Is `If-None-Match: *` plus versioning formally guaranteed?**

   No. Both features are individually documented, but their combined,
   delete-marker and concurrent semantics are not. The required status is
   `COMBINATION NOT DOCUMENTED — SANDBOX BLOCKER`.

4. **Without that guarantee, is a Sandbox still worth applying for?**

   Conditionally yes, after personal eligibility is confirmed. BOS is the only
   reviewed personal-path candidate with documented PUT
   `If-None-Match: *`, version IDs, exact-version read and upload SHA-256. A
   narrowly bounded Sandbox is the appropriate way to determine whether the
   combination is safe. It must not begin before account, budget, IAM, audit and
   evidence-retention authorization.

5. **Is there a viable Huawei OBS alternative?**

   Not for the current Route C-Minimal protocol. OBS documents exact versions
   and IAM, but the reviewed PUT and CompleteMultipartUpload APIs have no
   conditional-create headers. GET/HEAD conditions do not satisfy the write
   invariant.

6. **Which Provider is currently most recommended?**

   Baidu BOS is the highest-ranked conditional candidate. No Provider is
   admitted. Huawei OBS, Tencent COS and Alibaba OSS do not meet the current
   conditional-create-plus-versioning requirement from the reviewed official
   API surfaces.

7. **What approvals are needed before creating a real Sandbox?**

   Personal BOS eligibility confirmation, Guangzhou Region, private versioned
   single-AZ STANDARD Bucket, separate Publisher/Reader IAM subusers, temporary
   admin, access/BCT/BLS audit decision, hard budget and low-balance rule,
   synthetic-data approval, evidence-retention location and a non-destructive
   cleanup plan.

## 19. Unverified, blocked and out of scope

```text
BOS personal account eligibility:                 BLOCKED — OFFICIAL CONFLICT
BOS If-None-Match * + versioning:                 NOT VERIFIED / SANDBOX BLOCKER
BOS concurrent conditional create:                NOT VERIFIED
BOS delete-marker conditional behavior:           NOT VERIFIED
BOS read-after-write consistency:                 NOT VERIFIED
BOS access-log completeness:                      NOT VERIFIED
BOS BCT/BLS personal-account audit:               NOT VERIFIED
BOS customer-managed KMS:                         NOT VERIFIED
BOS Guangzhou/BJ comparative latency:             NOT VERIFIED
BOS real IAM enforcement:                         NOT VERIFIED
Huawei OBS PUT conditional create:                UNSUPPORTED IN REVIEWED API
Tencent COS versioned conditional create:         UNSUPPORTED / NO NEW MECHANISM
Alibaba OSS versioned conditional create:         UNSUPPORTED / NO NEW MECHANISM
Real Provider Sandbox:                            NOT RUN
Web/Worker + Provider + PostgreSQL integration:  NOT RUN
Production Provider admission:                    PROHIBITED
```

This report does not reopen or close the CM1 database findings. It leaves
unchanged R5, BV7, BV8, historical R8, Windows fencing, production database
roles, historical inventory, backfill, cleanup/recovery, real Provider,
Web/Worker integration, Build and deployment status.

## 20. Official sources reviewed

Baidu BOS:

- [BOS getting started](https://cloud.baidu.com/doc/BOS/s/Jk4xttg03)
- [BOS general FAQ — enterprise advanced-verification statement](https://cloud.baidu.com/doc/BOS/s/zjwvysh1k)
- [Personal advanced verification](https://cloud.baidu.com/doc/UserGuide/s/Jkuwf0lep)
- [Personal face verification](https://cloud.baidu.com/doc/UserGuide/s/ql1xbgodl)
- [Personal bank-card verification](https://cloud.baidu.com/doc/UserGuide/s/nl1xbgfvc)
- [Personal verification FAQ](https://cloud.baidu.com/doc/UserGuide/s/vl28nlti4)
- [BOS PutObject](https://cloud.baidu.com/doc/BOS/s/Ikc5nv3wc)
- [BOS CompleteMultipartUpload](https://cloud.baidu.com/doc/BOS/s/Nkc5vzayc)
- [BOS versioning console guidance](https://cloud.baidu.com/doc/BOS/s/4m7sf78tm)
- [BOS versioning overview](https://cloud.baidu.com/doc/BOS/s/Ylxuahuws)
- [BOS delete marker](https://cloud.baidu.com/doc/BOS/s/Blxubhnfj)
- [BOS GetObject](https://cloud.baidu.com/doc/BOS/s/xkc5pcmcj)
- [BOS GetObjectMeta](https://cloud.baidu.com/doc/BOS/s/6kc5suqj3)
- [BOS IAM access control](https://cloud.baidu.com/doc/BOS/s/5k1rlj1lk)
- [BOS multi-user access configuration](https://cloud.baidu.com/doc/BOS/s/Pjwvyr8i5)
- [Baidu IAM role creation](https://cloud.baidu.com/doc/IAM/s/kjxljbeiz)
- [Baidu IAM policy syntax](https://cloud.baidu.com/doc/IAM/s/8jwvyc3ai)
- [BOS Region and Endpoint](https://cloud.baidu.com/doc/BOS/s/akrqd2wcx)
- [BOS access logs](https://cloud.baidu.com/doc/BOS/s/zk1rm7uwr)
- [BOS monitoring and audit](https://cloud.baidu.com/doc/BOS/s/okr08o1f8)
- [BOS server-side encryption](https://cloud.baidu.com/doc/BOS/s/Yk1rl5rrg)
- [BOS multi-AZ storage](https://cloud.baidu.com/doc/BOS/s/0k1rkuyuc)
- [BOS usage limits](https://cloud.baidu.com/doc/BOS/s/Kjwvyq4sy)
- [BOS billing FAQ](https://cloud.baidu.com/doc/BOS/s/4keuvw5wc)

Huawei OBS:

- [Huawei Cloud real-name authentication](https://support.huaweicloud.com/usermanual-account/account_auth_00001.html)
- [Huawei OBS PutObject](https://support.huaweicloud.com/api-obs/obs_04_0080.html)
- [Huawei OBS GetObject](https://support.huaweicloud.com/api-obs/obs_04_0083.html)
- [Huawei OBS HeadObject](https://support.huaweicloud.com/api-obs/obs_04_0084.html)
- [Huawei OBS SetBucketVersioning](https://support.huaweicloud.com/api-obs/obs_04_0037.html)
- [Huawei OBS CompleteMultipartUpload](https://support.huaweicloud.com/api-obs/obs_04_0102.html)

Tencent and Alibaba:

- [Tencent COS PutObject](https://www.tencentcloud.com/document/product/436/7749)
- [Tencent COS versioning](https://www.tencentcloud.com/document/product/436/19883)
- [Alibaba OSS PutObject](https://www.alibabacloud.com/help/en/oss/developer-reference/putobject)
- [Alibaba OSS GetObject](https://www.alibabacloud.com/help/en/oss/developer-reference/getobject)

## 21. Git and report integrity

Before this report:

```text
Branch:                        codex/public-github-sync
HEAD:                          101e8a362e430f4fa7b31b67c56823cb702eb1e6
local origin/main:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
live origin/main:              101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:              23
Staged:                        0
Deleted:                       0
Untracked status entries:      123
Untracked files, recursive:    129
```

No source, Schema, Migration, SQL, test, configuration, account, Bucket, IAM,
KMS, audit, Provider, database, Build, E2E, service, deployment, Git index,
commit, push or cleanup operation was executed.

`$null`, `UNKNOWN'`, build output directories, environment files, credentials,
passwords, tokens and connection strings were not read or modified.

### 21.1 Report digest

```text
Self-excluding SHA-256:
7DD0ABFE7E00ED49ED8BD6AD063B9B0FF82304B3BB3B72EEAB6FE205EA343CC5

Bytes:           46715
Physical lines:  1073
Non-empty lines: 0803
```

The self-excluding digest replaces the digest token with 64 zero characters and
hashes the UTF-8 file. Byte and line counts are physical UTF-8 file facts; the
non-empty count is separate.
