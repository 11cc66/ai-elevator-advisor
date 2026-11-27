# 百度智能云 BOS 官方工单问题草案 R1

> 状态：DRAFT — 用户尚未提交，厂商尚未回复。
>
> 本文件只包含可复制到百度智能云官方工单系统的问题文本。不得在工单中填写
> 密码、AccessKey、SecretKey、数据库连接串或真实客户文件。身份证、银行卡、
> 人脸等认证资料只能由账号所有人通过百度官方认证页面提交，不进入本仓库。

## 一、提交前需由用户填写

```text
账号类型：中国大陆自然人个人实名认证账号
账号实名阶段：________________
BOS 是否已开通：是 / 否 / 未提交
计划地域：华南-广州（gz） / 华北-北京（bj）
计划 Bucket 类型：STANDARD 单 AZ
计划用途：私有服务端代理对象存储，不向浏览器发放 Provider 凭据
```

如账号控制台在提交前已经明确拒绝个人主体，请不要提交本技术问题作为绕过
实名政策的请求；只需请求确认“个人高级实名认证是否可用于 BOS”。

## 二、可直接复制的工单正文

```text
主题：个人实名认证账号开通 BOS、Versioning 与条件写入的技术确认

您好，

我们计划使用百度智能云 BOS 作为私有文件的服务端代理对象存储。浏览器和
Worker 都不会持有 BOS 凭据，只有服务端 Web Publisher 和只读 Worker Reader
访问 BOS。计划使用标准存储、私有 Bucket、Bucket Versioning、不可复用对象
键和服务端 SHA-256 校验。

当前账号主体为中国大陆自然人个人用户，正在确认账号和产品资格，尚未创建
生产 Bucket，也没有真实客户数据。希望贵方以书面工单方式确认以下问题，并在
可能时提供对应官方文档链接。

一、个人账号资格

1. 当前 BOS 是否允许中国大陆自然人完成个人实名认证及个人高级实名认证后，
   开通并使用 BOS？
2. 个人账号是否可以创建 Bucket、开启 Versioning、创建 IAM 子用户或角色、
   创建自定义最小权限策略并调用 Object API？
3. BOS 控制台中是否存在只允许企业高级实名认证才能开通的地域、存储类型、
   版本控制、IAM、审计或 API 限制？
4. 官网“开始使用 BOS”页面描述了个人高级实名认证路径，但“BOS 一般类问题”
   页面写明“BOS 类产品都需要做企业高级实名认证后才可进行使用”。请确认
   当前适用的正式政策、生效时间和是否存在地域或账号差异。

二、条件写入与 Versioning

5. Bucket 开启 Versioning 后，PutObject 的 If-None-Match: * 是否仍然有效？
6. If-None-Match: * 的判断对象是：
   a) 当前版本；
   b) 任一历史版本；
   c) 逻辑 Object 名，且 Delete Marker 也被视为存在；
   d) 其他规则？
7. 当最新版本是 Delete Marker、但历史版本仍存在时，If-None-Match: * 的
   PutObject 是否允许成功？
8. 两个独立客户端在两个独立连接上同时向同一个不存在的 Key 发送
   If-None-Match: *，是否保证最多一个请求成功？
9. 如果问题 8 有一个请求失败，失败请求的准确 HTTP 状态码和 BOS Error Code
   是什么？是否可能是 409、412 或其他结果？
10. If-None-Match: * 的“最多一个成功”是否是服务端原子保证，而不仅是
    应用侧先 HEAD 后 PUT 的提示？

三、Delete Marker 与并发

11. 开启 Versioning 后，若对同一个 Key 发生以下竞争，官方定义的最终状态
    是什么：
    a) 两个 If-None-Match: * PUT；
    b) 一个 If-None-Match: * PUT 与一个不指定 versionId 的 DELETE；
    c) 一个 If-None-Match: * PUT 与一个指定历史 versionId 的 DELETE？
12. 以上竞争是否使用同一个服务端原子判定？是否存在任一请求返回成功但实际
    被后到请求覆盖当前指针或产生额外当前版本的情况？
13. 成功响应中的 x-bce-version-id 是否与本次成功写入的字节一一绑定，并在
    Versioning 开启时保证唯一、稳定、可用于后续指定版本读取？

四、分片上传

14. CompleteMultipartUpload 是否支持与 PutObject 相同的
    If-None-Match: * 条件创建？
15. 该条件是在 CompleteMultipartUpload 提交时执行一次原子判断，还是在
    InitiateMultipartUpload、UploadPart 或 Complete 的多个阶段分别判断？
16. 两个分片上传任务使用不同 uploadId，但最终对同一个 Object Key 执行
    CompleteMultipartUpload + If-None-Match: * 时，是否保证最多一个成功？
17. CompleteMultipartUpload 成功响应是否返回唯一的 x-bce-version-id？
    如果当前文档没有返回该字段，应通过哪个原子接口取得本次完成的版本号？
18. PutObject 与 CompleteMultipartUpload 在 Versioning、Delete Marker 和
    并发冲突上的语义是否完全一致？

五、精确版本读取

19. Versioning 开启后，GET /<ObjectKey>?versionId=<VersionId> 是否始终返回
    指定历史版本，不受最新版本或 Delete Marker 影响？
20. GetObjectMeta/HEAD 的 versionId 是否具有同样语义？
21. 如果指定 VersionId 不存在，是否明确返回 404/NoSuchVersion 一类错误，
    绝不会回退到最新版本？
22. 是否可以在 ListObjectVersions 或等价接口中按 Key 获取稳定、可分页、
    无遗漏的版本清单？

六、完整性校验

23. PutObject 和 UploadPart 的 x-bce-content-sha256 是否由 BOS 服务端计算并
    校验？不匹配时的准确 HTTP 状态码和 Error Code 是什么？
24. GET 指定 VersionId 时，BOS 是否返回可验证的 SHA-256 或 CRC32/CRC64
    响应头？如果没有 SHA-256 响应头，推荐使用哪种服务端完整性与客户端
    读回组合？
25. ETag 在单段上传、分片上传和 Versioning 场景下分别代表什么？是否可能与
    对象 SHA-256 不同？

七、IAM 权限

26. 是否可以在一个个人实名主账号下创建两个独立 IAM 子用户：
    a) Publisher：仅允许对指定 Bucket/Prefix 执行条件 PutObject 和必要的
       精确读回，不允许 Delete、生命周期、Bucket ACL 或权限变更；
    b) Reader：仅允许 List/GetObject/GetObjectVersion/GetObjectMeta，
       不允许 Put、Delete 或配置变更？
27. IAM 自定义策略是否支持按 Bucket、Object Prefix、Action 和 VersionId
    相关条件进行限制？是否支持禁止 x-bce-forbid-overwrite 之外的删除和
    Bucket 配置权限？
28. 个人账号是否可以创建短期角色或 STS 临时凭证，还是只能使用长期
    AccessKey？如果支持临时凭证，最大有效期、刷新和撤销语义是什么？

八、审计

29. BCT/CloudTrail 对 BOS Object Put/Get/Head/Delete、Delete Marker 和
    IAM 拒绝事件的实际覆盖范围是什么？
30. Bucket 访问日志是“尽力而为”且通常 2-3 小时到达；BCT 是否能提供更可靠
    的对象级审计？个人账号启用 BCT/BLS 是否有额外前提？
31. 如何用请求 ID 将一次 PutObject/CompleteMultipartUpload 的成功响应、
    VersionId 与审计记录关联？

如上述任一能力并非正式支持，请明确说明“不支持”或“需单独审批”，不要仅提供
SDK 示例。SDK 能发送某个字段，不等于服务端具有原子保证。

也请书面确认：

- 是否存在会因欠费、生命周期规则、回收站或账号策略而自动删除已绑定版本的
  行为；
- 推荐用于服务端代理的最小权限策略模板；
- 可否提供一份官方技术确认或工单回复，作为后续隔离 Sandbox 验证的基线。

谢谢。
```

## 三、提交后的证据处理

用户提交后，应只保留：

- 工单编号；
- 百度官方回复的原始文本或 PDF；
- 官方回复中引用的文档链接；
- 不含凭据和敏感身份信息的截图。

不得在仓库中保存身份证明、银行卡、人脸图像、AccessKey、SecretKey、Session
Token、连接串或真实客户文件。

## 四、如何解释厂商回复

| 回复 | 本阶段处理 |
|---|---|
| 明确支持且给出原子、Versioning、Delete Marker 和 HTTP 错误语义 | 可计划 BOS 隔离 Sandbox，但仍需 `NOT TESTED` 测试矩阵 |
| 只回复“可以使用 If-None-Match” | 不足以关闭组合语义缺口 |
| 只提供 SDK 代码 | 不足以证明服务端原子性 |
| 明确不支持个人 BOS | Baidu BOS 淘汰，转向 Volcengine TOS 的同类确认 |
| 明确不支持 Versioning 下条件创建 | Baidu BOS 淘汰，不得用禁用 Versioning 或应用层 HEAD 替代 |
| 回复需要企业账号 | 当前个人主体路线终止 |

## 五、状态

```text
DRAFT ONLY
NOT SUBMITTED
NO PROVIDER RESPONSE
NO SANDBOX AUTHORIZATION
```

### 5.1 Draft digest

```text
Self-excluding SHA-256:
01A8DCC4C95CAF694E352780D245007FA9D00421FD36D7EE19C35A860E3FB9AA

Bytes:           09078
Physical lines:  0192
Non-empty lines: 0151
```

The self-excluding digest replaces the digest token above with 64 zero
characters and hashes the UTF-8 draft.
