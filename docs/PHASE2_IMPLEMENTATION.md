# Phase 2 实施说明

本文件记录认证、RBAC 和项目管理基础，不新增产品业务规则。

## 认证

- Better Auth 用户名密码登录
- 注册接口关闭
- 数据库 Session，有效期 8 小时
- HttpOnly、SameSite=Lax Cookie
- 服务端 Session 和过期时间校验
- 开发环境只通过 Seed 创建预置管理员

Seed 从本地 `.env` 读取账号和密码，使用 Better Auth 的密码哈希函数保存凭据。
源码、日志和 Git 中不保存明文密码。

## RBAC

- Role 与 Permission 独立建模
- 角色可分配为全局范围或项目范围
- 高权限操作在 API 和数据访问前检查
- 未登录返回 401
- 缺少全局权限或项目范围返回 403
- 前端只负责展示，权限不由前端状态决定

## 业务数据

- Customer
- Project
- Building
- InstallationUnit

所有 Phase 2 创建记录默认标记为 `DEMO_MOCK`。编号由服务端生成：

- `DEMO-PROJECT-*`
- `DEMO-BUILDING-*`
- `DEMO-UNIT-*`

这些编号不是正式业务编号规则。

## 审计

客户、项目、建筑和安装单元创建时，在同一数据库事务中写入 AuditLog。
数据库触发器禁止更新或删除审计记录。

## 尚未实现

- 用户注册、短信、邮箱、密码找回
- 业务数据编辑、归档和删除流程
- 文件上传和资料识别
- 工程数据来源、确认和冲突流程
- AI Provider 调用
- 勘察、产品库、选型、审核和报价
