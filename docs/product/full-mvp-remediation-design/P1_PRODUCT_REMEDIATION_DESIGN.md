# P1 产品完整性整改设计

任务:

```text
FULL-MVP-REMEDIATION-DESIGN-001
```

日期: 2026-11-23

设计状态:

```text
DESIGN COMPLETE WITH OPEN BLOCKERS
```

本轮只完成设计，不修改源码、Schema、Migration、数据库、测试或配置。Open Blocker 包括必须由电梯专业人员确认的工程规则，以及必须由产品/安全负责人确认的审核角色和保留策略。

## 1. 输入与环境证据

### 1.1 Shell

动态发现的 PowerShell:

```text
C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1119-907-0_26.1119.907.0_x64__3k8sg7r9htsxt\dependencies\native\powershell\pwsh.exe
```

直接子进程核验:

```text
Parent PID: 36448
Child PID: 34920
Child Parent PID: 36448
ExecutablePath: exact discovered candidate
External FileVersion: 7.6.9.500
Internal PSVersion: 7.6.9
Internal PSEdition: Core
Exit code: 0
```

### 1.2 初始工作树

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Untracked entries: 71
Staged: 0
Deleted: 0
```

完整清单记录在 `P1_PRODUCT_REMEDIATION_BASELINE_SNAPSHOT.md`。设计目录开始时不存在。

### 1.3 输入完整性

`docs/product/full-mvp-build` 五个文档哈希全部匹配 `SHA256SUMS.txt`。

| Input | SHA-256 |
|---|---|
| `README.md` | `975C600A0A0CF03684C7D03B5C65F597AFA75D63EFDE32000F692DE73D0A9A76` |
| `MVP_IMPLEMENTATION_STATUS.md` | `703D029B62EA3CEC9DA693F98B35088985AE45510F21621B7EA61DE60BB07FD3` |
| `MVP_ACCEPTANCE_MATRIX.md` | `A88ACF3D1809FADA3CDEC48352B4384FB92867F5090392E37D7BA67EA447B39E` |
| `MVP_ACCEPTANCE_REPORT.md` | `74D0CBB210234812C88DD865F073A1769739AE5E9B0683EA3DB9AE36AE669800` |
| `MVP_KNOWN_LIMITATIONS.md` | `ED319F09A081859DC1677EC049E4712E3A1B43B30EE1E1B083855A5422B64E93` |

```text
Build manifest SHA-256:
4C48F50E387596D9464BF6EE0C2C1EAAD91E808C7C1C2D57302EE86143471077
```

`docs/product/full-mvp-review` 三个文档的长度、行数和哈希全部匹配。

| Input | SHA-256 |
|---|---|
| `FULL_MVP_REVIEW_REPORT.md` | `6CBD7025174E40EF93C7E3D4F23EBE78BC09057CA19CBF740BD1AC6C4BD301E6` |
| `FULL_MVP_REMEDIATION_PLAN.md` | `50B5812D7C69DF4863F672EBE2511AC2687B8B579EE1F28F36AC666DA1C7981D` |
| `FULL_MVP_DEMO_RUNBOOK.md` | `6D79218168CC085040BDF108F207B0F7A406C56724C63EC4F1D6DD82A2862025` |

```text
Review manifest SHA-256:
CBC6240FA37E2533D8B185104B738DF1064F5FBD632814A0C33757FBCC7D1AC9
```

## 2. 当前调用链与根因

### 2.1 Mock 需求提取

当前链路:

```text
POST conversation message
-> messages route reads project latest requirement
-> advisor service reads project latest requirement again
-> MockAIProvider.extractPatch()
-> merge into RequirementDraft
-> create Requirement row and duplicate RequirementRevision row
-> append assistant message separately
```

根因:

- 通过简单子串正则判断肯定/否定，否定词被包含在肯定词中时先命中的规则获胜。
- 每个布尔字段只有一个值，没有候选状态、否定范围、冲突或确认要求。
- 来源只是 `fieldSources: Record<string, string>`，客户端可以覆盖。
- 需求和消息没有完整原子写入。

### 2.2 会话身份

`AdvisorConversation` 目前没有场景字段或当前需求指针。`BuildingRequirement` 虽有 `conversationId`，但读取和消息处理都使用 `project.latestRequirement`。

根因:

- 需求版本的业务 Owner 不明确。
- 没有“当前会话需求”和“项目显式当前需求”两个不同概念。
- 客户端可以提交安装场景，服务端没有与 `Project.projectType` 比较。

### 2.3 目录可信度

当前目录只使用一个 `verificationStatus`，最新规格和价格仅按版本号选择。产品编辑页面可以把产品改为 `VERIFIED`，而来源仍复用演示文本。

根因:

- 产品、规格、价格、来源、审核没有被建模为独立事实。
- `VERIFIED` 是一次无审核工作流的枚举修改。
- `effectiveFrom/effectiveTo` 存在但查询未使用。
- DEMO 身份不是不可变来源属性。

### 2.4 选型

当前引擎用楼层推导载重/速度，并把推导阈值用于硬过滤。缺失 `maxTravelM`、井道、底坑或顶层参数时仍可输出 `OPERATIONAL`。

根因:

- “资料完整性”和“约束是否满足”没有三态区分。
- 工程规则没有权威、版本和审核状态。
- 结果只有 `COMPLETED/NO_VALID_MATCH`，没有 `INSUFFICIENT_DATA`。
- 排除产品被静默丢弃，缺少可解释结果。

### 2.5 并发、销售和 API

需求 PATCH 没有 expected version。销售交接没有绑定需求/选型快照，且先读取全部交接再在应用层过滤。新增写接口没有统一同源校验。

## 3. 目标架构

```text
Contracts
  discriminated unions for extraction outcomes,
  explicit requirement/conversation IDs,
  selection states and catalog trust DTOs

Advisor
  deterministic clause parser -> candidate fields/conflicts
  conversation-owned requirement chain
  server-owned field provenance
  atomic interaction commit with CAS

Catalog
  immutable data classification
  source records
  review records
  product profile/specification/price versions
  effective-time resolvers

Selection
  approved rule sets
  fail-closed eligibility evaluation
  all-candidate traceability
  server-controlled Demo/Formal mode

Sales
  immutable handoff snapshot versions
  SQL-scoped queries

Web/API
  shared authenticated mutation guard
  explicit project/resource ownership
  stable error codes
```

数据库必须在应用授权之外补充跨项目复合外键、版本不可变性和有效期约束，但数据库不能替代服务端权限判断。

## 4. 设计 A：需求语义、会话和项目场景

### 4.1 提取结果协议

将单一 `Partial<RequirementDraft>` patch 改为字段候选集合:

```text
RequirementExtractionOutcome
  fieldKey
  status:
    EXTRACTED_EXPLICIT
    NEEDS_CONFIRMATION
    CONFLICT
    ABSENT
  proposedValue?
  candidates[]
  sourceRefs[]
  ruleId
  ruleVersion
  rationaleCode
```

每个 candidate:

```text
value
normalizedSpan
sourceMessageId
sourceText
matchedPhrase
negationDepth
```

只有 `EXTRACTED_EXPLICIT` 能自动进入下一需求草稿。`NEEDS_CONFIRMATION`、`CONFLICT` 和 `ABSENT` 均不得写入肯定布尔值。

### 4.2 否定语义规则

解析顺序:

1. Unicode NFKC、统一全半角、规范化空白。
2. 按标点和明确连接词切分简单子句。
3. 先匹配完整否定短语，再匹配肯定短语。
4. 验证否定词与“外装/井道/外部安装”等目标词属于同一子句且在允许跨度内。
5. 识别多重否定、跨子句和不确定词。
6. 同一消息有多个候选时按值归并；不同值必须产生 `CONFLICT`。

自动接受:

| 输入 | 结果 |
|---|---|
| `外装允许` | `true / EXTRACTED_EXPLICIT` |
| `可以外装` | `true / EXTRACTED_EXPLICIT` |
| `外装不允许` | `false / EXTRACTED_EXPLICIT` |
| `不允许外装` | `false / EXTRACTED_EXPLICIT` |
| `外装不可以` | `false / EXTRACTED_EXPLICIT` |
| `外装不可行` | `false / EXTRACTED_EXPLICIT` |

必须确认、不自动写入:

| 输入 | 结果 | 原因 |
|---|---|---|
| `暂时不确定是否允许外装` | `NEEDS_CONFIRMATION` | 明确不确定 |
| `不排除外装` | `NEEDS_CONFIRMATION` | 双重否定，不能等同明确允许 |
| `不允许内装以外的方案` | `NEEDS_CONFIRMATION` | “内装以外”的范围和目标不直接 |
| 同一句“外装允许，但也不允许外装” | `CONFLICT` | 同一子句/消息内冲突 |

纠正语义:

| 场景 | 结果 |
|---|---|
| 上一版 `true`，本轮 `现在外装不允许` | `false`，旧值标记 `INVALIDATED`，写独立纠正记录 |
| 上一版 `true`，本轮只有 `外装不允许` | 创建冲突并要求确认，除非产品规则明确把普通否定视为纠正 |
| `原本允许，现在不允许` | 新值 `false`，保留“原本允许”为历史证据 |

“原本允许，现在不允许”必须由后置时间标记或纠正词驱动，不得靠简单替换。

### 4.3 会话级需求

目标关系:

```text
Project 1 -> N AdvisorConversation
AdvisorConversation 1 -> N BuildingRequirement versions
AdvisorConversation.currentRequirementId -> current version
ProjectRequirementHead -> optional explicit project current requirement
```

强制规则:

- 新需求必须属于具体 conversation。
- 读取会话时只按 `conversationId` 查找该会话需求链。
- 禁止用 `project.latestRequirement` 作为会话读取或 PATCH 来源。
- 项目级当前需求只能通过独立显式指针取得。
- 不同会话默认不共享可变需求；可在同一项目内引用已确认快照，但引用必须新记录且不可变。
- 会话关闭后可读，不可继续写；需要继续沟通时创建新会话。
- Requirement、Message、Revision 不允许普通删除。

### 4.4 Project Type 绑定

规则:

- 新项目由服务端在创建时保存三种规范场景之一。
- 旧 `OLD_BUILDING_ELEVATOR` 只在迁移兼容层规范化为 `OLD_BUILDING_ADDITION`。
- 创建会话不得接收安装场景；服务端从 `Project.projectType` 派生并保存到 conversation。
- Requirement PATCH 不接受场景修改。
- 任一 conversation 已存在后，Project Type 不可修改。
- 修改场景必须创建新项目；如未来批准迁移，必须有独立管理流程、理由、审计和新版本。
- 客户端提交不同场景返回 `409 PROJECT_SCENARIO_IMMUTABLE` 或 `422 SCENARIO_CONTRACT_VIOLATION`，不得静默忽略。

### 4.5 需求版本与 CAS

写请求必须包含:

```text
requirementId
expectedVersion
```

事务:

1. `SELECT advisor_conversation FOR UPDATE`.
2. 验证 project/conversation 关系、状态和 current requirement pointer。
3. 验证 `currentRequirement.id`、`version` 与请求一致。
4. 插入新 Requirement version。
5. 插入 RequirementFieldValue、Conflict、Revision 和 AuditLog。
6. 更新 `conversation.currentRequirementId`。
7. 提交。

版本不匹配:

```text
HTTP 409 REQUIREMENT_VERSION_CONFLICT
currentRequirementId
currentVersion
lastUpdatedAt
```

不得自动覆盖或静默重试用户编辑。

### 4.6 Mock 交互原子性

Mock AI 为纯确定性计算，可在一次数据库事务中完成:

```text
lock conversation
-> load current requirement
-> append user message
-> parse
-> create field outcomes/conflicts
-> create new requirement draft
-> update conversation pointer
-> append assistant message
-> audit
-> commit
```

未来真实 Provider 的模型调用不能持有数据库事务。其流程必须:

1. 读取并记录 input digest/version。
2. 事务外调用 Provider。
3. 重新开启事务，验证 conversation current pointer 未变化。
4. 变化则拒绝或要求重试，不覆盖新版本。

消息增加服务端/客户端幂等键:

```text
clientMessageId
UNIQUE(conversationId, clientMessageId)
```

相同用户重试不得重复创建用户消息、需求版本或 assistant 消息。

### 4.7 字段来源

新增服务端拥有的 `RequirementFieldValue`，至少包含:

```text
requirementId
fieldKey
value
unit
sourceType
sourceMessageId
sourceSpan
sourceTextSnapshot
ruleId/ruleVersion
status
requiresProfessionalReview
confirmedBy/confirmedAt
supersedesFieldValueId
```

来源类型使用 D03 的分类；Mock 输出必须标记 `MOCK_AI`，客户手动输入标记 `CUSTOMER_STATED`。客户端不得直接写来源、确认状态或专业状态。

### 4.8 建议 Schema 增量

`AdvisorConversation`:

```text
installationScenario InstallationScenario
currentRequirementId String?
closedAt DateTime?
closedById String?
```

`BuildingRequirement`:

```text
conversationId required for all new writes
engineVersion
fieldStateDigest
```

`ProjectRequirementHead`:

```text
projectId @id
requirementId @unique
conversationId
requirementVersion
selectedById
selectedAt
```

`AdvisorMessage`:

```text
clientMessageId String?
requestId String?
UNIQUE(conversationId, clientMessageId)
```

`RequirementFieldValue` and `RequirementConflict` use the fields described above.

所有旧字段先保留。只有 Backfill/Validate 证明无歧义后，才可增加 NOT NULL 或收缩旧路径。

## 5. 设计 B：产品目录可信度

### 5.1 独立可信度维度

厂商、品牌、产品修订、规格版本、价格、来源和审核均有独立状态。最终“可推荐性”是服务端派生的聚合结果，不保存为客户可编辑的单一布尔值。

新增核心枚举:

```text
CatalogLifecycleStatus:
  DRAFT
  PENDING_REVIEW
  APPROVED
  REJECTED
  EXPIRED
  WITHDRAWN
  SUSPENDED
  DEMO_MOCK
  LEGACY_REVIEW_REQUIRED

CatalogSourceType:
  MANUFACTURER_OFFICIAL
  AUTHORIZED_TECHNICAL
  THIRD_PARTY_PUBLIC
  INTERNAL_MANUAL
  DEMO_MOCK
  UNVERIFIED

CatalogReviewDecision:
  APPROVE
  REJECT
  REVOKE
```

`DataClassification` 与生命周期分离。DEMO 身份来自不可变分类，不来自名称字符串。

### 5.2 来源模型

新增 `CatalogSource`:

```text
id
sourceType
dataClassification
title
issuer
opaqueLocator
contentDigest?
collectedAt
validFrom?
validTo?
reviewStatus
reviewedBy?
reviewedAt?
withdrawnBy?
withdrawnAt?
withdrawalReason?
createdBy
createdAt
```

不把虚构 URL 填入真实来源字段。`DEMO_MOCK` 来源必须使用明确虚构 locator，不能转换为真实来源。

### 5.3 审核模型

新增 `CatalogReview`:

```text
id
subjectType
subjectId
subjectVersion
decision
reviewerUserId
reviewerRolesSnapshot
reviewedAt
reason
inputDigest
```

证据通过 `CatalogReviewEvidence` 关联一个或多个 `CatalogSource`。

规则:

- `catalog.manage` 只能创建/提交草稿。
- 新 `catalog.review` 权限才能批准或撤回。
- 前端不能通过修改枚举直接改变审核状态。
- 高风险分离职责是否要求提交人与审核人不同，需产品负责人确认；设计默认禁止自审，除非配置明确批准。
- `SYSTEM_ADMIN` 不自动具备技术审核权。

### 5.4 产品、规格和价格版本

为避免名称/适用场景的原地修改改变已审核产品，目标模型增加:

```text
ProductModel         stable identity + brand + active
ProductRevision      versioned name/description/applicable scenarios/status/source
ProductSpecification versioned technical parameters/status/source/effective dates
ProductPrice         versioned region/currency/tax/scope/status/source/effective dates
```

建议将 `applicableScenarios` 迁移为关系表 `ProductScenarioApplicability`，避免未约束 JSON 承担选型硬语义。

- Product metadata 编辑创建新 revision。
- 已有 APPROVED revision 保持不变。
- 新 revision 审核通过后才成为 active revision。
- 规格或价格编辑创建独立新版本。
- 旧版本保留并标记 `SUPERSEDED`，不能原地覆盖。
- 选中推荐必须记录 `productRevisionId`、`specificationId`、`priceId`。

### 5.5 规格与价格有效期

规格:

- `effectiveFrom` 必填。
- `effectiveTo` 可空，但必须晚于 `effectiveFrom`。
- 同一产品/active revision 的 APPROVED 规格有效期不得重叠。
- 当前时点没有唯一有效规格时，结果状态为 `INSUFFICIENT_DATA` 或 `REQUIRES_PROFESSIONAL_REVIEW`。

价格:

- 增加 priceType、unit、taxIncluded、scope、region、currency、source。
- 有效期不得重叠，查询必须按需求地区/币种/范围筛选。
- 过期、撤回或未批准价格不得产生 `WITHIN_BUDGET`。
- 无有效价格的技术候选可保留，但 `priceStatus=REQUIRES_QUOTE`，不是正式报价。

数据库可使用 CHECK、部分唯一索引和 PostgreSQL exclusion constraint 保证有效期不重叠；具体 SQL 在实施阶段独立审查。

### 5.6 DEMO 隔离

- `dataClassification=DEMO_MOCK` 创建后不可修改。
- `DEMO_MOCK` 产品/revision/specification/price 只能处于 `DEMO_MOCK` 生命周期。
- DEMO 来源不能绑定正式产品，正式来源也不能转为 DEMO。
- 普通编辑 API 不得接受 dataClassification 或直接 verification status。
- 正式查询完全排除 DEMO。
- Demo 查询必须有服务端启动配置/受控常量，不接受客户端 `mode=demo`。
- Demo 结果由独立 `PRELIMINARY` 状态和视觉标记展示。

### 5.7 聚合可信度

服务端提供 `CatalogTrustAssessment`:

```text
manufacturerAssessment
brandAssessment
productRevisionAssessment
specificationAssessment
priceAssessment
sourceAssessment
reviewAssessment
derivedFormalEligibility
reasons[]
```

任一必需维度不是当前有效 APPROVED/非 Demo，都不能生成 OPERATIONAL。

### 5.8 目录状态机

目录对象生命周期:

```text
DRAFT
  -> PENDING_REVIEW
  -> APPROVED
  -> SUPERSEDED

PENDING_REVIEW
  -> REJECTED
  -> WITHDRAWN

APPROVED
  -> EXPIRED
  -> WITHDRAWN
  -> SUSPENDED

DEMO_MOCK
  -> WITHDRAWN
```

约束:

- `DRAFT`、`PENDING_REVIEW`、`REJECTED` 和 `WITHDRAWN` 不进入正式选型。
- `SUPERSEDED` 只作为历史版本。
- `DEMO_MOCK` 不允许进入 `PENDING_REVIEW/APPROVED`。
- 已批准对象修改内容必须创建新版本；旧版本不可原地回到 `DRAFT`。
- Suspend/Withdraw 写审核记录和 AuditLog，不删除历史。
- 状态转换只能由对应服务/受控数据库函数执行，普通更新不得绕过。

## 6. 设计 C：选型安全准入

### 6.1 状态模型

候选状态:

```text
OPERATIONAL
PRELIMINARY
INSUFFICIENT_DATA
NOT_ELIGIBLE
REQUIRES_PROFESSIONAL_REVIEW
```

运行结果:

```text
COMPLETED_WITH_OPERATIONAL_MATCH
COMPLETED_PRELIMINARY_ONLY
INSUFFICIENT_DATA
NO_ELIGIBLE_MATCH
FAILED
```

语义:

- `OPERATIONAL`: 正式目录、正式规则集、专业需求数据、完整技术参数和必要审核均成立。
- `PRELIMINARY`: Demo 或探索性候选，不得作为运营级推荐。
- `INSUFFICIENT_DATA`: 关键需求或产品参数缺失。
- `NOT_ELIGIBLE`: 已知不满足权威规则。
- `REQUIRES_PROFESSIONAL_REVIEW`: 规则或专业输入尚未确认。

### 6.2 规则权威

新增版本化 `SelectionRuleSet` / `SelectionRule`:

```text
ruleSetId
version
installationScenario
status DRAFT | PENDING_REVIEW | APPROVED | RETIRED
authorityName
authoritySourceId
effectiveFrom/effectiveTo
approvedBy/approvedAt

ruleKey
ruleType
fieldKey
operator
thresholdValue?
thresholdUnit?
requiredEvidenceType
sourceId
```

本设计不定义任何载重、速度、井道、底坑或顶层数值阈值。当前 `<=6 => 800kg`、`<=12 => 1000kg` 等规则没有审查依据，必须在下一实现中退出硬准入，直到专业人员批准。

没有 APPROVED rule set 时:

- 正式模式不得返回 `OPERATIONAL`。
- Demo 只能返回 `PRELIMINARY`。
- 需要硬条件但无权威规则时返回 `REQUIRES_PROFESSIONAL_REVIEW`。

### 6.3 关键参数准入

参数状态使用:

```text
PRESENT
MISSING
NOT_APPLICABLE
CONFLICTED
UNVERIFIED
```

产品侧必需字段由已批准 eligibility profile 定义，至少覆盖 D07 中:

```text
capacityKg
speedMps
maxFloors / stops
maxTravelM
shaftWidthMm
shaftDepthMm
pitDepthMm
overheadMm
machineRoomType
doorConfiguration
```

需求侧同理检查用途、楼层、层高/总高、预算、外装条件，以及正式工程阶段所需的专业测量字段。

缺失关键参数:

- 不得解释为符合。
- 不得产生无警告 `OPERATIONAL`。
- 结果为 `INSUFFICIENT_DATA`。
- 可保留为 `PRELIMINARY` 展示，前提是 Demo 模式且明确显示所有缺失项。

### 6.4 联合准入算法

对每款产品:

1. 检查来源、分类、厂商、品牌、产品 revision、规格、审核和有效期。
2. 检查是否允许在当前 Demo/Formal 模式出现。
3. 检查关键参数完整性。
4. 检查需求和产品数据状态。
5. 应用已批准硬规则；未批准规则产生 `REQUIRES_PROFESSIONAL_REVIEW`。
6. 已知不满足产生 `NOT_ELIGIBLE`，保留原因。
7. 所有硬条件通过且证据完整才可 `OPERATIONAL`。
8. 价格单独评估；无有效价格不伪造预算结论。
9. 专业审核要求始终保留。

### 6.5 结果可解释性

新增 candidate result:

```text
productId
productRevisionId
specificationId
priceId?
eligibilityStatus
checkResults[]
missingFields[]
unmetConstraints[]
unverifiedConditions[]
sourceIds[]
ruleSetId/version
riskWarnings[]
```

`checkResult`:

```text
checkKey
status PASS | FAIL | UNKNOWN | NOT_APPLICABLE | REQUIRES_AUTHORITY
expected
actual
unit
sourceRef
reasonCode
```

不得静默丢弃排除产品。所有评估过的候选都进入结果，使用分页或筛选控制响应体积。

### 6.6 预算

增加显式预算模式:

```text
REFERENCE
HARD_CAP
```

- 默认 `REFERENCE`。
- 只有可靠提取或客户明确确认“不超过”时才允许 `HARD_CAP`。
- `HARD_CAP` 也需要可追溯来源和客户确认。
- 过期/撤回/未审核价格返回 `REQUIRES_QUOTE`，不返回预算通过。

### 6.7 选型状态机

候选状态优先级:

```text
NOT_ELIGIBLE
  > INSUFFICIENT_DATA
  > REQUIRES_PROFESSIONAL_REVIEW
  > OPERATIONAL
  > PRELIMINARY
```

含义是失败或不足优先于通过；“>”只表示 fail-closed 优先级，不是产品等级。

运行汇总:

```text
if evaluation error -> FAILED
else if any OPERATIONAL -> COMPLETED_WITH_OPERATIONAL_MATCH
else if only PRELIMINARY -> COMPLETED_PRELIMINARY_ONLY
else if any INSUFFICIENT_DATA/REQUIRES_PROFESSIONAL_REVIEW -> INSUFFICIENT_DATA
else -> NO_ELIGIBLE_MATCH
```

状态只能由确定性引擎产生，客户端不得提交或覆盖。

## 7. 设计 D：并发、快照与跨项目一致性

### 7.1 需求 CAS

如图 4.5。所有修改类 API 使用 expected version，且确认也是 CAS。并发冲突不回滚其他已提交版本，不静默合并，保留冲突审计。

### 7.2 销售交接模型

将当前单一可变 `sales_handoff` 拆成:

```text
SalesHandoffCase
  id
  projectId UNIQUE
  currentSnapshotId
  status
  assignedToId?

SalesHandoffSnapshot
  id
  handoffCaseId
  version
  projectId
  conversationId
  requirementId
  requirementVersion
  selectionRunId
  requirementSnapshotDigest
  selectionSnapshotDigest
  productSpecificationIds[]
  priceIds[]
  summary
  budgetConcern
  createdById
  createdAt
```

`SalesHandoffSnapshot` 不可更新或删除。发送新交接会增加新 snapshot，旧 snapshot 保留。

事务:

1. 锁定 handoff case。
2. 验证 requirement 属于项目/会话且已客户确认。
3. 验证 selectionRun 属于同一项目和 requirement。
4. 验证规则版本、规格和价格引用完整。
5. 计算 canonical JSON digest。
6. 写入新 snapshot。
7. 更新 case pointer。
8. 写 AuditLog。

销售页面必须区分:

```text
交接时快照
项目当前确认需求/当前推荐
两者是否不同
```

当前状态变化不能覆盖旧交接。

### 7.3 数据库复合关系

必须增加的最小复合关系:

| 子对象 | 约束 |
|---|---|
| Conversation | `UNIQUE(id, projectId)` |
| Requirement | `UNIQUE(id, projectId, conversationId)`; `(conversationId, projectId) -> Conversation(id, projectId)` |
| Conversation current pointer | `(currentRequirementId, id, projectId)` -> Requirement `(id, conversationId, projectId)` |
| ProjectRequirementHead | `(projectId, requirementId)` -> Requirement `(projectId, id)` |
| SelectionRun | `UNIQUE(id, projectId)`; `(requirementId, projectId)` -> Requirement `(id, projectId)` |
| SelectionCandidate | `(specificationId, productId)` -> Specification `(id, productId)` |
| SalesHandoffSnapshot | `(requirementId, projectId)`、`(selectionRunId, projectId)` 复合外键 |
| SalesFollowUpNote | 保留 handoff FK；读取先解析授权项目 |

建议的 unique 实体键:

```text
project(id)
advisor_conversation(id, projectId)
building_requirement(id, projectId, conversationId)
product_model(id)
product_specification(id, productId)
selection_run(id, projectId)
```

Nullable 复合 FK 必须配 CHECK，防止部分 NULL 绕过。数据库约束用于防御错误写路径，API 仍需逐请求授权。

### 7.4 不可变历史

使用 Trigger 或受控数据库权限拒绝普通 UPDATE/DELETE:

- Requirement version snapshots
- RequirementRevision
- SelectionRun input/output snapshot
- SelectionCandidate result
- SalesHandoffSnapshot
- CatalogSource withdrawal history and CatalogReview

状态变化通过新增记录和受控状态 transition 完成，不原地改写历史。

### 7.5 需求、选型和交接状态边界

```text
Conversation ACTIVE -> CLOSED
Requirement DRAFT -> CUSTOMER_CONFIRMED
Requirement version -> immutable after commit
Selection run -> immutable after commit
Sales handoff snapshot -> immutable after commit
Sales handoff case status -> mutable follow-up state only
```

- Closed conversation cannot accept messages or edits.
- Confirmation creates a new confirmed version; prior version remains.
- A selection run binds exactly one confirmed requirement version.
- A handoff snapshot binds one confirmed requirement and one completed selection run.
- New customer changes create new versions and do not mutate prior runs/snapshots.

## 8. 设计 E：同源与销售查询

### 8.1 统一 Mutation Guard

新增共享 server helper:

```text
withAuthenticatedMutation(request, {
  parse,
  permission,
  projectResolver,
  handler
})
```

顺序:

1. `requireApiActor`.
2. `assertSameOrigin`.
3. Zod parse.
4. service-level project/resource authorization.
5. mutation.

所有新增 POST/PATCH/PUT/DELETE 使用该 helper。文件和现有授权 mutation 逐步迁移到同一策略，不降低现有 `assertSameOrigin`。

不允许新增 API 局部自行定义不同 CSRF 行为。

### 8.2 SQL 侧销售过滤

Repository API:

```text
listSalesHandoffs({
  globalAccess: boolean,
  authorizedProjectIds: string[],
  cursor,
  limit
})
```

- 全局权限: 仅按分页和状态过滤。
- 项目权限: `WHERE projectId = ANY(authorizedProjectIds)` 在 join/aggregate/limit 前执行。
- 无授权项目: 返回空页，不执行全表扫描。
- Detail: 未授权项目返回 404/403，不得通过 timing/错误/content 暴露存在性。
- Count: 只统计过滤后集合。
- 排序: `(updatedAt DESC, id DESC)` 稳定分页。

## 9. API 契约建议

### 9.1 会话与需求

```text
POST /api/projects/[projectId]/advisor/conversations
  body: {}
  scenario derived server-side

GET /api/projects/[projectId]/advisor/conversations/[conversationId]
  -> conversation + conversationCurrentRequirement

POST /api/projects/[projectId]/advisor/conversations/[conversationId]/messages
  body:
    content
    clientMessageId
    expectedRequirementVersion
  -> user/assistant messages + new requirement version

GET /api/projects/[projectId]/advisor/conversations/[conversationId]/requirement
PATCH .../requirement
  body:
    expectedVersion
    patch: field-to-value patch
POST .../requirement/confirm
  body: expectedVersion
```

旧项目级 `/requirements` 保留只读兼容层时可以返回 project head，但不得作为旧会话编辑入口。新写入口必须带 conversation 和 expected version。

### 9.2 选型

```text
POST /api/projects/[projectId]/selection-runs
  body:
    requirementId
    expectedRequirementVersion
```

无需客户端 mode。服务端根据部署/数据分类建立 `DEMO_PRELIMINARY` 或 `FORMAL` 评估上下文。

GET 结果返回所有 candidate statuses、warnings、missing fields 和 rule version。

### 9.3 目录

```text
POST  /api/admin/catalog/products                  // creates draft
PATCH /api/admin/catalog/products/[id]             // creates draft revision
POST  /api/admin/catalog/product-revisions/[id]/submit
POST  /api/admin/catalog/specifications/[id]/submit
POST  /api/admin/catalog/prices/[id]/submit
POST  /api/admin/catalog/reviews/[id]/decision
POST  /api/admin/catalog/reviews/[id]/revoke
```

普通产品 POST/PATCH 不得包含 `verificationStatus`。审核端决定 APPROVED/REJECTED。

### 9.4 销售

```text
POST /api/projects/[projectId]/sales-handoffs
  body:
    requirementId
    selectionRunId
    summary
    budgetConcern?

GET /api/admin/sales?...cursor
POST /api/admin/sales/[handoffCaseId]/snapshots/[snapshotId]/notes
```

## 10. 权限边界

新增/调整:

```text
catalog.review
selection.rules.review
```

- Customer: 项目内 advisor/requirement/selection/handoff create；不能审核目录或规则。
- Sales: 只读交接快照和跟进；不能修改客户需求或直接执行目录审核。
- Product Admin: 创建和提交产品草稿，不能自批。
- Technical Reviewer: 审核来源/规格。
- Selection Rule Authority: 审核规则集；具体角色待确认。
- System Admin: 账号与配置，不自动获得工程审批。
- 所有请求仍要服务端验证项目 scope。

## 11. 历史数据与兼容策略

不得直接修改已应用 Migration。未来实施使用新的 forward migrations。

### 11.1 Expand

- 增加 nullable 新列、新表、新枚举。
- 保留旧 API 和旧字段一个过渡周期。
- 建立新写入路径的双写/快照读取。

### 11.2 Preflight

在迁移前执行只读检查:

1. 每个 Conversation 的需求场景是否一致。
2. Requirement 的 conversation/project 是否一致。
3. VERIFIED 产品的来源与审核证据是否完整。
4. Spec/Price 有效期是否重叠或缺失。
5. SalesHandoff 是否存在可唯一确定的需求和选型。

任一类出现歧义:

```text
FAIL CLOSED / DO NOT GUESS
```

### 11.3 Backfill

- Demo data 保持 Demo。
- 无新审核记录的 VERIFIED 数据迁移为 `LEGACY_REVIEW_REQUIRED`，正式目录排除，等待人工审核。
- 无有效期的规格/价格迁移为 `EFFECTIVE_DATE_UNRESOLVED`，不能用于正式选型。
- 只有一个合法解释的 conversation scenario 可回填；多解时不回填并保留 legacy flag。
- 现有销售交接若无法关联需求/选型，标记 `LEGACY_UNSNAPSHOTTED`，只读展示并提示重新发起交接，不把当前状态伪造成历史快照。

### 11.4 Validate/Contract

- 所有数据修复完成后，再将关键列设为 NOT NULL。
- 先添加 FK/CHECK `NOT VALID`，验证后 `VALIDATE CONSTRAINT`。
- 删除/重命名旧字段必须另立 contract migration，且需独立审查；第一轮整改不执行。

### 11.5 产品行为兼容

- Formal selection 在缺少权威规则时关闭；Demo flow 仍可运行但标记 PRELIMINARY。
- 旧已保存 selection run 保留为历史，不重新标记为 OPERATIONAL；可通过 `legacyBasis=true` 展示。

## 12. 错误与安全失败

| 情况 | 结果 |
|---|---|
| 需求版本冲突 | 409 + current version metadata |
| 场景与项目不一致 | 409/422，no mutation |
| 语义模糊/冲突 | 200 structured `NEEDS_CONFIRMATION`/`CONFLICT`，no field change |
| 设备数据缺失 | selection `INSUFFICIENT_DATA` |
| 规格/价格过期 | catalog/selection exclusion or `REQUIRES_QUOTE` |
| Source withdrawn | formal exclusion |
| Demo classification | formal exclusion |
| Handoff missing snapshot | `LEGACY_UNSNAPSHOTTED`, no editable snapshot |
| Existing data ambiguity | migration preflight blocks; no guessing |

## 13. 实施阶段

### Stage 1 — Requirement identity and semantics

Files:

```text
packages/contracts/src/index.ts
apps/web/src/modules/advisor/*
apps/web/src/modules/mvp/store.ts
apps/web/src/app/api/projects/**/advisor/**
apps/web/src/app/api/projects/**/requirements/**
prisma/schema.prisma
new migration
```

Schema:

- conversation scenario/current requirement;
- explicit project head;
- field values/conflicts;
- composite conversation/project relations;
- message idempotency.

Tests:

- all negation cases;
- conversation isolation;
- scenario binding;
- CAS;
- transaction rollback.

Acceptance:

- no project-latest lookup in conversation paths;
- no scenario input accepted from client;
- ambiguous extraction cannot write boolean.

Independent review: Yes.

### Stage 2 — Catalog trust

Files:

- catalog contracts/store/API/admin UI;
- schema/migrations;
- seed and test fixtures.

Schema:

- sources, reviews, immutable data classification;
- product revision, spec/price effective validity.

Tests:

- source/review/status matrix;
- demo cannot promote;
- effective windows and expired prices;
- manufacturer/brand/spec/product joint gate.

Acceptance:

- VERIFIED cannot be set through ordinary edit;
- formal query excludes Demo and LEGACY_REVIEW_REQUIRED.

Independent review: Yes.

### Stage 3 — Selection fail-closed

Files:

- `packages/selection-engine`;
- selection service/contracts/UI;
- rule/schema tests.

Tests:

- missing critical field cases;
- approved/unapproved rule sets;
- complete but failed constraints;
- all-candidate explanations.

Acceptance:

- missing critical data never yields OPERATIONAL;
- no numeric engineering threshold without approved source;
- Demo only yields PRELIMINARY.

Independent review: Yes.

### Stage 4 — Sales snapshots and consistency

Files:

- sales contracts/store/API/UI;
- new migration/triggers;
- shared mutation guard.

Tests:

- snapshot immutable after changes;
- SQL-scoped listing;
- same-origin mutations;
- cross-project ID combinations.

Independent review: Yes.

### Stage 5 — Regression and browser acceptance

- package tests;
- DB tests in isolated test DB;
- API/E2E;
- browser desktop/mobile;
- independent review.

No implementation should claim complete until these pass.

## 14. Rollback and compatibility

- Schema uses forward migrations; no destructive down migration.
- Additive columns/tables first.
- Existing client continues read compatibility while UI migrates.
- If formal selection cannot be safely enabled, keep it feature-gated off; Demo still returns Preliminary with explicit limitations.
- A failed migration leaves all data; stop before contract phase.
- `SalesHandoff` legacy records remain read-only until reissued.
- Never use data rewrite to force green tests.

## 15. Final design checks

```text
All P1 review findings mapped: YES
P1-3 upload integration included: NO, intentionally separate
Unapproved engineering thresholds introduced: NO
Missing critical parameter => unqualified OPERATIONAL: NO
DEMO source can become VERIFIED: NO in target design
Old conversation reads another conversation requirement: NO in target design
Cross-project ID combinations DB-protected: YES, target design
Sales snapshot overwritten by later requirement: NO in target design
Executable acceptance tests specified: YES
```

Open blockers are listed separately in `P1_PRODUCT_REMEDIATION_OPEN_DECISIONS.md`.

## 16. Future Authorization Packaging

Potentially batchable after this design is independently approved:

- Stage 1 local parser rules and UI confirmation states that do not change schema;
- Stage 1 contract renaming and test additions;
- Stage 5 documentation, test harness and browser-run preparation.

Must remain separate high-risk authorizations:

- requirement/conversation composite constraints and migration;
- catalog source/review/revision migration;
- engineering rule authority and `OPERATIONAL` enablement;
- selection engine hard-gate replacement;
- sales snapshot and append-only triggers;
- cross-project database constraints;
- same-origin enforcement rollout across existing mutations.

Must not be merged into this product remediation:

- P1-3 Upload Intent/Attempt/Lifecycle integration;
- FileVersion chain-field repair;
- P1-3 Trigger relaxation;
- file cleanup/recovery/runtime authority;
- Native RPC or deployment work.
