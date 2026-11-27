# WP-2A Mainland Provider Personal-Account Evidence Matrix R1

## 0. Decision

```text
PARTIAL — PROVIDER CONFIRMATION REQUIRED
```

No reviewed Provider is currently proven to satisfy all Route C-Minimal
requirements for a mainland China personal subject.

The strongest candidates are:

```text
1. Baidu BOS
   Priority: user-requested first candidate
   Account: CONFLICT
   Conditional PUT: VERIFIED
   Conditional PUT + Versioning: NOT DOCUMENTED
   Isolation: PROVIDER CONFIRMATION REQUIRED

2. Volcengine TOS
   Priority: newly discovered secondary candidate
   Account: VERIFIED for mainland China personal real-name
   Conditional PUT: VERIFIED
   Conditional PUT + Versioning: NOT DOCUMENTED
   Isolation: PROVIDER CONFIRMATION REQUIRED
```

The following are eliminated from the current Route C-Minimal path:

```text
Qiniu Kodo        VERIFIED-NO for true S3 Versioning; native Versioning NOT DOCUMENTED
JD Cloud OSS      VERIFIED-NO: official PutObject page says Version unsupported
UCloud US3        NOT DOCUMENTED: no Versioning or conditional PUT API in official catalog
Upyun USS         NOT DOCUMENTED / CONFLICT for stable VersionId and conditional create
Huawei OBS        NOT DOCUMENTED for PUT conditional create
Tencent COS       no admissible conditional-create mechanism found
Alibaba OSS       no admissible conditional-create mechanism found
AWS China S3      excluded by unavailable enterprise subject
```

A Baidu official support inquiry draft has been created separately. No ticket
was submitted and no Provider response is claimed.

## 1. Scope and evidence definitions

This is a read-only evidence review completed on 2026-11-27.

| Status | Meaning |
|---|---|
| `VERIFIED` | First-party documentation explicitly supports the capability or condition |
| `VERIFIED-NO` | First-party documentation explicitly says the capability is unavailable, or the reviewed API surface omits a mandatory and otherwise exhaustive primitive |
| `NOT DOCUMENTED` | No first-party document was found that proves the required behavior |
| `CONFLICT` | First-party documents contradict each other |
| `PROVIDER CONFIRMATION REQUIRED` | The architecture needs a written Provider answer before implementation |
| `NOT TESTED` | No real Provider Sandbox execution exists |

`NOT DOCUMENTED` is never treated as support. SDK convenience behavior is not a
server-side atomicity guarantee.

## 2. Baseline

### 2.1 Git

```text
Repository:                    D:/thinkbook/Desktop/jieya
Branch:                        codex/public-github-sync
HEAD:                          101e8a362e430f4fa7b31b67c56823cb702eb1e6
local origin/main:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
live origin/main via ls-remote:101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:              23
Staged:                        0
Deleted:                       0
Untracked status entries:      124
Untracked files, recursive:    130
```

### 2.2 Accepted Route C-Minimal source invariants

The current worktree requires:

- [object-storage-adapter.ts:3-10](../../packages/file-storage/src/object-storage-adapter.ts):
  provider, account scope, Region, Bucket, object key, exact version ID and
  optional generation.
- [object-storage-adapter.ts:13-66](../../packages/file-storage/src/object-storage-adapter.ts):
  immutable write, exact read, exact discovery, checksum and request-ID
  results.
- [object-upload-service.ts:158-171](../../apps/web/src/modules/files/object-upload-service.ts):
  all five Provider capability flags must be `SUPPORTED`.
- [object-upload-service.ts:318-324](../../apps/web/src/modules/files/object-upload-service.ts):
  new random object key and application recovery identity.
- [object-upload-service.ts:1146-1218](../../apps/web/src/modules/files/object-upload-service.ts):
  exact-version read, SHA-256 recomputation and discovery after write error.

The evidence matrix therefore treats the following as hard gates:

```text
personal mainland account eligibility
server-side proxy feasibility
atomic no-overwrite create on one key
same behavior for multipart completion
Versioning with stable VersionId
exact-version GET and HEAD
delete-marker behavior
integrity verification
independent least-privilege identities
```

## 3. Account eligibility matrix

| Provider | Mainland personal registration / real-name | Product availability to personal account | Evidence |
|---|---|---|---|
| Baidu BOS | General personal authentication exists | `CONFLICT`: onboarding describes personal advanced verification; later FAQ says BOS requires enterprise advanced verification | `CONFLICT` |
| Volcengine TOS | Face or bank-card personal authentication documented | No TOS-specific enterprise-only rule found; personal account can purchase cloud services subject to product rules | `VERIFIED` at account level; exact TOS entitlement `PROVIDER CONFIRMATION REQUIRED` only if support says otherwise |
| Qiniu Kodo | Mainland ID personal verification documented | Kodo is available to account holders after real-name verification | `VERIFIED` |
| JD Cloud OSS | OSS activation requires real-name verification | Account type is not distinguished in the reviewed OSS onboarding page; activation also requires balance > CNY 100 | Account path `NOT DOCUMENTED`; technical result is already `VERIFIED-NO` |
| UCloud US3 | Personal registration not proven in this targeted review | US3 purchase path exists | `NOT DOCUMENTED`; technical result already negative |
| Upyun USS | Personal registration/real-name not found in reviewed help center | REST/S3 services documented | `NOT DOCUMENTED`; technical result already negative |
| Huawei OBS | Personal Alipay, bank-card, face or document verification documented | No product-level enterprise-only rule found | `VERIFIED` at account level; PUT conditional create fails |
| Tencent COS | Not re-researched after technical failure | Not applicable | `NOT DOCUMENTED / NOT SELECTED` |
| Alibaba OSS | Not re-researched after technical failure | Not applicable | `NOT DOCUMENTED / NOT SELECTED` |
| AWS China S3 | Requires China enterprise account | Not available to the current subject | `VERIFIED-NO` for current path |

## 4. Consolidated technical capability matrix

| Provider | PUT conditional create | CompleteMultipart condition | Versioning | Stable version ID | Exact-version GET/HEAD | Atomic condition + Versioning | Result |
|---|---|---|---|---|---|---|---|
| Baidu BOS | `If-None-Match: *` | `If-None-Match: *` | Guangzhou / whitelisted Beijing | `x-bce-version-id` | `versionId` | `NOT DOCUMENTED` | `PROVIDER CONFIRMATION REQUIRED` |
| Volcengine TOS | `if-none-match: *` | `if-none-match: *` | Supported | `x-tos-version-id` | `versionId` | `NOT DOCUMENTED` | `PROVIDER CONFIRMATION REQUIRED` |
| Qiniu Kodo | Native upload policy `insertOnly`; PUT atomicity not explicit | Native v2 complete; no common conditional API | `VERIFIED-NO` in S3-compatible API; no native Versioning API found | `VERIFIED-NO` in S3 response headers | `VERIFIED-NO` for S3 VersionId | Cannot combine | Eliminated |
| JD Cloud OSS | No `If-None-Match` in PutObject | No condition in CompleteMultipartUpload | `VERIFIED-NO` | `VERIFIED-NO` | `VERIFIED-NO` | Cannot combine | Eliminated |
| UCloud US3 | No condition in PutFile | No condition in FinishMultipartUpload | No Versioning API in official catalog | No version ID | No `versionId` parameter | Cannot combine | Eliminated |
| Upyun USS | No PUT precondition; native complete reports 201 new vs 204 overwritten | No precondition documented | `NOT DOCUMENTED / CONFLICT` | `NOT DOCUMENTED / CONFLICT` | Not documented | Cannot prove | Eliminated |
| Huawei OBS | No condition in PutObject | No condition in CompleteMultipartUpload | Supported | `x-obs-version-id` | `versionId` | Missing write condition | Eliminated |
| Tencent COS | `x-cos-forbid-overwrite` only | Not admissible | Supported | `x-cos-version-id` | `versionId` | Forbid header ineffective with Versioning | Eliminated |
| Alibaba OSS | `x-oss-forbid-overwrite` only | Not admissible | Supported | `x-oss-version-id` | `versionId` | Forbid header invalid with Versioning | Eliminated |

## 5. Baidu BOS

### 5.1 Personal/BOS eligibility

General Baidu personal authentication supports face verification or bank-card
verification. The bank-card alternative requires identity details, a UnionPay
card and an SMS code; it is not a mandatory extra method when face verification
succeeds.

Baidu Cloud also states:

- one mainland ID can authenticate at most five accounts;
- personal verification cannot normally be unlinked;
- users under 14 cannot complete personal verification.

The BOS onboarding page says BOS requires an additional advanced verification
and describes a personal path. It was updated 2024-06-27.

The BOS general FAQ was updated 2026-08-20 and states:

> “由于工信部要求，BOS 类产品都需要做企业高级实名认证后才可进行使用。”

This is a direct `CONFLICT`:

```text
Initial Baidu account real-name:             VERIFIED
Personal advanced verification exists:       VERIFIED
BOS accepts personal advanced verification:  CONFLICT
BOS product opening for a personal subject:  PROVIDER CONFIRMATION REQUIRED
```

No sensitive identity material is requested by or stored in the repository.

Evidence:

| Title | URL |
|---|---|
| 实名认证基本介绍 | https://cloud.baidu.com/doc/UserGuide/s/8jwvy3c96 |
| 个人实名认证概述 | https://cloud.baidu.com/doc/UserGuide/s/Jkuwf0lep |
| 个人刷脸认证 | https://cloud.baidu.com/doc/UserGuide/s/ql1xbgodl |
| 个人银行卡认证 | https://cloud.baidu.com/doc/UserGuide/s/nl1xbgfvc |
| 个人认证常见问题 | https://cloud.baidu.com/doc/UserGuide/s/vl28nlti4 |
| 开始使用 BOS（updated 2024-06-27） | https://cloud.baidu.com/doc/BOS/s/Jk4xttg03 |
| BOS 一般类问题（updated 2026-08-20） | https://cloud.baidu.com/doc/BOS/s/zjwvysh1k |

### 5.2 Conditional create

`PutObject` documents:

- `If-Match` checks ETag and returns 412 on mismatch.
- `If-None-Match: *` succeeds only if BOS has no object with that name.
- An existing object name returns 412 Precondition Failed.
- Multiple conditions follow RFC 7232 order.
- `x-bce-forbid-overwrite` is separate, returns 409 and is ineffective when
  Versioning is enabled.

`CompleteMultipartUpload` documents the same `If-None-Match: *` support.

Status:

```text
PutObject condition syntax:                 VERIFIED
CompleteMultipartUpload condition syntax:   VERIFIED
Atomic concurrent winner guarantee:          NOT DOCUMENTED
Behavior with Versioning enabled:            NOT DOCUMENTED
Behavior when current version is Delete Marker:
                                             NOT DOCUMENTED
```

Evidence:

| API / document | Updated | Key field |
|---|---|---|
| PutObject | 2026-09-18 | `If-None-Match: *`; 412; 409 only for forbid-overwrite |
| CompleteMultipartUpload | 2025-12-31 | `If-None-Match: *` |
| Versioning overview | 2026-03-20 | unique version ID; forbid-overwrite ineffective with Versioning |
| Delete Marker | 2024-12-17 | current Delete Marker GET returns 404 |

- https://cloud.baidu.com/doc/BOS/s/Ikc5nv3wc
- https://cloud.baidu.com/doc/BOS/s/Nkc5vzayc
- https://cloud.baidu.com/doc/BOS/s/Ylxuahuws
- https://cloud.baidu.com/doc/BOS/s/Blxubhnfj

### 5.3 Versions and exact read

Status `VERIFIED`:

- Versioning is supported in Guangzhou and Beijing.
- Beijing requires a feature whitelist.
- Every upload to an enabled Bucket receives a globally unique random version
  ID.
- `PutObject` returns `x-bce-version-id`.
- `GetObject?versionId=...` retrieves a specified version.
- `GetObjectMeta` (`HEAD`) accepts `versionId`.
- A current delete marker causes GET without a version ID to return 404.

Versioning cannot be combined with Multi-AZ, recycle-bin or compliance
retention. The Sandbox must use single-AZ STANDARD storage.

Evidence:

| Document | Updated |
|---|---|
| 设置版本控制 | 2025-06-09 |
| 版本控制概述 | 2026-03-20 |
| GetObject | 2026-09-18 |
| GetObjectMeta | 2026-09-18 |
| 多 AZ 存储 | 2026-08-10 |

### 5.4 Integrity

`PutObject` and `UploadPart` document `x-bce-content-sha256`: supplied data must
match or the upload fails.

The reviewed GET response documents CRC32 and ETag but not a Provider-returned
SHA-256 field. Application-side SHA-256 over the exact downloaded bytes remains
mandatory.

ETag is not SHA-256 and is not the exact object version.

### 5.5 IAM and audit

Baidu IAM documents subusers, roles and custom policies. BOS documents IAM
main/subuser authorization and least-privilege Prefix-scoped policies.

Status:

```text
Independent Publisher and Reader subusers:  VERIFIED in principle
Personal-account IAM availability:           NOT DOCUMENTED explicitly
Actual personal-account policy enforcement: NOT TESTED
```

Bucket access logs record requestor, Bucket, time and operation, but delivery is
best effort; typical delivery is 2-3 hours and may be delayed. BCT/CloudTrail
documents platform operation logs and BLS delivery. Exact personal-account BCT
availability, object-operation completeness and retention are `NOT DOCUMENTED`.

### 5.6 BOS unresolved questions

The following must be answered by Provider support and then tested:

1. Is personal advanced verification accepted for a new BOS account?
2. If accepted, may a personal subject create a Bucket, enable Versioning,
   create IAM subusers/roles and call the object APIs?
3. Does `If-None-Match: *` remain active when Versioning is enabled?
4. Is the condition based on the current version, any historical version, or
   the logical name including a delete marker?
5. If the current version is a delete marker and old versions remain, does the
   conditional PUT succeed or fail?
6. For two simultaneous PUTs on one absent key, is exactly one guaranteed to
   succeed?
7. What exact HTTP status and error code does the loser receive?
8. Does CompleteMultipartUpload have the same guarantee?
9. Is the successful version ID returned atomically with the PUT result?
10. Does `GetObject?versionId` and `HEAD ?versionId` bypass the current delete
    marker and return the exact historical bytes?
11. Is there a Provider-side SHA-256 validation/readback guarantee beyond the
    upload header?
12. Could IAM restrict Publisher to conditional Put and Reader to exact-version
    read while denying Delete and configuration?

Status: `PROVIDER CONFIRMATION REQUIRED`.

## 6. Additional candidate — Volcengine TOS

This candidate was added because its official API surface is closer to Route
C-Minimal than the four mandated secondary candidates.

### 6.1 Personal account

Volcengine documents personal real-name authentication using:

- face verification through Douyin/WeChat or the current device camera;
- bank-card verification.

It states one personal subject can authenticate up to three Volcengine accounts,
users under 18 cannot authenticate, and foreign personal users are not currently
supported.

Status: `VERIFIED`.

Evidence:

- [实名认证基本介绍](https://docs.volcengine.com/docs/zh/account-related/basic-introduction.md)
- [个人与企业实名认证区别](https://docs.volcengine.com/docs/zh/account-related/what-is-the-difference-between-personal-real-name-authentication-and.md)
- [个人银行卡认证](https://docs.volcengine.com/docs/zh/account-related/bank-card-authentication.md)

### 6.2 Conditional PUT and multipart

TOS PutObject documents:

- `if-match` ETag precondition; mismatch returns 412.
- `if-none-match`; `*` means any same-name object causes failure and 412.
- Versioning-enabled writes receive a unique `x-tos-version-id`.
- The docs state concurrent ordinary writes keep only the last object.

CompleteMultipartUpload documents the same `if-match` and
`if-none-match: *` headers. It also documents
`x-tos-forbid-overwrite`, explicitly ineffective when Versioning is enabled or
suspended.

Status:

```text
PutObject condition syntax:                VERIFIED
CompleteMultipart condition syntax:        VERIFIED
Atomic guarantee with concurrent writers:  NOT DOCUMENTED
Condition behavior with Versioning:        NOT DOCUMENTED
Delete-marker conditional behavior:        NOT DOCUMENTED
```

Evidence:

- [PutObject](https://docs.volcengine.com/docs/zh/torch-object-storage/put-object.md)
- [CompleteMultipartUpload](https://docs.volcengine.com/docs/zh/torch-object-storage/complete-multi-part-upload.md)

### 6.3 Versioning and exact read

Status `VERIFIED`:

- TOS Versioning can be enabled or suspended and cannot return to disabled.
- New writes receive a unique version ID returned as `x-tos-version-id`.
- GetObject accepts `versionId`.
- HeadObject accepts `versionId`.
- Delete markers are documented.

Evidence:

- [开启和暂停版本控制](https://docs.volcengine.com/docs/zh/torch-object-storage/enabling-and-suspending-versioning.md)
- [版本控制相关操作](https://docs.volcengine.com/docs/zh/torch-object-storage/using-versioning.md)
- [GetObject](https://docs.volcengine.com/docs/zh/torch-object-storage/get-object.md)
- [HeadObject](https://docs.volcengine.com/docs/zh/torch-object-storage/head-object.md)

### 6.4 Integrity

The reviewed TOS PutObject page documents `Content-MD5`; HeadObject documents
CRC64. A native SHA-256 upload/readback field was not found.

Status:

```text
Provider MD5 upload check:       VERIFIED
Provider CRC64 readback:         VERIFIED
Provider-native SHA-256:         NOT DOCUMENTED
Application SHA-256 exact read:  SOURCE COMPATIBLE
```

### 6.5 IAM and account restriction

TOS documents IAM users with upload/download and delete permissions scoped to a
Bucket. The personal account model does not itself state an enterprise-only
restriction for TOS.

Status:

```text
IAM least-privilege examples:       VERIFIED
TOS availability to personal users: VERIFIED at account level; TOS-specific entitlement NOT TESTED
```

### 6.6 Volcengine unresolved questions

Before a TOS Sandbox can be admitted, seek the same key answers as BOS:

- Versioning-on `if-none-match: *` effectiveness;
- delete-marker interpretation;
- exactly-one-winner guarantee;
- loser status/error;
- multipart equivalence;
- read-after-write consistency;
- personal TOS purchase entitlement.

## 7. Qiniu Kodo

### 7.1 Account eligibility

Qiniu requires real-name authentication under the Cybersecurity Law. It
documents personal authentication for individual customers using mainland
identity information.

Status: `VERIFIED`.

Evidence:

- [七牛实名认证说明](https://developer.qiniu.com/af/4057/the-identity-authentication)
- [如何进行个人认证](https://developer.qiniu.com/af/4062/quick-start-personal-authentication)

### 7.2 Conditional create

Native Kodo upload policy supports `insertOnly`:

- non-zero `insertOnly` limits the upload to creation;
- Bucket-only scope has creation semantics;
- exact-key scope allows overwrite unless `insertOnly` is set.

This may provide a no-overwrite mode, but official documentation does not state
concurrent first-writer atomicity for `insertOnly`, nor a stable per-upload
VersionId.

Status:

| Requirement | Result |
|---|---|
| No-overwrite upload policy | `VERIFIED` |
| Concurrent winner guarantee | `NOT DOCUMENTED` |
| CompleteMultipart conditional semantics | `NOT DOCUMENTED` |
| Stable Provider VersionId | `VERIFIED-NO` for S3 interface |

### 7.3 S3 compatibility and true Versioning

The official S3 compatibility table:

- has no `Get/Put Bucket Versioning` API;
- lists `x-amz-version-id` as unsupported;
- lists `x-amz-delete-marker` as unsupported;
- lists CompleteMultipartUpload as compatible except for
  `x-amz-version-id` and other unsupported response fields.

The native Kodo API navigation exposes Object Lock but no Bucket Versioning or
list-object-versions API.

Conclusion:

```text
Qiniu S3 interface true Versioning: VERIFIED-NO
Native Kodo true Versioning:        NOT DOCUMENTED
Route C-Minimal result:             ELIMINATED
```

Evidence:

- [Qiniu S3 compatible API](https://developer.qiniu.com/kodo/4087/compatible-s3-api)
- [Qiniu S3 common headers](https://developer.qiniu.com/kodo/4091/s3-compatible-header)
- [Qiniu upload policy](https://developer.qiniu.com/kodo/1206/put-policy)

### 7.4 Integrity, IAM and audit

Kodo uses its own `etag/hash` concept. No native SHA-256 upload or readback
guarantee was found in this review. The S3 `x-amz-content-sha256` compatibility
note concerns Signature V4 payload signing, not an object checksum readback
facility. Qiniu IAM and audit-log documentation exist, but the missing
Versioning/exact-version contract already eliminates Kodo.

## 8. JD Cloud OSS

### 8.1 Object API

The official S3 PutObject page:

- supports `Content-MD5`;
- lists no `If-Match` or `If-None-Match`;
- explicitly states “OSS目前不支持Version”;
- states that a repeated Put overwrites previous data.

This is a direct `VERIFIED-NO` for both Versioning and the required versioned
conditional-create design.

Evidence:

- [Put Object](https://docs.jdcloud.com/cn/object-storage-service/api/put-object-2)
- [Complete Multipart Upload](https://docs.jdcloud.com/cn/object-storage-service/api/complete-multipart-upload-2)
- [Get Object](https://docs.jdcloud.com/cn/object-storage-service/api/get-object-2)

### 8.2 Account and activation

JD OSS activation:

- requires real-name authentication;
- requires account balance greater than CNY 100;
- does not specify whether the account is personal or enterprise on the
  reviewed page.

Status: personal account eligibility `NOT DOCUMENTED`; technical disqualification
is independent of account type.

Evidence:

- [开通 OSS 服务](https://docs.jdcloud.com/cn/object-storage-service/sign-up-service-1)

### 8.3 IAM and audit

JD documents IAM policies, Bucket policies, ACLs, access logs and monitoring.
These do not repair the missing object Versioning contract.

## 9. UCloud US3

The official US3 API catalog has no Bucket Versioning or object-version APIs.

`PutFile` supports `Content-MD5` but not `If-None-Match`.
`FinishMultipartUpload` documents no conditional header and explicitly changes the
target key to `newObject` when the intended object is occupied. It does not
provide an atomic no-overwrite create.

`GetFile` and `HeadFile` accept `Range`/normal object requests but no `versionId`.

Conclusion:

```text
Conditional PUT:     NOT DOCUMENTED
Conditional complete:NOT DOCUMENTED
Versioning:          NOT DOCUMENTED; absent from official API catalog
Exact version read:  NOT DOCUMENTED
Route C result:      ELIMINATED
```

Evidence:

- [UCloud US3 API 概览](https://docs.ucloud.cn/api/ufile-api/README.md)
- [PutFile](https://docs.ucloud.cn/api/ufile-api/put_file.md)
- [FinishMultipartUpload](https://docs.ucloud.cn/api/ufile-api/finish_multipart_upload.md)
- [GetFile](https://docs.ucloud.cn/api/ufile-api/get_file.md)
- [HeadFile](https://docs.ucloud.cn/api/ufile-api/head_file.md)

Personal account eligibility was not proven in reviewed US3 API pages:
`NOT DOCUMENTED`. This does not affect the technical rejection.

## 10. Upyun USS

### 10.1 Native REST upload

Native REST supports `PUT /<bucket>/<path>` with `Content-MD5`.

It does not document `If-None-Match` or `If-Match` for PUT.

The complete stage of parallel resumable upload says:

- 204 means a previous same-name file was overwritten;
- 201 means the filename appeared for the first time.

That status distinguishes an existing key only after completion; it is not a
precondition that prevents overwrite.

### 10.2 Version identity

The S3 compatibility guide:

- says only file APIs are supported and Region configuration is unsupported;
- lists `x-amz-delete-marker` as not supported;
- lists `x-amz-version-id` as not supported.

However, examples on the same page and in Copy/HEAD samples contain
`x-amz-version-id`. This is a documentation `CONFLICT`.

Even under the more favorable example interpretation:

- no Bucket Versioning API is documented;
- no list-versions API is documented;
- no `versionId` query is documented;
- no atomic PUT precondition is documented.

Conclusion:

```text
No-overwrite create:       NOT DOCUMENTED
Stable true Versioning:    CONFLICT / NOT VERIFIED
Exact version read:        NOT DOCUMENTED
Route C result:            ELIMINATED
```

Evidence:

- [又拍云 REST API](https://help.upyun.com/knowledge-base/rest_api/)
- [又拍云 AWS S3 兼容](https://help.upyun.com/knowledge-base/aws-s3%e5%85%bc%e5%ae%b9/)
- [又拍云 S3 API](https://help.upyun.com/knowledge-base/s3-api/)

Personal account and real-name requirements were not established in the
reviewed documentation: `NOT DOCUMENTED`. This does not affect the technical
rejection.

## 11. Previous candidates

| Provider | Current result | Historical or current evidence |
|---|---|---|
| Huawei OBS | Eliminated: no conditional PUT/Complete documented | Personal authentication verified; Versioning and exact read verified; reviewed PutObject/CompleteMultipartUpload APIs do not document If-None-Match |
| Tencent COS | Eliminated: `x-cos-forbid-overwrite` ineffective with Versioning | Official Put and Versioning docs |
| Alibaba OSS | Eliminated: `x-oss-forbid-overwrite` invalid with Versioning | Official Put and Versioning docs |
| AWS China S3 | Excluded by enterprise account prerequisite | Conditional PUT and exact Versioning documented, but current account subject cannot qualify |

Sources:

- [Huawei OBS PutObject](https://support.huaweicloud.com/api-obs/obs_04_0080.html)
- [Huawei OBS CompleteMultipartUpload](https://support.huaweicloud.com/api-obs/obs_04_0102.html)
- [Tencent COS PutObject](https://www.tencentcloud.com/document/product/436/7749)
- [Tencent COS Versioning](https://www.tencentcloud.com/document/product/436/19883)
- [Alibaba OSS PutObject](https://www.alibabacloud.com/help/en/oss/developer-reference/putobject)
- [Alibaba OSS GetObject](https://www.alibabacloud.com/help/en/oss/developer-reference/getobject)

## 12. Evidence-gap register

| ID | Gap | Affected Provider | Level | Required resolution |
|---|---|---|---|---|
| `MAIN-EV-01` | Personal versus enterprise BOS advanced verification | BOS | `CONFLICT` | Written support answer |
| `MAIN-EV-02` | `If-None-Match: *` with Versioning | BOS | `NOT DOCUMENTED` | Written support answer + Sandbox |
| `MAIN-EV-03` | Delete-marker conditional behavior | BOS | `NOT DOCUMENTED` | Written support answer + Sandbox |
| `MAIN-EV-04` | Concurrent two-writer winner/loser semantics | BOS | `NOT DOCUMENTED` | Written support answer + Sandbox |
| `MAIN-EV-05` | Multipart condition equivalence and version ID | BOS | `NOT DOCUMENTED` | Written support answer + Sandbox |
| `MAIN-EV-06` | Personal-account BOS IAM role support | BOS | `NOT DOCUMENTED` | Account preflight + Sandbox |
| `MAIN-EV-07` | BCT/BLS object audit completeness | BOS | `NOT DOCUMENTED` | Support answer + Sandbox |
| `MAIN-EV-08` | TOS conditional write with Versioning | Volcengine | `NOT DOCUMENTED` | Written support answer + Sandbox |
| `MAIN-EV-09` | TOS delete-marker/concurrency semantics | Volcengine | `NOT DOCUMENTED` | Written support answer + Sandbox |
| `MAIN-EV-10` | TOS personal entitlement for the exact service/region | Volcengine | `NOT DOCUMENTED` | Account console/Sandbox |
| `MAIN-EV-11` | Qiniu native Kodo Versioning | Qiniu | `NOT DOCUMENTED` | Not pursued; S3 true Versioning is `VERIFIED-NO` |
| `MAIN-EV-12` | JD personal account type | JD | `NOT DOCUMENTED` | Not pursued; Versioning is `VERIFIED-NO` |
| `MAIN-EV-13` | UCloud personal account type | UCloud | `NOT DOCUMENTED` | Not pursued; Versioning is `VERIFIED-NO` |
| `MAIN-EV-14` | Upyun personal account and VersionId contradiction | Upyun | `NOT DOCUMENTED / CONFLICT` | Not pursued; conditional PUT is `VERIFIED-NO` |

## 13. Why no Provider is currently admitted

The Architecture requires the Provider itself to make the same-key
conditional create atomic. None of these is sufficient:

```text
random UUID
application retry
pre-HEAD followed by PUT
database row lock
generic S3 compatibility claim
SDK helper name
```

For BOS and Volcengine, the request precondition exists but the versioned
concurrency semantics are unspecified. For all other candidates, the required
Provider primitive is not documented or is contradicted by official
documentation.

Therefore:

```text
QUALIFIED FOR ISOLATED SANDBOX PLANNING: NO
PROVIDER CONFIRMATION REQUIRED:          YES — BOS and Volcengine
```

## 14. Required Sandbox matrix after written confirmation

No item has been executed.

| ID | Scenario | Required result | Provider evidence level now |
|---|---|---|---|
| `PS-01` | Create absent key under Versioning with conditional PUT | 2xx and one version ID | `NOT TESTED` |
| `PS-02` | Repeat conditional PUT with different bytes | Precondition failure; original version unchanged | `NOT TESTED` |
| `PS-03` | Two connections concurrently conditional-create same absent key | Exactly one winner | `NOT TESTED` |
| `PS-04` | Loser response | Documented status/error only | `NOT TESTED` |
| `PS-05` | Current version is delete marker, historical version exists | Safe no-reuse or explicit fail-closed result | `NOT TESTED` |
| `PS-06` | Exact GET of first version after later writes | Original bytes/size/SHA-256 | `NOT TESTED` |
| `PS-07` | Exact HEAD of first version after delete marker | Correct historical metadata; no latest fallback | `NOT TESTED` |
| `PS-08` | Conditional multipart complete | Same one-winner and version-ID result | `NOT TESTED` |
| `PS-09` | Client loses success response | Exact discovery resolves without blind retry | `NOT TESTED` |
| `PS-10` | Reader attempts PUT/Delete/configuration | Denied | `NOT TESTED` |
| `PS-11` | Publisher attempts Delete/lifecycle/versioning config | Denied | `NOT TESTED` |
| `PS-12` | Process restarts | Exact durable version remains discoverable/readable | `NOT TESTED` |
| `PS-13` | Audit lookup | Exact operation, request ID, principal and version correlate | `NOT TESTED` |
| `PS-14` | SHA-256 mismatch | Provider request fails or application exact-read rejects | `NOT TESTED` |

Passing these tests would establish `ISOLATED PROVIDER VERIFIED` only. It would
not establish production readiness.

## 15. Minimal future Sandbox authorization

### 15.1 Baidu BOS

- Guangzhou `gz`, single-AZ STANDARD Bucket.
- Versioning enabled.
- Bucket access log target Bucket.
- Separate Publisher and Reader IAM subusers; no runtime delete.
- Temporary admin.
- Synthetic files only.
- Hard spending cap and evidence copy.
- Test matrix `PS-01` through `PS-14`.

### 15.2 Volcengine TOS

- One mainland personal account after separate approval.
- A TOS Region close to the eventual application; Beijing is a candidate.
- Private versioned Bucket.
- Separate IAM Publisher/Reader users.
- Audit/log configuration if available.
- Same test matrix.

Out-of-scope until separately authorized:

- account registration;
- Bucket/IAM creation;
- Provider API calls;
- PostgreSQL cluster;
- adapter implementation;
- Web/Worker integration;
- historical data or Provider.

## 16. Next-stage recommendation

1. Submit the prepared BOS support inquiry separately; do not send identity
   documents or credentials to Codex.
2. If Baidu confirms personal BOS eligibility and safe versioned conditional
   semantics, plan the Guangzhou Sandbox first.
3. In parallel, only if separately approved, obtain a written Volcengine answer
   for the same conditional/versioning matrix.
4. Do not spend further research on Qiniu, JD, UCloud or Upyun unless their
   official API documentation introduces a new primitive that satisfies all
   hard gates.
5. Do not start PostgreSQL integration until one Provider passes
   `ISOLATED PROVIDER VERIFIED`.

## 17. Git and report integrity

Before this report and the companion inquiry draft:

```text
Branch:                        codex/public-github-sync
HEAD:                          101e8a362e430f4fa7b31b67c56823cb702eb1e6
local origin/main:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
live origin/main:              101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:              23
Staged:                        0
Deleted:                       0
Untracked status entries:      124
Untracked files, recursive:    130
```

The initial live `ls-remote` check succeeded. A final fresh remote check was
attempted after report creation but failed with a GitHub connection reset.
Therefore post-review remote freshness is `NOT VERIFIED`; local HEAD and the
local `origin/main` ref remained unchanged.

No source, Schema, Migration, SQL, test, account, Bucket, IAM, KMS, audit,
Provider, database, Build, E2E, service, deployment, Git index, commit, push or
cleanup operation was executed. No environment file or secret was read.

### 17.1 Report digest

```text
Self-excluding SHA-256:
F46801896ECC5CE203DD5E98ED4CBBB9CEA1D5BE8573B88711C54527D7765B27

Bytes:           33116
Physical lines:  0779
Non-empty lines: 0582
```

The self-excluding digest replaces the digest token above with 64 zero
characters and hashes the UTF-8 file.
