# AI 电梯选型顾问 V1.0 — Codex 开发蓝图

> 本仓库是产品需求、业务规则、工程安全边界和开发路线的基准文档。  
> 当前目标：先交付一个可运行、可演示、可逐步验证的 V1.0 MVP，而不是一次性开发完整企业平台。

## 给 Codex 的开始指令

1. 先完整阅读根目录 `AGENTS.md`。
2. 再阅读 `docs/` 中所有与当前任务相关的文档。
3. 先检查现有代码和运行环境，不要覆盖已有项目。
4. 第一轮只做项目架构与可运行骨架，提交清晰的文件结构、启动说明和基础测试。
5. 不得自行虚构真实电梯品牌、型号、技术参数、价格、法规结论或工程数据。
6. 任何模拟数据必须明确标注为 `DEMO / MOCK`，不得伪装成真实厂家资料。
7. 每完成一个开发阶段，运行测试并汇报：已完成、未完成、风险、启动方式、测试结果。

## 文档导航

- `AGENTS.md`：Codex 项目级开发指令与不可违反的规则。
- `docs/01_PRODUCT_SCOPE.md`：产品定位、V1.0 范围与暂缓事项。
- `docs/02_USER_FLOWS.md`：客户端与企业端完整业务流程。
- `docs/03_BUSINESS_RULES.md`：业务规则、数据状态、审核、版本和权限。
- `docs/04_AI_ENGINEERING_GUARDRAILS.md`：AI 能力边界、工程安全规则和提示注入防护。
- `docs/05_DATA_MODEL.md`：核心数据实体与关系建议。
- `docs/06_UI_UX_SPEC.md`：页面结构与交互要求。
- `docs/07_PRODUCT_CATALOG_AND_SELECTION.md`：产品库、筛选引擎、三档方案和报价规则。
- `docs/08_API_AND_INTEGRATION.md`：接口边界、文件、模型、第三方服务接入建议。
- `docs/09_TEST_PLAN.md`：前六轮模拟测试转化而来的验收用例。
- `docs/10_IMPLEMENTATION_ROADMAP.md`：分阶段开发计划。
- `docs/11_OPEN_DECISIONS.md`：尚需真实业务确认的事项。
- `examples/demo_catalog.json`：明确标注为虚构数据的产品库样例。

## 推荐开发方式

先让 Codex 输出技术方案和文件结构，再按阶段开发。不要一次性要求它生成全部系统。每个阶段都要保持应用可启动、可测试、可回滚。
