# P1-3 C-6.2-G Lifecycle 初始状态白名单设计验收报告

## 1. 审查基线

- 阶段：`C-6.2-G`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 数据库：`NOT CONNECTED`
- A Migration：已应用，`20261117130000_phase37_p13_lifecycle_insert_guard`
- C-6.2-F 结论：`PASS WITH WARNINGS`

当前 Lifecycle BEFORE Trigger：

```sql
BEFORE INSERT OR UPDATE OR DELETE
ON storage_object_lifecycle
FOR EACH ROW
EXECUTE FUNCTION p13_protect_storage_lifecycle();
```

A 已使 INSERT cleanup attestation 生效，但尚未限制普通初始状态。

## 2. Git 分支、HEAD 和工作树

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD:   b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树中的既有未提交内容保持不变。本轮只新增设计/报告，并更新测试方案和实现状态。

## 3. 已审查文件清单

本轮读取并审查：

- `prisma/schema.prisma`
- 原始 P1-3 Migration
- A Migration
- `p13_protect_storage_lifecycle()`
- `p13_assert_staging_cleanup_attestation()`
- `p13_assert_staging_cleanup_attestation_trigger()`
- 四个 Lifecycle Deferred Constraint Trigger
- `p13_storage_lifecycle_truncate_guard`
- Lifecycle CHECK、FK、索引
- Fixture Builder
- Harness、Types
- P1-3 数据库行为测试方案
- C-6.2-C2 决策
- C-6.2-F 报告
- 实现状态文档

## 4. 当前 Lifecycle 保护机制

### 4.1 字段约束

CHECK/FK 负责：

- kind 与 reserved owner；
- `staging/` / `objects/` 命名空间；
- owner、generation、lease 组合；
- content 和 cleanup 字段；
- close attestation；
- Lifecycle 与 Intent/Attempt/Operation/FileVersion 的复合关系。

这些约束验证字段形状，不能证明记录经过合法初始创建路径。

### 4.2 BEFORE Trigger

A 后，所有 Lifecycle INSERT 都进入：

```text
p13_protect_storage_lifecycle()
```

当前 INSERT 分支只调用：

```text
p13_assert_staging_cleanup_attestation(NEW)
```

CANONICAL 在该函数中立即返回，因此 A 不限制 CANONICAL 初始状态。

### 4.3 Deferred Constraint Trigger

以下四个 Trigger 仍在最终事务检查阶段验证关系：

```text
p13_lifecycle_upload_chain_guard
p13_lifecycle_operation_guard
p13_lifecycle_file_version_bijection_guard
p13_staging_cleanup_attestation_guard
```

它们不能证明直接 INSERT 的状态不是来自非法跳转。

### 4.4 当前可绕过路径

B 前，符合条件的下列状态仍可能通过直接 INSERT：

- STAGING 中间态；
- CANONICAL ACTIVE；
- CANONICAL QUARANTINED；
- CANONICAL PURGE_PENDING；
- CANONICAL DELETED；
- CANONICAL FAILED_RETAINED。

具体记录能否提交仍取决于 CHECK、FK 和 Deferred Trigger，但这不等同于生命周期来源合法。

## 5. 普通初始状态白名单

```text
STAGING   -> STAGING_RESERVED
CANONICAL -> FINALIZING
```

其他普通直接 INSERT 全部 fail closed。

重点：

- STAGING `STAGING`、`STAGING_READY`、`STAGING_ABANDONED` 禁止直接 INSERT；
- CANONICAL `ACTIVE`、`QUARANTINED`、`PURGE_PENDING`、`DELETED`、`FAILED_RETAINED` 禁止直接 INSERT；
- 未知枚举、NULL 和新增未列白名单值不能默认为允许；
- UPDATE 状态转换规则不是初始 INSERT 规则，两者必须分开。

## 6. 方案 A/B/C/D 比较

| 方案 | 正确性 | 特殊协议隔离 | UPDATE 兼容 | 复杂度 | 结论 |
|---|---|---|---|---|---|
| A：扩展现有函数 | 高 | 默认全部拒绝 | 不影响 | 低 | 推荐 |
| B：新增独立 BEFORE Trigger | 高 | 默认全部拒绝 | 不影响 | 中 | 不推荐 |
| C：CHECK 约束 | 不能区分 INSERT/UPDATE | 无法可靠隔离 | 会破坏合法 UPDATE | 高 | 不采用 |
| D：RLS/受控函数/新列 | 可更强 | 需要角色/ACL/结构 | 需额外设计 | 高 | 超出 B |

方案 B 的主要问题是两个 BEFORE INSERT Trigger 的触发顺序依赖名称排序，错误优先级不够直观。

方案 C 的 CHECK 会同时约束 UPDATE，不能表达“仅初始 INSERT 允许”的规则。

方案 D 涉及 ACL、角色、RLS 或结构修改，不属于最小 B。

## 7. 最终推荐方案

推荐方案 A：

```text
扩展现有 p13_protect_storage_lifecycle() 的 INSERT 分支
```

INSERT 分支顺序：

```text
A cleanup attestation
-> B 普通初始状态白名单
-> RETURN NEW
```

该顺序保留 A 的错误信息和 STAGING cleanup 保护。

核心新增判断：

```sql
IF NEW."objectKind" IS NULL
   OR NEW.state IS NULL
   OR NOT (
     (NEW."objectKind" = 'STAGING'
      AND NEW.state = 'STAGING_RESERVED')
     OR
     (NEW."objectKind" = 'CANONICAL'
      AND NEW.state = 'FINALIZING')
   )
THEN
  RAISE EXCEPTION 'invalid storage lifecycle initial state'
    USING ERRCODE = '23514';
END IF;
```

完整函数体设计见：

```text
docs/architecture/file-lifecycle-p13-c6-2-g-design.md
```

## 8. 九类 Fixture 复核结果

| Fixture | B 兼容性 | 当前结论 |
|---|---|---|
| FX-SR | 兼容 | 直接 STAGING_RESERVED |
| FX-SW | 兼容 | 从 STAGING_RESERVED UPDATE |
| FX-SRdy | 兼容 | 从 STAGING UPDATE 到 READY |
| FX-FZ | 兼容 | 直接 CANONICAL FINALIZING |
| FX-ACT | 兼容 | FZ 后合法 UPDATE 到 ACTIVE |
| FX-QN | 不兼容 | 当前直接 INSERT QUARANTINED，B 拒绝 |
| FX-PP | 不兼容 | 当前直接 INSERT PURGE_PENDING，B 拒绝 |
| FX-DE | 不兼容 | 当前直接 INSERT DELETED，B 拒绝 |
| FX-FR | 不兼容 | 当前直接 INSERT FAILED_RETAINED，必须改为真实失败路径 |

本阶段没有修改 Fixture Builder。

B 实施后：

- FX-SR、FX-SW、FX-SRdy、FX-FZ、FX-ACT 可保持目标顺序；
- FX-QN/FX-PP/FX-DE 继续 `BLOCKED`；
- FX-FR 需要通过合法 FINALIZE 失败转换，不能直接 INSERT 终态。

## 9. orphan QUARANTINING 特殊协议设计

为什么不能加入普通 CANONICAL 白名单：

- orphan 没有正常 FINALIZE 来源；
- 普通 CANONICAL FINALIZING 无法表达异常对象；
- 直接允许所有 CANONICAL QUARANTINING 会使普通业务可伪造隔离路径。

当前 B 决定：

```text
拒绝所有普通 CANONICAL QUARANTINING INSERT。
```

未来协议仍需确定：

- orphan 的判定证据；
- `sourceAttemptId` 是否允许 NULL；
- QUARANTINE Operation 是否必需及其创建顺序；
- 文件系统身份和内容验证；
- 独立 attestation；
- Maintenance/Recovery 角色；
- 审计记录和授权入口。

开放问题阻塞 FX-QN、FX-PP、FX-DE 的 orphan 路径，不阻塞普通 B 实施。

## 10. 空 STAGING DELETED 特殊协议设计

当前 Schema 对 STAGING 的要求：

- 必须有 reserved Attempt/Intent；
- STAGING DELETED 必须具备完整、identity-verified close attestation；
- closed size 必须大于 0；
- checksum 必须存在；
- 上传链必须一致。

因此“没有实际文件、没有有效上传链”的空 STAGING 当前无法在不修改 C 范围结构的情况下表达。

当前 B 决定：

```text
拒绝所有普通 STAGING DELETED INSERT。
```

未来协议必须决定：

- 空 STAGING 的准确定义；
- 是否仍关联 Intent/Attempt；
- 如何证明文件不存在；
- 是否使用不同 attestation；
- 是否需要新列、新表或专用入口；
- 是否必须修改 CHECK/FK。

开放问题阻塞 FX-DE 的空 STAGING 分支。

## 11. B Migration SQL 设计草案

建议名称：

```text
20261118110000_phase37_p13_lifecycle_initial_state_guard
```

涉及对象：

```text
public.p13_protect_storage_lifecycle()
```

唯一 DDL 类型：

```text
CREATE OR REPLACE FUNCTION
```

不修改 Trigger 注册、不修改其他函数或结构。

不执行数据回填。函数 INSERT 分支不会修改历史行。

Migration 前置条件：

- A Migration 已应用；
- Lifecycle Trigger 为 `tgtype=31`；
- 25 个函数和 Migration 历史无漂移；
- 六张相关表无不可解释数据；
- 项目负责人单独授权 B Migration。

Migration 后预期：

- 函数仍为 25 个；
- Lifecycle Trigger 仍为 6 个；
- `p13_storage_lifecycle_guard` 仍为 `tgtype=31`；
- 函数 INSERT 白名单生效；
- Owner/SECURITY/volatility/STRICT/ACL 不变。

失败恢复：

- 单条函数 DDL 在 PostgreSQL 中可事务回滚；
- 成功后如需撤销，通过新的前向恢复 Migration；
- COMMIT 未知时，新连接只读检查函数定义摘要、Catalog 属性和 Migration 历史。

## 12. B-DB-01 至 B-DB-16 测试方案

| ID | 目标 | 预期 |
|---|---|---|
| B-DB-01 | 合法 STAGING_RESERVED INSERT | 允许 |
| B-DB-02 | 非法 STAGING INSERT | BEFORE INSERT `23514` |
| B-DB-03 | 非法 STAGING_READY INSERT | BEFORE INSERT `23514` |
| B-DB-04 | 非法 STAGING_ABANDONED INSERT | BEFORE INSERT `23514` |
| B-DB-05 | 合法 CANONICAL FINALIZING | 允许，Deferred 链通过 |
| B-DB-06 | 非法 CANONICAL ACTIVE | BEFORE INSERT `23514` |
| B-DB-07 | 非法 CANONICAL QUARANTINED | BEFORE INSERT `23514` |
| B-DB-08 | 非法 CANONICAL PURGE_PENDING | BEFORE INSERT `23514` |
| B-DB-09 | 非法 CANONICAL DELETED | BEFORE INSERT `23514` |
| B-DB-10 | 非法 CANONICAL FAILED_RETAINED | BEFORE INSERT `23514` |
| B-DB-11 | 合法 UPDATE 状态转换 | 允许 |
| B-DB-12 | 非法 UPDATE | 原 UPDATE 保护，`23514` |
| B-DB-13 | 完整 FINALIZING 关系链 | Deferred 通过 |
| B-DB-14 | 未知/未定义组合 | fail closed；`23514` 或 enum `22P02` |
| B-DB-15 | 特殊协议绕过 | BEFORE INSERT `23514` |
| B-DB-16 | A cleanup attestation 回归 | 保留 `23514` cleanup 错误 |

完整 Fixture、事务和 Deferred 说明见数据库行为测试方案。

## 13. 风险与 OPEN DECISIONS

风险：

- 将字段合法误判为生命周期合法；
- 把白名单错误放入 UPDATE 分支；
- 两个 BEFORE Trigger 的错误优先级；
- 特殊 orphan 被普通入口滥用；
- 空 STAGING 破坏 close attestation；
- 未来新增枚举被默认放行。

OPEN DECISIONS：

- CANONICAL orphan QUARANTINING 完整协议；
- 空 STAGING DELETED 完整协议；
- 特殊协议所需的独立权限或 C 结构调整；
- FX-QN 是否存在非 orphan 的合法隔离前态；
- Fixture Builder 的后续调整阶段。

## 14. 修改文件和 SHA-256

新增：

```text
docs/architecture/file-lifecycle-p13-c6-2-g-design.md
docs/architecture/file-lifecycle-p13-c6-2-g-report.md
```

更新：

```text
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
docs/architecture/file-lifecycle-p13-implementation-status.md
```

SHA-256：

```text
file-lifecycle-p13-c6-2-g-design.md
DD091AE5395B0E5A96CFB7D3B8FFC74091DD0F2B968A4F261920246E0991A0CB

file-lifecycle-p13-database-behavior-test-plan.md
99AB270304E4B42EE1702B79533347E66FF901642377B6FB6A6D15B09B4FEE1F

file-lifecycle-p13-implementation-status.md
E67425D492C530EC419A65D8053E243030C977B1D73D16CFC2B804A4D0FC0B5B
```

报告自身的 SHA-256 在文件最终生成后由交付消息提供，不在文件内部形成自引用哈希。

## 15. 是否符合 C-6.2-C2 决策

符合：

- 普通 STAGING 仅允许 `STAGING_RESERVED`；
- 普通 CANONICAL 仅允许 `FINALIZING`；
- orphan 不进入普通白名单；
- 空 STAGING DELETED 不进入普通白名单；
- FX-QN/FX-PP/FX-DE 不直接 INSERT 终态；
- FX-FR 要求真实失败路径；
- A cleanup attestation、UPDATE、DELETE、Deferred Trigger 均保留。

## 16. 最终验收结论

```text
C-6.2-G:
PASS WITH WARNINGS

B Design:
FROZEN

B Migration:
NOT CREATED

Database:
NOT CONNECTED

Database Writes:
NOT EXECUTED

Prisma Schema:
NOT MODIFIED

Business Code:
NOT MODIFIED

A Migration:
UNCHANGED

C:
NOT AUTHORIZED

Next Phase:
NOT AUTHORIZED
```

整体为 warnings 的原因是特殊协议仍未冻结，且当前 Fixture Builder 的 FX-QN/PP/DE/FR 直接终态路径与 B 不兼容。
