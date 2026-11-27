# WP-2A AWS China Sandbox Account and Region Admission

## 0. Decision

```text
PARTIAL — AWS CHINA DOCUMENTED QUALIFICATION COMPLETE;
ENTERPRISE ELIGIBILITY, SANDBOX AND PRODUCTION IDENTITY NOT VERIFIED
```

AWS China is technically admissible as the first **documented** Sandbox
candidate for Route C-Minimal, using an AWS China general-purpose S3 bucket in
either `cn-north-1` (Beijing) or `cn-northwest-1` (Ningxia).

Recommended conditional decision:

```text
Primary Region:   China (Beijing), cn-north-1, operated by Sinnet
Backup Region:    China (Ningxia), cn-northwest-1, operated by NWCD
Provider:         AWS China S3 general-purpose bucket
Production status: NOT APPROVED
Sandbox status:    NOT CREATED / NOT EXECUTED / NOT VERIFIED
```

Beijing is recommended only as the first Sandbox location. This report found
no measured latency evidence proving Beijing faster than Ningxia for Pearl
River Delta users. The final Region must follow the eventual Web/Worker hosting
Region and a controlled latency test.

This report does not authorize account registration, Bucket creation, IAM,
KMS, CloudTrail, object upload, database work, source changes, deployment or
Provider execution.

## 1. Scope and evidence classification

This was a read-only review performed on 2026-11-26.

Evidence labels used below:

| Label | Meaning |
|---|---|
| `OFFICIAL CHINA DOCUMENTED` | A feature or condition is stated in AWS China site or China-region documentation. This is not Sandbox proof. |
| `REGION-SPECIFIC DOCUMENTED` | The China Region Table identifies the service in the named Region. |
| `SOURCE VERIFIED` | Current repository source supports the statement. |
| `ISOLATED DATABASE VERIFIED` | A prior retained PostgreSQL test supplies evidence. It does not prove Provider behavior. |
| `NOT VERIFIED` | No relevant first-party execution evidence exists. |
| `UNSUPPORTED` | The documented combination cannot provide the required invariant. |

The following are separate and must not be upgraded into one another:

```text
AWS China official documentation
AWS China account actually registered by the enterprise
S3 capability observed in a dedicated Sandbox
Web/Worker + PostgreSQL + Provider integration
Production IAM, account and data
```

This report establishes only the first level. No AWS account or resource was
available, used, created or queried.

## 2. Current repository and evidence baseline

### 2.1 Git baseline before creating this report

```text
Repository:                    D:/thinkbook/Desktop/jieya
Branch:                        codex/public-github-sync
HEAD:                          101e8a362e430f4fa7b31b67c56823cb702eb1e6
local origin/main:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
live origin/main via ls-remote:101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:              23
Staged:                        0
Deleted:                       0
Untracked status entries:      122
Untracked files, recursive:    128
```

`git status --short --branch` reported a normal tracking relationship with no
staged or deleted entries. `git ls-remote origin HEAD` succeeded and returned
the same commit as local HEAD and the local `origin/main` ref.

The repository source still differs from published HEAD. The source statements
below describe the current worktree, not what is committed at HEAD.

### 2.2 Baseline report integrity

The required inputs exist and match their expected digests:

```text
wp-2a-provider-capability-identity-cutover-qualification.md
76919365091BBD8EECBE1582760D8F97EC999083BD197040D8E338D9FC8E1405
42454 bytes

wp-2a-system-level-file-lifecycle-risk-consolidation.md
DCEA6AD3175301FC64A64892565B1B6252A757DD15E80A9997E3691D8586CE98
37641 bytes

wp-2a-cm1-append-intent-relational-integrity-independent-review-r27.md
6FA9BE779A1CA9F28FC3275A30056C71DEE5D662252EE7266C9C5665CAF30887
30355 bytes
```

The target admission report did not exist before this task.

### 2.3 Current Provider boundary

The current worktree keeps production object storage fail-closed:

- [`apps/web/src/server/files/storage.ts:41-50`](../../apps/web/src/server/files/storage.ts)
  states that the Provider adapter is intentionally absent and callers must
  fail closed.
- [`apps/web/src/server/files/storage.ts:61-77`](../../apps/web/src/server/files/storage.ts)
  creates only the bounded-local adapter and only for explicit development or
  test environments.
- [`packages/file-storage/src/object-storage-adapter.ts:3-105`](../../packages/file-storage/src/object-storage-adapter.ts)
  defines Provider-neutral immutable write, exact-version read, exact discovery,
  checksum and request-ID fields.
- [`apps/web/src/modules/files/object-upload-service.ts:158-171`](../../apps/web/src/modules/files/object-upload-service.ts)
  requires all five Provider capability flags to be `SUPPORTED`.
- [`apps/web/src/modules/files/object-upload-service.ts:318-324`](../../apps/web/src/modules/files/object-upload-service.ts)
  creates a server-generated UUID object key and an application recovery key.
- [`apps/web/src/modules/files/object-upload-service.ts:1146-1218`](../../apps/web/src/modules/files/object-upload-service.ts)
  performs exact readback or exact-key discovery after an uncertain write.

The existing risk consolidation records the real Provider adapter and exact
version semantics as `NOT VERIFIED` and blocks production Provider admission.
See
[`wp-2a-system-level-file-lifecycle-risk-consolidation.md:510-516`](wp-2a-system-level-file-lifecycle-risk-consolidation.md)
and
[`wp-2a-system-level-file-lifecycle-risk-consolidation.md:638-648`](wp-2a-system-level-file-lifecycle-risk-consolidation.md).

## 3. AWS China account admission

### 3.1 Separate China account and operators

The AWS China Region Table, last updated 2026-02-28, states:

- Beijing Region is operated and provided by Beijing Sinnet Technology Co.,
  Ltd. (`Sinnet`).
- Ningxia Region is operated and provided by Ningxia Western Cloud Data
  Technology Co., Ltd. (`NWCD`).
- Customers must sign up for a separate set of credentials unique to AWS China.
- AWS Global credentials cannot access China Region resources, and AWS China
  credentials cannot access global resources.

Status: `OFFICIAL CHINA DOCUMENTED`.

Source:

- [AWS China Region Table](https://www.amazonaws.cn/en/about-aws/regional-product-services/)
- [AWS in China](https://www.amazonaws.cn/en/about-aws/china/)
- [AWS China FAQs](https://www.amazonaws.cn/en/about-aws/china/faqs/)

### 3.2 Data residency

The AWS China site states that data or objects stored in the Beijing and
Ningxia Regions remain exclusively in those Regions unless moved to another
location by the customer.

Status: `OFFICIAL CHINA DOCUMENTED`.

This supports the intended mainland China residency constraint, but does not
replace enterprise review of the applicable Sinnet or NWCD customer agreement,
privacy terms, accepted-use policy and data classification. Contract-level
residency, subprocessors, retention and deletion remain `NOT VERIFIED`.

### 3.3 Corporate registration conditions

The official China registration instructions describe a China corporate
account process requiring:

1. A registration email and email verification.
2. An initial IAM username and password.
3. A network-security officer name, valid ID or other accepted identity,
   email and a valid 11-digit mainland China mobile number.
4. Enterprise information verification, including an enterprise registration
   certificate such as a valid Chinese business license or another accepted
   enterprise registration document.
5. Acceptance of the customer agreement and selection of a support plan.

The Support FAQ separately states that a corporate account requires a company
name and supporting documents, and that the company name is not normally
changeable after account creation.

Status:

```text
Enterprise registration path:  OFFICIAL CHINA DOCUMENTED
Specific company eligibility:  NOT VERIFIED
Contract/Fapiao/support terms:  NOT VERIFIED
```

This report does not conclude that every company with a Chinese business
license is automatically eligible. Eligibility, ownership, restricted-industry
status, real-name verification and contract approval must be confirmed by the
enterprise.

The user must not send the business license, ID card, mobile number or other
identity evidence to Codex. Those materials should be entered only through the
official AWS China registration channel by authorized company personnel.

Sources:

- [AWS China account registration instruction](https://www.amazonaws.cn/en/about-aws/china/faqs/signup-process/)
- [AWS China Support FAQs](https://www.amazonaws.cn/en/support/faqs/)
- [AWS China legal terms](https://www.amazonaws.cn/en/legal/)

### 3.4 Contract, currency and operating party

The AWS China legal page identifies separate operator agreements:

- Sinnet Customer Agreement for Amazon Web Services (Beijing Region).
- Western Cloud Data Customer Agreement for Amazon Web Services (Ningxia
  Region).

AWS China FAQs state that Chinese Yuan is the accepted currency. The exact
contracting entity, invoice/Fapiao arrangement, tax treatment, support tier,
credit terms and consolidated billing arrangement are a company decision and
remain `NOT VERIFIED`.

No assumption may be made that an existing AWS Global account, organization,
credit commitment, private pricing agreement or support plan carries into AWS
China.

## 4. ICP, public access and private object access

### 4.1 Public Internet content

AWS China documentation states:

- A domain publicly accessed through servers operated by Sinnet or NWCD must
  use the corresponding SINNET or NWCD ICP recordal or license process.
- Commercial Internet content provision is license-managed, while
  non-commercial content provision is recordal-managed.
- Beijing public content is processed through Sinnet; Ningxia public content is
  processed through NWCD.

Status: `OFFICIAL CHINA DOCUMENTED`.

The legal classification of this product's future Web domain is
`NOT VERIFIED`: whether it is public Internet content, whether it is commercial,
which operating entity hosts it, and whether recordal or a license is required
must be confirmed before exposing a China-hosted public endpoint.

### 4.2 Private S3 bucket and server-side proxy

The selected Route C-Minimal architecture uses a private object bucket and a
server-side proxy. It does not expose Bucket URLs to the browser and does not
require public object ACLs.

Official China S3 documentation supports:

- Block Public Access at account, bucket and access-point levels.
- IAM policies and Bucket Policies for least-privilege access.
- Access points that can require private VPC network paths.

Status:

```text
Private Bucket support:                         OFFICIAL CHINA DOCUMENTED
Block Public Access support:                    OFFICIAL CHINA DOCUMENTED
Server-side proxy compatibility:                DESIGN/SOURCE COMPATIBLE
No-extra-restriction claim for proxy access:    NOT VERIFIED
ICP exemption for a private Bucket:             NOT VERIFIED
```

A private Bucket does not by itself decide whether the public application
domain needs ICP. Conversely, ICP for the Web application does not make a Bucket
public. These are separate controls.

### 4.3 Presigned URLs

AWS China S3 documents presigned URLs as time-limited bearer tokens whose
capabilities follow the signing principal. The same documentation states that a
presigned upload URL can replace an existing object with the same key and can be
reused until expiry.

Those semantics do not meet the desired upload authority boundary:

- the URL grants bearer capability outside the server proxy;
- a presigned upload can overwrite an existing key;
- credential/session scope and expiry complicate exact audit and lifecycle
  enforcement.

Therefore, presigned upload/download URLs are not part of the proposed Sandbox
protocol. Any future use requires a separate security design and explicit
approval. The Route C-Minimal baseline remains server-side proxy only.

Sources:

- [AWS China ICP Recordal](https://www.amazonaws.cn/en/support/icp/)
- [S3 Block Public Access](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/access-control-block-public-access.html)
- [S3 access management](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/access-management.html)
- [S3 presigned URLs](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/using-presigned-url.md)

## 5. AWS China S3 capability matrix

All S3 capabilities below refer to a **general-purpose S3 bucket**, not an S3
directory bucket or S3 Express One Zone. The China S3 API documentation notes
that some cited features do not apply to directory buckets.

| Capability | Beijing | Ningxia | Evidence level | Route C-Minimal consequence |
|---|---|---|---|---|
| S3 service availability | Listed | Listed | `REGION-SPECIFIC DOCUMENTED` | Both are Sandbox candidates |
| General-purpose Bucket | Documented | Documented | `OFFICIAL CHINA DOCUMENTED` | Required |
| Bucket Versioning | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Required and must be enabled |
| Unique version ID | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Persist as exact Provider identity |
| `If-None-Match: *` conditional create | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Primary no-overwrite mechanism |
| `If-Match` ETag-conditional write | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Available; optional, ETag is not exact version identity |
| Exact `GetObject?versionId=` | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Required for download and recovery |
| Exact `HeadObject?versionId=` | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Supports metadata/version discovery |
| Native SHA-256 checksum | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Adapter must still verify exact-read bytes |
| IAM/Bucket Policy least privilege | Listed and documented | Listed and documented | `OFFICIAL CHINA DOCUMENTED` | Required |
| Block Public Access | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Required at account and Bucket level |
| CloudTrail service | Listed | Listed | `REGION-SPECIFIC DOCUMENTED` | Required if audit-evidence option approved |
| S3 object-level CloudTrail data events | Documented | China CloudTrail/S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Not enabled by default; extra charges |
| Lifecycle control present | Documented | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` | Must remain unconfigured for delete/transition |
| Actual Region behavior | Not executed | Not executed | `NOT VERIFIED` | Must be tested in the chosen Sandbox |

### 5.1 Conditional create and version identity

AWS China S3 `PutObject` documentation states:

- `If-None-Match: *` uploads only when the key does not already exist.
- An existing key produces `412 Precondition Failed`.
- A conflicting operation can produce `409 ConditionalRequestConflict`.
- With versioning enabled, the response includes a unique
  `x-amz-version-id`.
- Concurrent conditional writes for one key have one successful first writer;
  later conditional writes fail rather than becoming successful overwrites.

This is the key technical reason AWS is preferred over the two reviewed
alternatives: AWS documents conditional create and versioning as usable
together.

The application still must:

1. Generate a server-side never-reused object key.
2. Send `If-None-Match: *`.
3. Treat `200` as potential success only after exact version/checksum readback.
4. Treat `409` and `412` as no-overwrite evidence and reconcile by exact key,
   never by blind rewrite.
5. Persist provider, account scope, Region, Bucket, exact key and exact
   `versionId`.

Source:

- [AWS China PutObject](https://docs.amazonaws.cn/en_us/AmazonS3/latest/API/API_PutObject.md)
- [AWS China conditional writes](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/conditional-writes.md)
- [AWS China S3 Versioning](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/Versioning.md)

### 5.2 Exact read and checksum

AWS China S3 documentation states that:

- `GetObject` returns the current object unless `versionId` is supplied.
- Supplying `versionId` returns the specific version and requires
  `s3:GetObjectVersion`.
- `HeadObject` supports the same exact-version identity.
- SHA-256 is a supported S3 checksum algorithm and `x-amz-checksum-sha256` can
  carry a Base64-encoded SHA-256.

The application's immutable database checksum is lowercase hexadecimal SHA-256.
The AWS Adapter therefore must explicitly translate it to Base64 on write,
read exact bytes back, recompute SHA-256 over those bytes and compare the
application digest. Provider-native checksum support is useful evidence but is
not a substitute for exact-read byte verification.

Sources:

- [AWS China GetObject](https://docs.amazonaws.cn/en_us/AmazonS3/latest/API/API_GetObject.md)
- [AWS China HeadObject](https://docs.amazonaws.cn/en_us/AmazonS3/latest/API/API_HeadObject.md)
- [AWS China checking object integrity](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/checking-object-integrity.html)

### 5.3 Deletion, lifecycle and retry hazards

Documented hazards:

- Deleting without a version ID in a versioned Bucket creates a delete marker;
  it does not prove all historical bytes are gone.
- S3 Lifecycle expiration can delete expired objects without violating a
  Bucket Policy. The China user guide explicitly says a Bucket Policy cannot
  prevent a general-purpose Bucket Lifecycle rule from deleting or
  transitioning objects.
- `409` can arise from concurrent conditional/delete/upload activity. A retry
  must re-evaluate the durable object state instead of blindly issuing another
  write.
- The application recovery idempotency key is not a documented general S3
  idempotency token.

Required Sandbox controls:

```text
Lifecycle delete/transition configuration: ABSENT
Publisher DeleteObject permissions:        DENY
Publisher lifecycle configuration:         DENY
Reader Put/Delete permissions:             DENY
Web/Worker implicit root credentials:      ABSENT
Public access:                             BLOCKED
```

Nothing in this report authorizes cleanup. The cleanup reference to
version-aware deletion is a future administrative procedure after evidence
retention is approved; it is not a runtime permission.

Sources:

- [S3 object lifecycle](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [S3 conditional writes](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/conditional-writes.md)
- [S3 Versioning](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/Versioning.md)

## 6. Region comparison and recommendation

### 6.1 Comparison

| Dimension | Beijing, `cn-north-1` | Ningxia, `cn-northwest-1` | Evidence |
|---|---|---|---|
| Operator | Sinnet | NWCD | `OFFICIAL CHINA DOCUMENTED` |
| Separate AWS China account | Required | Required | `OFFICIAL CHINA DOCUMENTED` |
| Data and objects remain in Region unless customer moves them | Stated | Stated | `OFFICIAL CHINA DOCUMENTED` |
| S3 availability | Listed | Listed | `REGION-SPECIFIC DOCUMENTED` |
| IAM availability | Listed | Listed | `REGION-SPECIFIC DOCUMENTED` |
| CloudTrail availability | Listed | Listed | `REGION-SPECIFIC DOCUMENTED` |
| KMS availability | Listed | Listed | `REGION-SPECIFIC DOCUMENTED` |
| S3 basic API semantics | China S3 docs shared | China S3 docs shared | `OFFICIAL CHINA DOCUMENTED` |
| Explicit S3 feature delta | None identified in reviewed China docs | None identified in reviewed China docs | `NOT VERIFIED` for exhaustive parity |
| Latency from Pearl River Delta | Not measured | Not measured | `NOT VERIFIED` |
| Cross-Region data-transfer behavior | Not chosen | Not chosen | `NOT VERIFIED` |
| Contract, invoice and negotiated price | Not available | Not available | `NOT VERIFIED` |
| Public Web ICP route | Sinnet | NWCD | `OFFICIAL CHINA DOCUMENTED` |

The Region Table lists both Regions, but the broader China documentation warns
that service capabilities can vary by Region. Shared China S3 documentation is
strong design evidence, not exhaustive proof that every tested feature behaves
identically in both Regions.

### 6.2 Recommendation

Provisional order:

```text
1. Beijing, cn-north-1
2. Ningxia, cn-northwest-1
```

Reasons:

- Both have the needed documented S3, IAM, CloudTrail and KMS services.
- The enterprise has to contract with one named operator; Beijing/Sinnet is a
  reasonable first contract and operations candidate.
- A single chosen Region simplifies data residency, Bucket policy, audit,
  latency and disaster-recovery boundaries for the first Sandbox.
- Beijing's published S3 Standard storage list price is higher than the current
  Ningxia list price, so cost may reverse the choice after a real quote.

This is not a claim that Beijing has lower latency. The final choice must use:

1. Actual enterprise account availability.
2. The eventual Web/Worker hosting Region.
3. Measured synthetic upload/download latency from representative networks.
4. Contract, Fapiao, support and egress terms.
5. Written data-residency and records-retention approval.

## 7. Identity, endpoint and SDK differences

| Item | AWS China requirement | Status |
|---|---|---|
| Account | Separate AWS China corporate account | `OFFICIAL CHINA DOCUMENTED` |
| ARN partition | `arn:aws-cn` | `OFFICIAL CHINA DOCUMENTED` |
| Beijing Region token | `cn-north-1` | `OFFICIAL CHINA DOCUMENTED` |
| Ningxia Region token | `cn-northwest-1` | `OFFICIAL CHINA DOCUMENTED` |
| Endpoint suffix | China docs identify `.amazonaws.com.cn` service endpoints | `OFFICIAL CHINA DOCUMENTED` |
| Console | China uses a region-specific console and China docs | `OFFICIAL CHINA DOCUMENTED` |
| JavaScript SDK default Region | SDK does not select a Region by default | `OFFICIAL CHINA DOCUMENTED` |
| Exact production S3 endpoint hostname | Must be captured from approved SDK configuration and Sandbox evidence | `NOT VERIFIED` |
| SDK dependency in repository | No AWS SDK dependency exists in the current Provider implementation | `SOURCE VERIFIED ABSENT` |

The Adapter must pin:

```text
providerKind
accountScopeRef and partition
Region
Bucket
endpoint mode
exact object key
exact version ID
provider generation if applicable
request ID
```

An environment-only Region assumption is insufficient. Startup identity must
reject a wrong account, partition, Region, Bucket Region or endpoint.

Sources:

- [AWS China endpoints and ARNs](https://docs.amazonaws.cn/en_us/aws/latest/userguide/endpoints-arns.html)
- [AWS China ARN syntax](https://docs.amazonaws.cn/en_us/aws/latest/userguide/ARNs.md)
- [AWS China service documentation](https://docs.amazonaws.cn/en_us/aws/latest/userguide/services.md)
- [JavaScript SDK Region selection](https://docs.amazonaws.cn/en_us/sdk-for-javascript/v3/developer-guide/setting-region.md)

## 8. Audit, logging and lifecycle capability

### 8.1 CloudTrail

CloudTrail is listed in both China Regions.

The China S3 documentation states:

- CloudTrail Event History covers 90 days of recorded management events.
- S3 object-level requests require data events.
- Trails do not log data events by default.
- Additional charges apply to data events.

Therefore request IDs from an individual API call are useful operation
evidence, but do not by themselves provide durable independent audit history.
A Sandbox audit decision must choose one of:

```text
A. Enable a CloudTrail trail with S3 data events, define retention and accept
   the additional cost.
B. Do not claim Provider-level data-event audit; retain explicit NOT VERIFIED
   status and do not admit production.
```

Options A and B are not equivalent. This task does not authorize either.

Sources:

- [S3 CloudTrail logging](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/cloudtrail-logging.md)
- [Enabling CloudTrail event logging for S3](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/enable-cloudtrail-logging-for-s3.html)
- [CloudTrail data events](https://docs.amazonaws.cn/en_us/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)

### 8.2 Lifecycle

S3 Lifecycle is documented, but it is a destructive service capability when
configured with expiration or noncurrent-version expiry. The Sandbox must not
configure Bucket Lifecycle deletion/transition rules. Runtime principals must
not have lifecycle configuration permission.

The CloudTrail log Bucket may have an independently reviewed log-retention
lifecycle after an explicit audit-retention decision. That policy must not
apply to the business-object Bucket.

## 9. Alternative Provider comparison

The alternatives are not disqualified as cloud storage products. They are less
ready for this exact Route C-Minimal invariant set because their reviewed
official documentation does not show a reliable conditional-create-plus-
versioning combination or all required identity semantics.

| Capability | AWS China S3 | Alibaba Cloud OSS | Tencent Cloud COS |
|---|---|---|---|
| Conditional create/no-overwrite | `If-None-Match: *`, documented with versioning | `x-oss-forbid-overwrite=true`; explicit docs say invalid when versioning enabled/suspended | `x-cos-forbid-overwrite=true`; explicit docs say ineffective when versioning enabled |
| Conditional create plus versioning | `OFFICIAL CHINA DOCUMENTED` together | `UNSUPPORTED` for that documented combination | `UNSUPPORTED` for that documented combination |
| Unique version ID | `OFFICIAL CHINA DOCUMENTED` | `OFFICIAL CHINA DOCUMENTED` | `OFFICIAL CHINA DOCUMENTED` |
| Read specified version | `OFFICIAL CHINA DOCUMENTED` | `OFFICIAL CHINA DOCUMENTED` | `OFFICIAL CHINA DOCUMENTED` |
| Provider-native SHA-256 | `OFFICIAL CHINA DOCUMENTED` | `NOT VERIFIED`; MD5 and CRC-64 documented | `NOT VERIFIED`; MD5 and CRC-64 documented |
| Least-privilege IAM/policy | `OFFICIAL CHINA DOCUMENTED` | RAM/Bucket Policy references documented | CAM authorization documented |
| Object-audit retention | CloudTrail data events documented; extra cost | `NOT VERIFIED` | `NOT VERIFIED` |
| Timeout/response-loss semantics | HTTP `409`/`412` and request IDs documented; Sandbox behavior `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` |
| Route C-Minimal selection | Recommended first Sandbox candidate | Not selected | Not selected |

### 9.1 Alibaba Cloud OSS

The official OSS `PutObject` page documents:

- `x-oss-forbid-overwrite=true` prevents same-name overwrite by default.
- That header is invalid when the destination Bucket has versioning enabled or
  suspended, meaning same-name overwrite becomes possible.
- Versioning assigns an `x-oss-version-id`.
- `GetObject?versionId=...` reads a specified version.
- MD5 and CRC-64 are documented integrity values. Native SHA-256 was not found.

This creates a direct conflict if both conditional no-overwrite and versioning
are required on the same Bucket. A random non-reusable object key reduces but
does not eliminate the need for Provider-enforced no-overwrite.

Sources:

- [Alibaba OSS PutObject](https://www.alibabacloud.com/help/en/oss/developer-reference/putobject)
- [Alibaba OSS GetObject](https://www.alibabacloud.com/help/en/oss/developer-reference/getobject)

### 9.2 Tencent Cloud COS

The official COS `PUT Object` page documents:

- `x-cos-forbid-overwrite=true` prevents same-name overwrite only when
  versioning is not enabled.
- When versioning is enabled, that header is ineffective and same-name objects
  may be overwritten.
- `Content-MD5` and `x-cos-hash-crc64ecma` are documented integrity values.
- A same-name conflict with `x-cos-forbid-overwrite` returns
  `409 FileAlreadyExists`.

Tencent's versioning documentation confirms unique version IDs, exact-version
reads, and delete markers. It does not remove the conditional-create/
versioning incompatibility above.

Sources:

- [Tencent COS PUT Object, Chinese](https://cloud.tencent.com/document/product/436/7749)
- [Tencent COS PUT Object, English](https://www.tencentcloud.com/document/product/436/7749)
- [Tencent COS versioning overview](https://cloud.tencent.com/document/product/436/19883)
- [Tencent COS versioning overview, English](https://www.tencentcloud.com/document/product/436/19883)

### 9.3 Provider decision

No immediate switch to Alibaba or Tencent is justified.

Fallback to one of them becomes appropriate only if:

- AWS China enterprise registration is refused or contractually unsuitable; or
- the AWS China Sandbox fails a mandatory invariant; and
- the alternative provides a separately tested conditional-create mechanism
  that remains effective with exact versioning, or the architecture is
  explicitly redesigned and independently approved.

S3 API compatibility does not transfer AWS semantics.

## 10. Minimal Sandbox design

This is a resource request, not authorization.

### 10.1 Minimum cloud resources

| Resource | Proposed minimum | Constraint |
|---|---|---|
| AWS China account | One dedicated non-production AWS China account/identity | Separate from AWS Global; synthetic data only |
| Region | One of `cn-north-1` or `cn-northwest-1` | Beijing recommended first |
| Business Bucket | One private general-purpose S3 Bucket | Versioning enabled; public access blocked; no lifecycle delete rules |
| Audit Bucket | One private log Bucket, preferably separate | CloudTrail log storage if approved |
| CloudTrail trail | One trail with selected S3 data events | Additional cost; retention must be approved |
| KMS | Not automatically create; decide SSE-S3 versus customer-managed KMS | KMS policy/ownership/cost unresolved |
| Qualification admin | One temporary short-lived break-glass principal | Configure, inspect and later clean only; not runtime |
| Publisher principal | One workload role/identity | Conditional Put plus minimum readback/discovery; no Delete or lifecycle |
| Reader principal | One workload role/identity | Exact-version read/discovery only; no Put/Delete |
| Synthetic files | Deterministic PDF/JPEG/PNG below 1 MiB | No customer or business data |
| Tagging | Approved cost/sandbox tags | Prevent unowned resources |

No PostgreSQL cluster is needed for the first Provider capability probe. A
disposable PostgreSQL instance is needed only for the later integrated
lifecycle protocol and requires separate authorization.

### 10.2 Bucket security baseline

Before any upload:

```text
Bucket type:                         General-purpose
Bucket visibility:                   Private
Block Public Access account level:   Enabled
Block Public Access Bucket level:    Enabled
Object Ownership:                    Bucket-owner enforced if supported by approved design
ACLs:                                Disabled
Versioning:                           Enabled
Default encryption:                   Approved SSE mode
Lifecycle delete/transition:          Absent
Static website hosting:               Disabled
Public Bucket policy:                 Absent
Object Lock:                          Not assumed; separate decision
Cross-Region replication:             Not configured
```

### 10.3 Principal permissions

Provisional only; exact policy must be reviewed before creation:

| Principal | Allow | Explicit deny / absence |
|---|---|---|
| Publisher | `s3:PutObject` with conditional header; minimum key/version metadata read and exact/current discovery | No `s3:DeleteObject*`, no lifecycle/versioning configuration, no Bucket public-policy modification |
| Reader | `s3:GetObject`, `s3:GetObjectVersion`, exact-version `HeadObject` | No `s3:PutObject`, no delete, no lifecycle |
| Qualification admin | Scoped setup/inspection and later approved cleanup | No standing runtime credential; no customer data; no broad account-root use |
| Web/Worker runtime | Not created in this admission stage | No Provider credential may reach the browser or Worker |

The actual S3 actions needed by `discoverExact()` must be proven in the Sandbox.
If it requires `s3:ListBucket` or `s3:ListBucketVersions`, that grant must be
Prefix-constrained and justified by evidence.

### 10.4 Bucket Policy safeguards

The design should evaluate, but not create now, a Bucket Policy that:

- requires TLS;
- denies public principals and public ACLs;
- denies delete operations to runtime principals;
- denies lifecycle configuration to all except a break-glass qualification
  principal;
- denies access through an unapproved Region/endpoint profile where feasible;
- requires encryption;
- optionally restricts access to an approved VPC endpoint;
- explicitly handles CloudTrail service writes to the separate audit Bucket.

A Bucket Policy must not create an unbreakable state. An explicit
administration and recovery path must be reviewed independently.

## 11. Cost qualification

### 11.1 Official list-price facts

The AWS China S3 pricing page currently states:

- Both Regions offer an S3 Free Tier of 5 GB Standard storage, 20,000 Get
  requests and 2,000 Put requests per month for one year, subject to account
  eligibility.
- Beijing S3 Standard list storage rate: CNY 0.195 per GB for the first 50 TB
  per month.
- Ningxia S3 Standard list storage rate: CNY 0.1755 per GB for the first 50 TB
  per month.

These are public list-price observations, not an enterprise quote or a final
budget.

Source:

- [Amazon S3 pricing in China](https://www.amazonaws.cn/en/s3/pricing/)

### 11.2 Cost items requiring approval

```text
Storage GB-month
PUT/COPY/POST/LIST requests
GET/HEAD and other requests
Internet egress
Cross-Region data transfer if any
CloudTrail data events
CloudTrail log Bucket storage and requests
KMS key, request and rotation charges if customer-managed KMS is selected
Support plan
Taxes and Fapiao arrangement
Enterprise discount or private pricing
```

The exact expected Sandbox monetary amount is `NOT VERIFIED` until request
volume, retention duration, CloudTrail/KMS choices, Region, contract and
eligible Free Tier are known. No monetary approval is implied by the small
nature of the synthetic test.

## 12. Sandbox qualification plan

Every item below is planned only. None was executed.

| ID | Test | Expected invariant | Layer | Current status |
|---|---|---|---|---|
| `AC-01` | Read actual account partition/account identity | `arn:aws-cn` and approved China account | IAM/STS | `NOT VERIFIED` |
| `AC-02` | Verify selected Region endpoint | Approved `cn-north-1` or `cn-northwest-1`; no implicit global Region | S3/config | `NOT VERIFIED` |
| `SB-01` | Create private general-purpose test Bucket | Bucket owner and Region match approved profile | S3 | `NOT VERIFIED` |
| `SB-02` | Enable versioning and read state | Versioning enabled | S3 | `NOT VERIFIED` |
| `SB-03` | Verify account and Bucket Block Public Access | Public anonymous access denied | S3/IAM | `NOT VERIFIED` |
| `SB-04` | Conditional create to absent key | One new version; stable unique version ID | S3 | `NOT VERIFIED` |
| `SB-05` | Repeat conditional create with different bytes | `412`; original bytes/version unchanged | S3 | `NOT VERIFIED` |
| `SB-06` | Two concurrent conditional creates on one absent key | One unqualified winner; loser `412` or documented `409`; no overwrite | S3 | `NOT VERIFIED` |
| `SB-07` | Conditional create while versioning is enabled | Precondition remains effective | S3 | `NOT VERIFIED` |
| `SB-08` | Create second object version using test-only admin action | Distinct exact version IDs | S3 | `NOT VERIFIED` |
| `SB-09` | Read first exact version after second exists | Exact first bytes, size and SHA-256 | S3/Adapter | `NOT VERIFIED` |
| `SB-10` | Read nonexistent or wrong version | No latest-version fallback | S3/Adapter | `NOT VERIFIED` |
| `SB-11` | SHA-256 upload header and readback | Provider accepts checksum; application independently verifies bytes | S3/Adapter | `NOT VERIFIED` |
| `SB-12` | Publisher exact-key discovery after write | Returns exact current version and request ID | S3/Adapter | `NOT VERIFIED` |
| `SB-13` | Client disconnect after Provider acceptance | Recovery discovers exact key/version; no blind second write | Adapter | `NOT VERIFIED` |
| `SB-14` | Reader attempts Put/Delete/lifecycle config | Access denied | IAM | `NOT VERIFIED` |
| `SB-15` | Publisher attempts Delete/lifecycle config/public policy change | Access denied | IAM | `NOT VERIFIED` |
| `SB-16` | Delete without version as admin | Delete marker behavior observed; historical version remains | S3 | `NOT VERIFIED` |
| `SB-17` | Delete a specific test version as admin | Behavior and audit event recorded; runtime remains denied | S3 | `NOT VERIFIED` |
| `SB-18` | Inspect lifecycle configuration before/after tests | No lifecycle rule exists | S3 | `NOT VERIFIED` |
| `SB-19` | Verify TLS-only and encryption policies | Insecure/non-encrypted path denied | S3 policy | `NOT VERIFIED` |
| `SB-20` | Verify no public website endpoint/public object URL | Anonymous access denied | S3 | `NOT VERIFIED` |
| `SB-21` | CloudTrail data event for conditional write/read/delete denial | Event identifies exact principal, resource, request ID and outcome | CloudTrail | `NOT VERIFIED` |
| `SB-22` | Approve and measure list/version inventory pagination | Complete stable inventory without omission | S3/Adapter | `NOT VERIFIED` |
| `SB-23` | Verify configured Region mismatch | Startup/config assertion fails closed | Adapter | `NOT VERIFIED` |
| `SB-24` | Measure synthetic latency from representative client/hosting network | Region choice supported by measurements | Network | `NOT VERIFIED` |
| `SB-25` | Re-run evidence from a clean process | Version identity and bytes remain recoverable | Adapter | `NOT VERIFIED` |

Acceptance for the Provider Sandbox:

- every mandatory capability is `PROVIDER SANDBOX VERIFIED`;
- no test depends on public access, root credentials, disabled constraints or
  presigned upload URLs;
- CloudTrail/audit coverage matches the approved decision;
- all temporary resources and identities have an approved evidence-retention
  and later cleanup procedure;
- cleanup remains unexecuted until evidence is retained.

## 13. Remaining risk register

### P0

None identified for the read-only admission decision. No production Provider
path is enabled.

### P1

| ID | Risk | Current status | Required next evidence |
|---|---|---|---|
| `AWS-CN-P1-01` | The enterprise's actual AWS China account eligibility is unknown | `NOT VERIFIED` | Authorized enterprise registration/contract confirmation |
| `AWS-CN-P1-02` | AWS China S3 behavior is documented but never executed | `NOT VERIFIED` | Dedicated Sandbox capability proof |
| `AWS-CN-P1-03` | First-party IAM boundaries and account/endpoint identity are unproven | `NOT VERIFIED` | Negative IAM tests and startup identity assertions |
| `AWS-CN-P1-04` | ICP/license classification for the future public Web endpoint is unresolved | `NOT VERIFIED` | Legal/business decision before public deployment |
| `AWS-CN-P1-05` | Current code has no real AWS Adapter and fails closed outside local/test | `SOURCE VERIFIED ABSENT` | Separately authorized Adapter implementation |
| `AWS-CN-P1-06` | Security-relevant source is uncommitted and not release-approved | `BLOCKED` | Independent diff review, commit and release approval |

### P2

| ID | Risk | Current status |
|---|---|---|
| `AWS-CN-P2-01` | Beijing versus Ningxia latency from target networks is not measured | `NOT VERIFIED` |
| `AWS-CN-P2-02` | CloudTrail data-event cost, retention and completeness are unapproved | `NOT VERIFIED` |
| `AWS-CN-P2-03` | Lifecycle configuration and administrative recovery controls are not implemented | `OPEN` |
| `AWS-CN-P2-04` | SSE-S3 versus customer-managed KMS and key custody are undecided | `OPEN` |
| `AWS-CN-P2-05` | The exact S3 endpoint host and SDK behavior have not been observed | `NOT VERIFIED` |

### P3

| ID | Risk | Current status |
|---|---|---|
| `AWS-CN-P3-01` | China S3 docs often carry a generic Region-difference notice; exhaustive Beijing/Ningxia S3 parity was not independently enumerated | `NOT VERIFIED` |
| `AWS-CN-P3-02` | Alibaba/Tencent audit coverage and response-loss semantics were not exhaustively researched because they are fallback-only | `NOT VERIFIED` |

Counts:

```text
P0 = 0
P1 = 6
P2 = 5
P3 = 2
```

## 14. Required enterprise confirmations

Before Sandbox resource creation, the enterprise must confirm:

1. The exact Chinese legal entity and its authority to contract.
2. That the company can complete AWS China real-name/corporate verification.
3. Who will be the network-security officer and primary account contact; these
   details must not be supplied to Codex.
4. Whether a new AWS China account is required or an approved existing China
   account will be used.
5. Sinnet/Beijing or NWCD/Ningxia as the initial operating party.
6. Contract review, support plan, CNY billing, Fapiao, tax and budget cap.
7. Acceptance of Chinese-mainland-only data residency for synthetic Sandbox
   data.
8. Whether the future public Web application requires ICP recordal or license,
   and who owns that process.
9. Retention and legal-hold policy for objects, evidence and audit logs.
10. Whether CloudTrail data events and customer-managed KMS are mandatory for
    the Sandbox.
11. Synthetic-file allowlist and prohibition on real customer/business data.
12. Resource naming, tagging, cost alerts and later cleanup authority.

## 15. Next-stage authorization list

The smallest next authorization would cover a **documented qualification
plan**, not production:

1. Register/confirm one AWS China enterprise account.
2. Create or designate one isolated Sandbox account boundary.
3. Approve Beijing as initial Region, with Ningxia as backup.
4. Create one private, versioned, public-access-blocked general-purpose S3
   Bucket.
5. Create workload roles for publisher and reader, plus one short-lived
   qualification admin.
6. Create the approved CloudTrail audit path and retention controls.
7. Approve synthetic test files and network test locations.
8. Approve a monetary cap and resource cleanup/evidence-retention plan.
9. Execute the Provider capability tests in Section 12.
10. Only after Provider Sandbox success, separately authorize the AWS Adapter
    implementation and disposable PostgreSQL/Web/Worker integration tests.

Items 1-10 are not approved by this report.

## 16. Prohibited actions in this task

The following were not executed and remain prohibited until separately
authorized:

- AWS China account registration or verification;
- creation of an AWS Global or China account;
- creation of any S3 Bucket, object, access point, version, delete marker or
  lifecycle rule;
- IAM users, roles, policies, access keys, identity providers or permission
  sets;
- KMS key creation or policy changes;
- CloudTrail trail, event store, log Bucket or retention configuration;
- Provider SDK/API calls, presigned URL generation or synthetic upload;
- PostgreSQL cluster creation, connection, SQL, Migration or Backfill;
- source, Schema, Migration or test changes;
- service, Worker, Scheduler or deployment startup;
- commit, push, cleanup, history rewrite or removal of evidence.

## 17. Unverified and blocked items

```text
AWS China enterprise account actually approved:     NOT VERIFIED
Company-specific signup eligibility:                NOT VERIFIED
Signed Sinnet/NWCD contract:                         NOT VERIFIED
Sandbox account/Region/Bucket:                       NOT VERIFIED
AWS China S3 Sandbox behavior:                       NOT VERIFIED
CloudTrail data-event completeness:                  NOT VERIFIED
AWS China runtime IAM enforcement:                   NOT VERIFIED
Beijing/Ningxia target-network latency:              NOT VERIFIED
ICP requirement for future public Web endpoint:      NOT VERIFIED
SSE/KMS policy:                                      UNRESOLVED
Retention/legal hold:                                UNRESOLVED
AWS Adapter source:                                  NOT IMPLEMENTED
Real Web/Worker + PostgreSQL + S3 E2E:               NOT VERIFIED
Real Provider response-loss recovery:                NOT VERIFIED
Production admission:                                PROHIBITED
```

R27's CM1 database conclusions and exceptions remain unchanged. This task does
not close `P2-05`, the R5 Open Decisions, BV7/BV8, historical R8, binding-parent-
chain gaps, orphan FileVersion, multiple-terminal matrix, Windows fencing,
historical inventory, production IAM/ACL, Windows service integration, real
drain, production Build or deployment.

## 18. Answers to the six required questions

1. **Does AWS China have technical qualification?**

   Yes at `OFFICIAL CHINA DOCUMENTED` level. Both Regions list S3, IAM,
   CloudTrail and KMS; China S3 docs document conditional create, version IDs,
   exact-version read, SHA-256, public-access blocking and lifecycle behavior.
   Actual Sandbox behavior remains `NOT VERIFIED`.

2. **Does the enterprise have registration eligibility?**

   An official enterprise registration path exists. The company's actual
   eligibility and ability to satisfy corporate verification are
   `NOT VERIFIED`.

3. **Beijing or Ningxia?**

   Provisional first choice: **Beijing (`cn-north-1`)**. Backup:
   **Ningxia (`cn-northwest-1`)**. No latency superiority is claimed.

4. **Should the project switch to Alibaba Cloud or Tencent Cloud now?**

   No. AWS China has the stronger documented conditional-create plus versioning
   evidence. Alibaba and Tencent should be reconsidered only if AWS enterprise
   admission or Sandbox qualification fails.

5. **What must the user approve before Sandbox creation?**

   The enterprise/operator/contract, one Region, isolated account, private
   versioned Bucket, public-access blocking, disabled lifecycle deletion,
   temporary admin and runtime principals, audit decision, synthetic-data
   policy, budget and evidence-retention/cleanup plan.

6. **Is creation of any resource authorized now?**

   **No.** No AWS China account, Bucket, IAM principal, role, policy, KMS key,
   CloudTrail resource, object, database or integration resource may be
   created.

## 19. Official sources reviewed

AWS China:

- [AWS China Region Table](https://www.amazonaws.cn/en/about-aws/regional-product-services/)
- [AWS in China](https://www.amazonaws.cn/en/about-aws/china/)
- [AWS China FAQs](https://www.amazonaws.cn/en/about-aws/china/faqs/)
- [AWS China registration instruction](https://www.amazonaws.cn/en/about-aws/china/faqs/signup-process/)
- [AWS China Support FAQs](https://www.amazonaws.cn/en/support/faqs/)
- [AWS China legal terms](https://www.amazonaws.cn/en/legal/)
- [AWS China ICP Recordal](https://www.amazonaws.cn/en/support/icp/)
- [AWS China endpoints and ARNs](https://docs.amazonaws.cn/en_us/aws/latest/userguide/endpoints-arns.html)
- [AWS China ARN syntax](https://docs.amazonaws.cn/en_us/aws/latest/userguide/ARNs.md)
- [AWS China service documentation](https://docs.amazonaws.cn/en_us/aws/latest/userguide/services.md)
- [AWS China S3 PutObject](https://docs.amazonaws.cn/en_us/AmazonS3/latest/API/API_PutObject.md)
- [AWS China S3 GetObject](https://docs.amazonaws.cn/en_us/AmazonS3/latest/API/API_GetObject.md)
- [AWS China S3 HeadObject](https://docs.amazonaws.cn/en_us/AmazonS3/latest/API/API_HeadObject.md)
- [AWS China S3 Versioning](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/Versioning.md)
- [AWS China conditional writes](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/conditional-writes.md)
- [AWS China checking object integrity](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/checking-object-integrity.html)
- [AWS China S3 access management](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/access-management.html)
- [AWS China S3 Block Public Access](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/access-control-block-public-access.html)
- [AWS China S3 presigned URLs](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/using-presigned-url.md)
- [AWS China S3 CloudTrail logging](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/cloudtrail-logging.md)
- [AWS China enabling CloudTrail S3 events](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/enable-cloudtrail-logging-for-s3.html)
- [AWS China CloudTrail data events](https://docs.amazonaws.cn/en_us/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html)
- [AWS China S3 object lifecycle](https://docs.amazonaws.cn/en_us/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [AWS China S3 pricing](https://www.amazonaws.cn/en/s3/pricing/)
- [JavaScript SDK Region selection](https://docs.amazonaws.cn/en_us/sdk-for-javascript/v3/developer-guide/setting-region.md)

Alternative Providers:

- [Alibaba OSS PutObject](https://www.alibabacloud.com/help/en/oss/developer-reference/putobject)
- [Alibaba OSS GetObject](https://www.alibabacloud.com/help/en/oss/developer-reference/getobject)
- [Tencent COS PutObject, Chinese](https://cloud.tencent.com/document/product/436/7749)
- [Tencent COS PutObject, English](https://www.tencentcloud.com/document/product/436/7749)
- [Tencent COS Versioning, Chinese](https://cloud.tencent.com/document/product/436/19883)
- [Tencent COS Versioning, English](https://www.tencentcloud.com/document/product/436/19883)

## 20. Git and report integrity

Before this report, and after verifying live remote access:

```text
Branch:                        codex/public-github-sync
HEAD:                          101e8a362e430f4fa7b31b67c56823cb702eb1e6
local origin/main:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
live origin/main:              101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:              23
Staged:                        0
Deleted:                       0
Untracked status entries:      122
Untracked files, recursive:    128
```

Files protected by instruction were not read, hashed, modified, moved or
deleted. Build output directories were not accessed. No environment file,
secret, password, token or connection string was read or printed.

No source, Schema, Migration, SQL, test, configuration, IAM/ACL, database,
Provider, Storage, Build, E2E, service, deployment, Git index, commit, push or
cleanup operation was executed.

### 20.1 Report digest

```text
Self-excluding SHA-256:
9C97015E55220039E0F40319391A290B03256B67241012B7E75CB57415E638E2

Bytes:           50820
Physical lines:  1030
Non-empty lines: 0797
```

The self-excluding digest replaces the digest token above with 64 zero
characters and hashes the UTF-8 file. The byte and line counts are physical
UTF-8 file facts; the non-empty count is provided separately.
