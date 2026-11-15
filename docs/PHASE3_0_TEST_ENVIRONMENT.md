# Phase 3.0 测试环境说明

本阶段只准备隔离测试环境，不包含 Phase 3.1 文件业务模型或 Phase 3.2 文件处理功能。

## 数据库

- 开发数据库：`elevator_advisor`
- 测试数据库：`elevator_advisor_test`
- 测试角色：`elevator_test_app`

测试 URL、账号密码、Better Auth 密钥和测试标记只保存在未提交的 `.env.test`。

## 首次初始化

1. 从 `.env.test.example` 创建 `.env.test`。
2. 填写专用测试连接、测试管理员、测试客户和随机标记。
3. 执行：

```powershell
pnpm test:db:verify
pnpm test:db:init
```

首次初始化只应用现有 Phase 1/2 迁移，并创建测试账号与固定 DEMO 项目夹具。

## 日常 E2E

```powershell
pnpm test:e2e
```

该命令会先执行测试数据库身份保护，再重建 `elevator_advisor_test`、应用迁移、
创建测试账号并运行 Playwright。Web 测试服务器固定使用
`http://127.0.0.1:3100`，禁止复用开发服务器。

## 身份保护

测试数据库重建至少要求：

- `TEST_DATABASE_URL` 与开发 `DATABASE_URL` 不同。
- URL 数据库名精确等于 `elevator_advisor_test`。
- 连接角色精确等于 `elevator_test_app`。
- 数据库内 `current_database()` 和 `current_user` 再次匹配。
- `system_metadata.test_database_marker` 与本地配置匹配。
- 重置必须显式启用 `ALLOW_TEST_DB_RESET=true`。

任一条件失败时，在迁移或重建前终止。

## 测试账号

- 测试管理员：全局 `SYSTEM_ADMIN`。
- 测试客户：仅 `CUSTOMER`，只分配固定 DEMO 项目范围。

测试客户没有管理员角色、全局权限、客户管理、项目创建、审计查看或文件处理权限。

## 数据保护

应用测试不删除开发数据库中的客户、项目、建筑、安装单元或审计记录。
`elevator_advisor` 中的现有数据不被 Phase 3.0 测试重建。
