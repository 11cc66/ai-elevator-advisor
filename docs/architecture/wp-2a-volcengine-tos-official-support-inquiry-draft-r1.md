# 火山引擎 TOS 官方技术工单问题草案 R1

## 0. 状态

```text
PARTIAL — PROVIDER CONFIRMATION REQUIRED
DRAFT ONLY — NOT SUBMITTED
NO PROVIDER RESPONSE
NO SANDBOX EXECUTION
NO PRODUCTION ADMISSION
```

本文件只用于准备可由用户本人复制到火山引擎官方工单系统的问题。Codex 未登录
火山引擎控制台、未提交工单、未联系厂商、未使用任何凭据，也未创建 TOS
资源。

不得在工单或仓库中填写密码、AccessKey、SecretKey、Session Token、数据库
连接串、真实客户 URL 或真实文件内容。身份证、银行卡、手机号和人脸信息只能
由账号所有人通过火山引擎官方实名认证页面提交。

## 1. 现有官方证据复核

复核日期：2026-11-27。

| 能力/问题 | 官方证据结论 | 状态 |
|---|---|---|
| 中国大陆自然人个人实名认证 | 官方提供抖音/微信/当前设备扫脸或银行卡认证 | `VERIFIED` |
| 个人主体最多认证 3 个账号 | 实名认证基本介绍明确说明 | `VERIFIED` |
| 个人账号可购买/使用 TOS | 通用账号文档说明个人账号可购买云服务，但未单列 TOS 产品准入 | `PROVIDER CONFIRMATION REQUIRED` |
| TOS 对个人账号存在企业认证要求 | 未在 TOS API 或账号实名文档中发现企业专属限制 | `NOT DOCUMENTED` |
| PutObject 条件创建 | `if-none-match: *` 在存在同名对象时返回 412 | `VERIFIED` |
| CompleteMultipartUpload 条件创建 | 文档列出 `if-none-match: *` | `VERIFIED` |
| 条件创建与 Versioning 组合仍有效 | 未发现组合语义说明 | `NOT DOCUMENTED` |
| 两个并发条件 PUT 最多一个成功 | 未发现服务端原子胜者说明 | `NOT DOCUMENTED` |
| 条件竞争失败请求的准确状态/错误码 | 普通 precondition 失败为 412；并发 loser 未说明 | `NOT DOCUMENTED` |
| 响应丢失后的服务端幂等保证 | 未发现通用 idempotency token 或响应丢失语义 | `NOT DOCUMENTED` |
| Bucket Versioning | 可开启/暂停，开启后不可关闭 | `VERIFIED` |
| 唯一 VersionId | 开启 Versioning 后新对象返回 `x-tos-version-id` | `VERIFIED` |
| Delete Marker | DeleteObject 文档说明未指定版本会插入 DeleteMarker | `VERIFIED` |
| Delete Marker 后条件 PUT 行为 | 未发现明确组合说明 | `NOT DOCUMENTED` |
| 历史版本影响条件判断 | 未发现明确说明 | `NOT DOCUMENTED` |
| 指定 VersionId 的读取 | GetObject 和 HeadObject 均接受 `versionId` | `VERIFIED` |
| 指定 VersionId 的删除 | DeleteObject 文档说明可删除指定版本 | `VERIFIED` |
| 列表版本 | ListObjectVersions 文档可用 | `VERIFIED` |
| 原生 SHA-256 上传校验 | PutObject 文档只明确 `Content-MD5`；未发现 SHA-256 头 | `NOT DOCUMENTED` |
| CRC64 读回 | PutObject/HeadObject 文档包含 CRC64 相关字段 | `VERIFIED` |
| ETag 是否等于 SHA-256 | 无此保证；ETag 仍不等同于完整对象 SHA-256 | `NOT DOCUMENTED / MUST NOT ASSUME` |
| 分片整对象 SHA-256 | 未见明确整对象 SHA-256 校验说明 | `NOT DOCUMENTED` |
| 独立 IAM User | 可创建 IAM 用户并按 Bucket/Prefix 授权 Get/Put/Delete | `VERIFIED` |
| Publisher 禁止 Delete | IAM 策略示例支持明确 Allow/Deny；可按 Action 限制 | `VERIFIED` |
| Reader 指定 Bucket/Prefix 只读 | IAM 策略示例支持资源与 Prefix 条件 | `VERIFIED` |
| 按 VersionId 限制 IAM | 未找到专门的条件键或策略示例 | `NOT DOCUMENTED` |
| Web/Worker 不使用长期 Provider 凭据 | 未找到 STS/角色临时凭证与 TOS Adapter 的完整说明 | `NOT DOCUMENTED` |
| 真实 TOS Sandbox | 未创建、未执行、无证据 | `NOT TESTED` |

### 1.1 官方证据链接

账户与实名：

- [实名认证基本介绍](https://docs.volcengine.com/docs/zh/account-related/basic-introduction.md)
- [个人实名认证与企业实名认证区别](https://docs.volcengine.com/docs/zh/account-related/what-is-the-difference-between-personal-real-name-authentication-and.md)
- [个人银行卡认证](https://docs.volcengine.com/docs/zh/account-related/bank-card-authentication.md)
- [个人扫脸认证](https://docs.volcengine.com/docs/zh/account-related/verify-by-scanning-face-through-douyin-we-chat-app.md)

TOS API 与版本：

- [PutObject](https://docs.volcengine.com/docs/zh/torch-object-storage/put-object.md)
- [CompleteMultipartUpload](https://docs.volcengine.com/docs/zh/torch-object-storage/complete-multi-part-upload.md)
- [开启和暂停版本控制](https://docs.volcengine.com/docs/zh/torch-object-storage/enabling-and-suspending-versioning.md)
- [版本控制相关操作](https://docs.volcengine.com/docs/zh/torch-object-storage/using-versioning.md)
- [GetObject](https://docs.volcengine.com/docs/zh/torch-object-storage/get-object.md)
- [HeadObject](https://docs.volcengine.com/docs/zh/torch-object-storage/head-object.md)
- [DeleteObject](https://docs.volcengine.com/docs/zh/torch-object-storage/delete-object.md)
- [ListObjectVersions](https://docs.volcengine.com/docs/zh/torch-object-storage/list-object-versions.md)
- [地域与访问域名](https://docs.volcengine.com/docs/zh/torch-object-storage/regions-and-endpoints.md)

IAM：

- [权限管理概述](https://docs.volcengine.com/docs/zh/torch-object-storage/overview-of-rights-management.md)
- [典型 IAM 策略示例](https://docs.volcengine.com/docs/zh/torch-object-storage/iam-policy-examples.md)
- [授予 IAM 用户指定桶上传和下载对象的权限](https://docs.volcengine.com/docs/zh/torch-object-storage/allowing-an-iam-user-to-upload-and-download-objects-in-a-bucket.md)
- [授予 IAM 用户删除指定对象的权限](https://docs.volcengine.com/docs/zh/torch-object-storage/allowing-an-iam-user-to-delete-an-object.md)

## 2. 提交前由用户填写

```text
账号类型：中国大陆自然人个人实名认证账号
账号认证状态：已完成 / 未完成 / 待补充
账号归属：个人 / 企业（若为企业，本草案部分问题仍可提交）
计划 Region：华北2（北京） / 华南1（广州） / 华东2（上海）
计划 Bucket：私有、开启 Versioning、标准存储
场景：服务端代理访问，浏览器和 Worker 不持有 TOS 凭据
是否已有 TOS 资源：否
```

用户填写前不得创建 Bucket。只需确认现有账号资格即可提交本工单。

## 3. 可直接复制的工单正文

```text
主题：个人实名认证账号使用 TOS Versioning、条件创建、分片完成与精确版本读取的技术确认

您好，

我们正在评估使用火山引擎对象存储 TOS 作为私有文件的权威对象存储。
架构要求服务端代理写入、Web/Worker 不向浏览器暴露 Provider 凭据、
每个 FileVersion 使用不可复用对象键、启用 Bucket Versioning、保存精确
VersionId，并通过指定 VersionId 精确读回对象。

当前账号计划使用中国大陆自然人个人实名认证。我们尚未创建正式资源，
也未使用真实客户文件。希望贵方书面确认以下问题，并在可能时提供对应官方
文档链接或服务端行为说明。

一、个人主体资格（A）

A1. 中国大陆自然人是否可以注册并使用抖音/微信扫脸、当前设备扫脸或银行卡
    完成个人实名认证？
A2. 完成个人实名认证后，个人账号是否可以直接开通 TOS？
A3. TOS 是否还要求企业实名认证、企业营业执照、企业资质或额外审核？
A4. 个人账号能否创建 Bucket、启用 Versioning、使用条件请求和分片上传，
    并调用 PutObject、CompleteMultipartUpload、GetObject、HeadObject、
    DeleteObject 和 ListObjectVersions？
A5. 个人账号是否在以下方面存在限制，请逐项确认：
    a) 可用 Region；
    b) Bucket 数量或容量；
    c) 请求 QPS 或带宽；
    d) 资源包、预付费或最低消费；
    e) TOS 功能白名单。
A6. 个人账号的 TOS 资源是否归属于个人主体，是否允许后续升级为企业实名而
    不改变现有 Bucket/Object 所有权？
A7. 个人账号能否申请 TOS 技术支持工单和技术确认？是否需要企业客户资质？

二、条件创建与 Versioning（B）

B1. Bucket 开启 Versioning 后，PutObject 的 if-none-match: * 是否仍然有效？
    请分别说明“未开启、开启、暂停”三种状态。
B2. if-none-match: * 的判断对象是：
    a) 当前对象版本；
    b) 所有历史版本；
    c) 逻辑 Object 名，包括 Delete Marker；
    d) 其他规则？
B3. 两个独立客户端通过两个独立连接，同时向同一个不存在的 Key 发送
    if-none-match: * PUT，服务端是否保证最多一个请求成功？
B4. 如果 B3 只允许一个成功，失败请求的准确 HTTP 状态码和 TOS Error Code
    是什么？是否可能出现 409 ConditionalRequestConflict、412
    PreconditionFailed 或其他错误？
B5. 条件判断和对象创建是否属于同一个服务端原子操作？是否存在 TOCTOU
    （先判断、后创建）窗口？
B6. 请明确条件失败时是否保证：
    a) 不创建新对象或新版本；
    b) 不改变 current pointer；
    c) 不改变任何历史版本；
    d) 不产生 Delete Marker；
    e) 不返回成功状态。
B7. 如果客户端请求超时、连接中断或服务端成功但响应丢失，如何可靠判断：
    a) 请求未到达；
    b) 请求已执行但响应丢失；
    c) 请求因冲突失败？
B8. TOS 是否提供通用 idempotency key 或等价请求去重机制？如果没有，是否
    支持使用随机不可复用 Key + if-none-match: * + 精确读回进行恢复？
B9. 请说明网络重试时不得直接重复覆盖的官方建议。

三、Delete Marker（C）

C1. TOS 是否存在 Delete Marker 或等价删除标记？开启 Versioning 后，普通
    DELETE 是否只插入 Delete Marker 并保留历史版本？
C2. 当前版本是 Delete Marker、但历史版本仍存在时，if-none-match: * PUT
    是否允许成功？请明确这是“新对象名”还是“已有历史 Key 的再次绑定”。
C3. 任一历史版本存在时，if-none-match: * 是否会失败？还是只检查 current
    version？
C4. 是否可以使用 versionId 读取指定历史版本？
C5. 是否可以指定 versionId 删除特定历史版本或 Delete Marker？
C6. 删除后再创建同一 Key 时，VersionId 如何变化？旧版本是否继续可读？
C7. 如果条件 PUT 与 DELETE 并发，请分别说明：
    a) 条件 PUT 成功，DELETE 后到；
    b) DELETE 先成功生成 Delete Marker，条件 PUT 后到；
    c) 两个操作同时到达；
    各场景的最终 current 状态、历史版本和返回结果。

四、Multipart Upload（D）

D1. CompleteMultipartUpload 是否支持 if-none-match: *？
D2. Bucket 开启 Versioning 后，D1 的条件是否仍然有效？
D3. 条件检查是在 CompleteMultipartUpload 时对最终 Object Key 进行一次
    原子判断，还是在 Initiate/UploadPart/Complete 多阶段分别判断？
D4. 两个使用不同 uploadId 的分片任务同时完成同一个 Object Key 时，是否
    保证最多一个成功？
D5. 失败完成请求是否可能留下：
    a) 部分对象；
    b) 新版本；
    c) Delete Marker；
    d) 可继续完成的 uploadId；
    e) 未清理的 Part？
D6. CompleteMultipartUpload 成功但响应丢失时，如何通过 Key、UploadId、
    VersionId 或请求 ID 确认最终对象是否已生成？
D7. CompleteMultipartUpload 成功响应是否返回唯一 VersionId？如果文档未
    明确返回，应通过哪个原子接口取得该次完成对应的 VersionId？
D8. PutObject 与 CompleteMultipartUpload 在 Versioning、Delete Marker、
    并发和重试语义上是否完全一致？

五、精确版本读取（E）

E1. 开启 Versioning 后，成功 PutObject/CompleteMultipartUpload 是否返回
    唯一且稳定的 x-tos-version-id？
E2. GET /<ObjectKey>?versionId=<VersionId> 是否始终返回指定历史版本，不受
    当前版本、覆盖或 Delete Marker 影响？
E3. HeadObject 的 versionId 是否具有相同语义？
E4. Range GET 是否支持指定历史 VersionId？
E5. 指定 VersionId 不存在时是否返回明确的 NoSuchVersion/404，绝不回退到
    最新版本？
E6. ListObjectVersions 是否提供稳定、可分页、无遗漏的 Version 清单，并
    能识别 Delete Marker？

六、SHA-256 与完整性（F）

F1. PutObject 是否支持 SHA-256 上传校验？如支持，请给出准确 Header、
    编码方式和错误码。
F2. 该校验是否由 TOS 服务端实际计算并执行，还是只保存客户端提供的元数据？
F3. 下载或精确读取指定 VersionId 时，TOS 是否提供服务端计算的 SHA-256
    响应头？
F4. 如果 TOS 只提供 MD5/CRC64，请说明推荐的服务端完整性与客户端精确读回
    校验组合。
F5. 分片上传是否支持对整个合并后对象执行 SHA-256 校验？
F6. CompleteMultipartUpload 的 ETag 是否是 Multipart ETag？该 ETag 是否
    不能作为对象 SHA-256 使用？
F7. 当 SHA-256/MD5/CRC64 不匹配时，是否保证不提交对象、不产生版本？

七、IAM 最小权限（G）

G1. 是否可以在同一个个人实名主账号下创建两个独立 IAM 用户：
    a) Publisher：仅允许指定 Bucket/Prefix 的条件 PutObject 和必要的精确
       读回，不允许 Delete、DeleteObjectVersion、生命周期、Bucket ACL、
        版本控制配置和权限管理；
    b) Reader：仅允许指定 Bucket/Prefix 的 GetObject、GetObjectVersion、
        HeadObject、ListObjectVersions，不允许 Put、Delete 或配置变更？
G2. 请确认是否存在 GetObjectVersion/按 versionId 精确读取所需的独立 Action，
    以及如何配置最小 IAM 策略。
G3. 是否可以按 Bucket、Prefix、Action 和条件键限制 IAM 用户？Delete、
    生命周期和权限配置能否明确 Deny？
G4. 是否可以为 Publisher/Reader 使用 STS 临时凭证、IAM 角色或工作负载角色，
    避免长期 AccessKey？
G5. 临时凭证的最大有效期、刷新、撤销和审计语义是什么？
G6. 是否支持只读角色和仅创建对象的角色彼此隔离，且不允许角色自行提升权限？
G7. 若服务端代理需要精确发现最近写入的 VersionId，请给出所需的最小只读
    Action 集和资源范围。

八、审计与运行边界（补充）

H1. TOS/云审计是否能记录 PutObject、CompleteMultipartUpload、GetObject、
    HeadObject、DeleteObject、Delete Marker 和 IAM Deny？
H2. 请说明请求 ID、VersionId、操作者、Bucket/Prefix 和错误码之间的关联方式。
H3. 是否存在会因账号欠费、生命周期规则、回收站或其他策略自动删除已绑定
    Version 的行为？
H4. 是否存在 TOS 服务端代理模式、预签名 URL 或公有访问方面的额外限制？

九、请特别说明

1. 对 B1-B9、C2-C3、D1-D8 必须分别回答，不能只用“PutObject 支持
   if-none-match”概括 Versioning 开启时的行为。
2. 请明确说明服务端原子性、并发 winner/loser 结果及响应丢失后的恢复方式。
3. 如果某能力不支持或有额外限制，请直接说明“不支持”或“需单独审批”，不要
   仅提供 SDK 示例。
4. 请提供官方文档 URL、文档更新时间或工单技术确认文本，便于后续设计审查。
5. 本问题仅用于资格确认，不代表我们已通过 TOS Sandbox 或生产准入。

谢谢。
```

## 4. 首轮回复后的判定规则

| Provider 回复 | 后续状态 |
|---|---|
| 仅确认个人实名和普通 `if-none-match` | 仍为 `PARTIAL — PROVIDER CONFIRMATION REQUIRED` |
| 确认 Versioning 开启后条件创建、并发最多一个成功、状态码明确 | 可准备隔离 Sandbox 计划，但仍为 `NOT TESTED` |
| 确认 Multipart 与普通 Put 具有同等原子保证 | 可把 Multipart 纳入 Sandbox |
| 只提供 SDK 示例 | 不接受为服务端原子性证明 |
| 条件检查与写入不是原子操作 | TOS 不满足 Route C-Minimal，淘汰 |
| Versioning 开启时条件创建无效 | TOS 不满足 Route C-Minimal，淘汰 |
| 只允许关闭 Versioning 才能条件创建 | 不满足现有基线，不得降低要求 |
| 个人账号不能开通 TOS | TOS 当前个人主体路线淘汰 |
| 明确支持临时角色和最小权限 | 仍需在 Sandbox 中验证实际拒绝行为 |

## 5. 提交后的证据保存

用户自行提交后，可保留：

- 工单编号；
- 官方回复原文或 PDF；
- 官方回复引用的文档链接和更新时间；
- 脱敏后的技术错误码和 HTTP 示例。

不得保存 AccessKey、SecretKey、Session Token、签名 URL、密码、连接串、真实
文件、身份证、银行卡或人脸信息。

## 6. Git 和报告摘要

Before creating this file:

```text
Branch:                        codex/public-github-sync
HEAD:                          101e8a362e430f4fa7b31b67c56823cb702eb1e6
local origin/main:             101e8a362e430f4fa7b31b67c56823cb702eb1e6
Tracked modified:              23
Staged:                        0
Deleted:                       0
Untracked status entries:      124
Untracked files, recursive:    130
```

No source, Schema, Migration, SQL, test, TOS account, Bucket, IAM, KMS, audit,
Provider API, database, Build, deployment, Git index, commit, push or cleanup
operation was executed.

### 6.1 Draft digest

```text
Self-excluding SHA-256:
96B9FE5C37C8D225AB6B6559FB07BF4834E19B407449D0B73172A36B57A7949D

Bytes:           17790
Physical lines:  0326
Non-empty lines: 0271
```

The self-excluding digest replaces the digest token above with 64 zero
characters and hashes the UTF-8 file.
