# Phase 1 实施说明

本文件只记录工程骨架状态，不新增产品业务规则。

## 已建立

- pnpm workspace 与 Git 基线
- Next.js App Router Web 应用
- 独立 pg-boss Worker
- Prisma PostgreSQL Schema 与 Client
- contracts、selection-engine、shared-ui 包
- 健康检查、日志、敏感字段脱敏和错误边界
- Vitest 与 Playwright 测试入口

## 明确未实现

- 用户注册、登录、Session 与 RBAC
- 客户、项目、建筑和安装单元业务
- 文件上传、病毒扫描和资料识别
- 真实 AI Provider
- 勘察、产品库、选型、审核、报价和合同

## 待产品或专业方确认

原设计文档中的待确认事项继续以蓝图内 `docs/11_OPEN_DECISIONS.md` 为准，本阶段不擅自补充。尤其包括：

- 真实产品资料及授权来源
- 正式工程硬约束字段和单位
- 专业勘察报告模板
- 三档方案定义与排序权重
- 审批角色、金额权限和文件保留政策
- AI 供应商、数据处理和合规要求

## 环境说明

- PostgreSQL 18.7 已安装并运行于本机 `5432`。
- 数据库 `elevator_advisor` 和专用用户 `elevator_app` 已存在。
- 密码只能保存在未提交的本地 `.env` 中。
- 应用不会使用 `postgres` 超级用户作为运行时数据库账号。
