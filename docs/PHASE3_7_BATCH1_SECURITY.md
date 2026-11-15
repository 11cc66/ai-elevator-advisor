# Phase 3.7 第一批：测试环境隔离

本批次只处理：

- 测试角色不能连接开发数据库。
- 测试放行严格环境校验。
- 测试存储目录 realpath 和链接防护。

## 严格测试放行

应用和 Worker 只有在以下条件全部成立时才允许未扫描文件测试访问：

- `NODE_ENV = test`
- `FILE_ACCESS_MODE = test`
- 当前数据库精确为 `elevator_advisor_test`
- 当前数据库角色精确为 `elevator_test_app`
- `system_metadata.test_database_marker` 与本地测试环境变量一致
- 操作者具有明确的项目测试文件访问权限

`development`、`staging`、`production` 或缺失 `NODE_ENV` 均不能进入测试放行分支。

## 测试数据库角色隔离

测试数据库身份守卫额外检查：

- `elevator_test_app` 不能拥有开发库 `elevator_advisor` 的 CONNECT。
- `elevator_test_app` 不得是 `elevator_app` 角色成员。

这些检查发生在任何测试数据库重置和测试存储删除之前。

ACL 检查和实际撤销由 PostgreSQL 管理员执行，不写入 Prisma 迁移。

## 测试存储目录

测试存储目录必须精确等于工作区内：

```text
storage/private-test
```

守卫会检查：

- 配置路径不能指向其他目录。
- `storage` 和 `private-test` 目录组件不能是符号链接或 Junction。
- 最终 `realpath` 必须仍等于规范测试目录。

身份或路径校验失败时，不会执行测试目录递归删除。

## 待管理员审核的 ACL SQL

以下 SQL 当前未执行：

```sql
REVOKE CONNECT ON DATABASE elevator_advisor FROM PUBLIC;
REVOKE CONNECT ON DATABASE elevator_advisor FROM elevator_test_app;
```

开发库 owner 为 `elevator_app`，owner 权限不受 PUBLIC 撤销影响。
`postgres` 为超级用户。当前其他可登录角色只有 `elevator_test_app`。

执行后应再次验证：

```sql
SELECT
  has_database_privilege(
    'elevator_test_app',
    'elevator_advisor',
    'CONNECT'
  );
```

期望结果为 `false`。

## 验证

```powershell
pnpm test
pnpm test:db:verify
pnpm test:db:constraints
pnpm test:e2e
pnpm typecheck
pnpm build
```

在 ACL SQL 执行前，`test:db:verify` 应按设计返回
`TEST_ROLE_CAN_CONNECT_DEVELOPMENT`，不得绕过该失败。
