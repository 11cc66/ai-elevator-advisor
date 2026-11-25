# P1-3 C-6.2-I B Migration 独立只读复核报告

## 文档信息

- 阶段：`C-6.2-I`
- 日期：`2026-11-18`
- 审计类型：独立只读静态复核
- 结论：`PASS WITH WARNINGS`

## 1. 审计基线

- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- B Migration：`20261117140000_phase37_p13_lifecycle_initial_state_guard`
- 数据库：`NOT CONNECTED`
- SQL：`NOT EXECUTED`

本轮只读取文件、计算哈希并进行静态比较。

## 2. Git 分支、HEAD 和工作树

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD:   b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留全部既有未提交文件，并包含 H 阶段新增的 B Migration、B 静态测试和 H 报告。

没有 Git 写操作。

## 3. 文件 SHA-256

| 文件 | SHA-256 |
|---|---|
| A Migration | `CA1E3B737F1CC44B3FC40911634CDBC18A41B239073BB56D53F0432B11D6BFDB` |
| B Migration | `3AC99E01D98D4C125BED5F3AC1CE2769B0B780E45F0E51B4FEECC2FB408ABB2C` |
| H 阶段报告 | `30E4B4105F593D38D5DA4F3AF4944B5D100802777D9BE2EA8C863E356F0E00BE` |
| G 阶段设计 | `DD091AE5395B0E5A96CFB7D3B8FFC74091DD0F2B968A4F261920246E0991A0CB` |
| 数据库行为测试方案 | `72741FCB0A7B24626DCBC0D21E135DA97D3EDD551F80D439D4E676812CD45CAF` |
| 实现状态 | `AB263470F49C35480C1FE6E54E47D3AF7EA1B287B392DE555F8650B7133EFBB5` |
| 原始 P1-3 Migration | `187D82A00DB73CB6F5D79C97DCD6B4FF2E01BD7E5F78BB9E1273D54D8A141479` |
| `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` |
| Fixture Builder | `EB69AD1825F926482D481EE46F08C34700B2B24B69216C02386D0EE269B5888B` |
| Harness | `2B1503B8A535E1B38D80C928C2D292F89BF3803E3D56C1A61C7B92B8B47E681B` |
| B Migration 静态测试 | `1180D80892C13BCCD0C367D2810F0F4DA89DA0D0F62115BAD5308A4BFC7AB6C1` |

所有哈希与 H 报告或此前已验收记录一致，没有发现 HASH MISMATCH。

## 4. G 设计与 H 实施逐项对照

| 项目 | G 冻结设计 | H 实际 Migration | 结论 |
|---|---|---|---|
| STAGING 初始状态 | `STAGING_RESERVED` | 仅允许 `STAGING_RESERVED` | PASS |
| CANONICAL 初始状态 | `FINALIZING` | 仅允许 `FINALIZING` | PASS |
| NULL | fail closed | 显式检查 kind/state NULL | PASS |
| 未知组合 | fail closed | 白名单外全部抛 `23514` | PASS |
| 未来新增枚举 | 不能默认允许 | 只接受两个明确组合 | PASS |
| A cleanup attestation | 保留 | B check 前执行 | PASS |
| UPDATE | 不修改 | 与原始函数一致 | PASS |
| DELETE | 不变 | `42501` 保留 | PASS |
| Trigger | 不新增第二个 | 未修改任何 Trigger | PASS |
| C 结构 | 不实施 | 无 CHECK/FK/列变更 | PASS |
| 特殊协议 | 不实施 | 全部被普通白名单拒绝 | PASS |

Migration 名称与 G 中的建议名称不同：

```text
G 建议：20261118110000_phase37_p13_lifecycle_initial_state_guard
H 实际：20261117140000_phase37_p13_lifecycle_initial_state_guard
```

H 阶段授权文本明确建议使用 `20261117140000`，因此该差异是授权内的命名调整，不是设计冲突。

## 5. B Migration 完整 SQL 审计

B Migration 包含且仅包含一个：

```text
CREATE OR REPLACE FUNCTION
```

对象为：

```text
public.p13_protect_storage_lifecycle()
```

没有：

- DROP；
- TRUNCATE；
- ALTER TABLE；
- GRANT/REVOKE；
- CREATE TRIGGER；
- CREATE CONSTRAINT TRIGGER；
- 新角色；
- 新列；
- 数据回填。

G 设计中的完整函数块与 B Migration 的函数块在空白归一化后：

```text
MATCH
```

H 报告中的完整 SQL 与仓库 B Migration 文件在空白归一化后：

```text
MATCH
```

## 6. A/B 检查顺序

B Migration 的 INSERT 分支：

```sql
PERFORM "p13_assert_staging_cleanup_attestation"(NEW);

IF NEW."objectKind" IS NULL
   OR NEW.state IS NULL
   OR NOT (...)
THEN
  RAISE EXCEPTION ... USING ERRCODE = '23514';
END IF;

RETURN NEW;
```

静态验证：

```text
A attestation 在 B 检查之前
STATICALLY VERIFIED
```

H Catalog 证据：

```text
A attestation position = 173
B guard position       = 524
```

该执行顺序与 H 报告一致。

## 7. UPDATE / DELETE 审计

从 B Migration 函数中移除新增的 B 白名单块后，其余函数与原始 P1-3 函数在空白归一化后：

```text
MATCH
```

因此：

- Identity immutability 保留；
- close attestation immutability 保留；
- Lifecycle 状态转换白名单保留；
- ACTIVE + FileVersion 离开保护保留；
- UPDATE 末尾 cleanup attestation 保留；
- DELETE `42501` 保留。

B 检查仅位于 `TG_OP='INSERT'` 分支，不会限制后续 UPDATE。

## 8. Trigger 审计

B Migration 不包含 Trigger DDL。

A Migration 仍是：

```sql
CREATE OR REPLACE TRIGGER "p13_storage_lifecycle_guard"
BEFORE INSERT OR UPDATE OR DELETE
ON "storage_object_lifecycle"
FOR EACH ROW
EXECUTE FUNCTION "p13_protect_storage_lifecycle"();
```

H 报告的 Catalog 证据为：

```text
Trigger 数量 = 6
p13_storage_lifecycle_guard tgtype = 31
tgenabled = O
tgdeferrable = false
tginitdeferred = false
```

审计结论：

```text
Migration 静态定义不会改变 Trigger。
数据库 Catalog 状态由 H 报告提供，属于 REPORT-BASED。
```

## 9. Deferred Constraint Trigger 审计

四个 Deferred Trigger 与 TRUNCATE Guard：

- B Migration 中没有修改它们的 DDL；
- H 报告中的前后 Catalog 均为相同名称、事件、函数和 Deferred 属性；
- B-DB-01、11、13 在 `SET CONSTRAINTS ALL IMMEDIATE` 时通过；
- B-DB-05 未执行 Deferred 检查，已正确标记 PARTIAL。

## 10. 约束、索引和 ACL 审计

B Migration 没有结构 DDL。

H 报告的 Catalog 快照：

```text
constraint_digest = 09bc1b0a0d174e33ea8c7bc5d75a453a
constraint_count  = 327

index_digest      = 5c87b72a1e2fa87966c38768459fd41c
index_count       = 47
```

执行前后一致。

函数 ACL：

```text
Owner             = elevator_p13_validation_migrator
SECURITY DEFINER  = 0
VOLATILE          = 25
STRICT            = 0
proconfig NULL    = 25
proacl NULL       = 25
PUBLIC EXECUTE    = 25
```

`CREATE OR REPLACE FUNCTION` 保持原函数对象、签名、Owner 和 ACL；H Catalog 报告与静态预期一致。

数据库/角色/ACL 的实际结果仅为：

```text
REPORT-BASED
```

本阶段没有连接数据库独立重查。

## 11. B-DB-01 至 B-DB-16 逐项证据

由于仓库中没有持久化的原始数据库执行日志，以下结果均属于：

```text
REPORT-BASED
```

不能表述为本轮独立重新运行。

| 测试 | 预期 | H 报告结果 | 独立审计 |
|---|---|---|---|
| B-DB-01 | 允许 STAGING_RESERVED | PARTIAL | 分类正确：INSERT + Deferred 通过，但未真实 COMMIT |
| B-DB-02 | 拒绝 STAGING | PASS | 与 B 白名单静态逻辑一致 |
| B-DB-03 | 拒绝 STAGING_READY | PASS | 与 B 白名单静态逻辑一致 |
| B-DB-04 | 拒绝 STAGING_ABANDONED | PASS | 与 B 白名单静态逻辑一致 |
| B-DB-05 | 允许 FINALIZING | PARTIAL | 分类正确：B 初始检查通过，但 Deferred/COMMIT 未验证 |
| B-DB-06 | 拒绝 ACTIVE | PASS | 与 B 白名单静态逻辑一致 |
| B-DB-07 | 拒绝普通 QUARANTINED | PASS | 特殊协议未进入普通白名单 |
| B-DB-08 | 拒绝 PURGE_PENDING | PASS | 与普通白名单一致 |
| B-DB-09 | 拒绝 DELETED | PASS | 与普通白名单一致 |
| B-DB-10 | 拒绝 FAILED_RETAINED | PASS | 与普通白名单一致 |
| B-DB-11 | 合法 UPDATE | PARTIAL | 分类正确：UPDATE + Deferred 通过，但未真实 COMMIT |
| B-DB-12 | 非法 UPDATE | PASS | 与保留的原 UPDATE 白名单一致 |
| B-DB-13 | 完整 FINALIZING 链 | PARTIAL | 分类正确：完整链 + Deferred 通过，但未真实 COMMIT |
| B-DB-14 | 未知/NULL 组合 fail closed | PASS | 合法枚举/NULL 为 `23514`，未知 enum 为 `22P02` |
| B-DB-15 | 特殊协议普通绕过被拒绝 | PASS | 普通 QNING 和完整 proof 的 STAGING DELETED 均被 B 拒绝 |
| B-DB-16 | A cleanup 回归 | PASS | H 报告记录 A attestation 错误先于 B 返回 |

未发现把 PARTIAL 计作 PASS 的情况。

## 12. 四项 PARTIAL 专项结论

### B-DB-01

```text
PARTIAL JUSTIFIED
```

INSERT、Intent 激活和 `SET CONSTRAINTS ALL IMMEDIATE` 已报告通过；事务最终 ROLLBACK，无真实 Fixture COMMIT。

### B-DB-05

```text
PARTIAL JUSTIFIED
```

只验证 B 初始状态检查允许 FINALIZING；Deferred 与 COMMIT 未执行。

### B-DB-11

```text
PARTIAL JUSTIFIED
```

合法 UPDATE 和 Deferred 检查已报告通过；事务最终 ROLLBACK。

### B-DB-13

```text
PARTIAL JUSTIFIED
```

完整 FINALIZING 链和 Deferred 检查已报告通过；事务最终 ROLLBACK。

当前没有已批准的测试数据清理协议，不能为了提高通过率放宽 DELETE/TRUNCATE 保护。

## 13. 自动化测试核对

测试源码：

| 文件 | `it(...)` 数量 | 跳过/Only |
|---|---:|---|
| `p13-a-migration.test.ts` | 2 | 无 |
| `p13-b-migration.test.ts` | 4 | 无 |
| `p13-db-tooling.test.ts` | 26 | 无 |

未发现 `.skip`、`.todo`、`.only` 或条件性跳过。

B Migration 测试确实检查：

- 原始函数除 B guard 外保持一致；
- A attestation 在 B 之前；
- 两个合法初始状态；
- 无危险 DDL。

该测试是静态代码测试，不是数据库行为测试。H 报告没有把 4/4 静态测试冒充为 B-DB 行为测试。

H 报告记录的完整 Web 测试 81/81、TypeScript 通过，因本轮未重新运行，只能标记：

```text
REPORT-BASED
```

## 14. 发现的问题

### W-01

```text
Severity: WARNING
```

B-DB 行为测试没有持久化的原始 SQL/日志文件，仓库内只能看到静态测试和 H 报告摘要。独立审计只能确认描述与代码一致，不能独立重放数据库结果。

影响：

- 不能将行为测试称为本轮独立重新执行；
- Catalog 与行为测试证据均为 `REPORT-BASED`。

### W-02

```text
Severity: WARNING
```

H Migration 使用 PostgreSQL 管理员 `postgres` 执行 Prisma deploy，而不是直接以 NOLOGIN 的 Migrator 登录。

缓解：

- H Catalog 证据显示函数 Owner 仍为 `elevator_p13_validation_migrator`；
- B Migration 只使用 `CREATE OR REPLACE FUNCTION`，不创建新对象；
- 未修改角色或 ACL。

### W-03

```text
Severity: WARNING
```

B-DB-01、05、11、13 没有真实成功 COMMIT。

结论：

```text
PARTIAL JUSTIFIED
```

### OBS-01

Migration 名称与 G 建议不同，但 H 授权文本明确要求 `20261117140000`，属于授权调整，不是缺陷。

未发现：

- A 保护绕过；
- UPDATE/DELETE 破坏；
- 特殊协议被提前实现；
- Migration SQL 与 H 报告不一致；
- 虚假 PASS；
- 未解释的哈希漂移。

## 15. 风险

| 风险 | 影响 | 当前判断 |
|---|---|---|
| 没有持久化原始 DB 测试日志 | 复现性不足 | WARNING |
| 成功 Fixture 未真实 COMMIT | 无法证明持久化后行为 | WARNING |
| PUBLIC EXECUTE 仍存在 | 权限面偏大 | 既有阶段 D 风险 |
| 特殊协议未冻结 | 无法验证 QNING/空 STAGING 成功路径 | OPEN DECISION |
| 使用 postgres 执行 Migration | 执行角色高于 Migrator | 已由 Owner/ACL 未变化缓解 |

## 16. 是否符合 G 冻结设计

```text
PASS
```

- 普通 STAGING 仅允许 `STAGING_RESERVED`；
- 普通 CANONICAL 仅允许 `FINALIZING`；
- NULL 和未列入白名单组合 fail closed；
- A cleanup attestation 保留且先执行；
- UPDATE/DELETE 保持原逻辑；
- 未实现特殊协议；
- 未实施 C；
- 未新增角色或 ACL 变更。

B Migration 与 G 的函数草案逐字归一化后一致。

## 17. 是否接受 H 阶段

### A. B 设计符合性

```text
PASS
```

### B. B Migration 静态正确性

```text
PASS
```

### C. 数据库 Catalog 证据

```text
REPORT-BASED
```

本阶段禁止连接数据库，不能独立重查 Catalog。

### D. 行为测试证据

```text
PASS WITH WARNINGS
```

测试分类与 H 报告一致，但缺少持久化的原始执行日志，不能独立重放。

### E. 真实成功 COMMIT

```text
NOT VERIFIED
```

### F. 总体结论

```text
PASS WITH WARNINGS
```

H 阶段可以接受为 B 初始状态白名单实施完成，但不等于全部成功型数据库行为已通过真实 COMMIT 验证。

## 18. 下一阶段建议

1. 保留 B-DB-01、05、11、13 的 PARTIAL 状态。
2. 如继续验证，单独设计一次性 Clone 或安全清理协议后执行真实 COMMIT 测试。
3. 后续阶段应持久化数据库测试原始输出，避免只能依赖总结报告。
4. 按 B 白名单调整 Fixture Builder，尤其是 FX-QN、FX-PP、FX-DE、FX-FR。
5. 特殊协议保持独立设计，不得作为 B 的补丁绕过白名单。
6. PUBLIC EXECUTE 收敛继续作为独立任务。

## 最终状态

```text
C-6.2-I:
PASS WITH WARNINGS

Database:
NOT CONNECTED

SQL:
NOT EXECUTED

Database Writes:
NOT EXECUTED

Prisma Schema:
NOT MODIFIED

Migration:
NOT MODIFIED

Business Code:
NOT MODIFIED

Fixture Builder:
NOT MODIFIED

Harness:
NOT MODIFIED

Git Write:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
