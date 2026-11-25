# GitHub 公开仓库发布报告

Date: 2026-11-25

## 1. 最终状态

```text
BLOCKED — GITHUB IDENTITY / REMOTE TARGET NOT AVAILABLE
```

本轮完成了本地盘点、安全扫描、README 修订和发布候选文件清单，但未完成
GitHub 公开仓库创建、staging、commit 或 push。

阻断原因：

1. 本地仓库没有 Git remote；
2. 未安装 GitHub CLI `gh`；
3. Git Credential Manager 未保存可用的 GitHub 凭据；
4. 环境未提供 `GITHUB_TOKEN` 或 `GH_TOKEN`。

根据授权中的停止条件，在无法证明 GitHub 身份和目标仓库时不得继续远端发布。

## 2. 仓库与发布目标

| 项目 | 值 |
|---|---|
| 本地仓库 | `D:\thinkbook\Desktop\jieya` |
| 建议公开仓库名 | `ai-elevator-advisor` |
| GitHub 公开地址 | `NOT CREATED / NOT VERIFIED` |
| 可见性 | `NOT CREATED / NOT VERIFIED` |
| 发布分支 | `NOT CREATED` |
| 发布 commit | `NOT CREATED` |
| 发布前 HEAD | `b224388bc6160eb4a66ad8db7cecd4d23aa75fb8` |
| 发布后 HEAD | `b224388bc6160eb4a66ad8db7cecd4d23aa75fb8` |

仓库名来自根 `package.json` 的 `ai-elevator-advisor`，但因为没有认证信息，
尚未确认该名称在目标 GitHub 账号下是否可用。

## 3. Git 初始状态

```text
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 41
Staged: 0
Deleted: 0
Untracked -uall: 869
Tracked files: 219
Non-ignored candidate files: 1,088
```

完整候选文件清单和 SHA-256 将在：

```text
docs/product/GITHUB_PUBLICATION_CANDIDATE_FILES_SHA256.txt
```

该清单排除清单文件自身，并覆盖最终 README、本报告及全部待发布候选文件。

## 4. 候选文件分类

盘点包含 tracked 和 non-ignored untracked 文件。初步分类：

| 分类 | 文件数 |
|---|---:|
| Root | 13 |
| `.agents/` | 15 |
| `AI_Elevator_Advisor_Codex_Blueprint/` | 15 |
| `apps/` | 229 |
| `docs/` | 716 |
| `packages/` | 46 |
| `prisma/` | 16 |
| `storage/` | 1 |
| `tools/` | 37 |
| 合计 | 1,088 |

添加本报告后：

```text
Raw candidate files:                   1,089
Explicit non-ignored exclusions:            2
Publishable files excluding Manifest:   1,087
```

最终精确字节数和逐文件 SHA-256 由伴生 Manifest 记录。

## 5. 立即排除项

非忽略候选中明确排除：

```text
$null
  content not read
  SHA-256 not computed
  not modified, moved or deleted

docs/product/full-mvp-remediation-review-r3-c5/tools/__pycache__/
independent_c5_verifier.cpython-315.pyc
  generated Python cache
```

排除数量：

```text
2 non-ignored candidate files
```

## 6. Ignored / 不应公开内容

`.gitignore` 已排除，且不会加入发布白名单：

- `.env`
- `.env.test`
- `*.pem`
- `*.key`
- `node_modules/`
- `apps/web/node_modules/`
- 各 workspace `node_modules/`
- `apps/web/.next/`
- `apps/worker/dist/`
- 各 package `dist/`
- `apps/web/test-results/`
- coverage、日志、临时文件和 `*.tsbuildinfo`
- `storage/private-test/`
- Native RPC `bin/`、`generated/`、`logs/`、`obj/` 和中间 `.obj`

实际 `.env` 与 `.env.test` 存在但内容未读取。`apps/web/.next` 和
`apps/worker/dist` 未构建、启动、移动或修改。

`.env.example` 和 `.env.test.example` 是 Git 已跟踪的纯占位模板：

```text
.env.example SHA-256:
A2D8BC6862A4CAD5E37CE2D1149B312339079F04A52F040B1D89DF3FA34B2892

.env.test.example SHA-256:
260E6CA16261F4B9C6F2DB39B453A4E4BDECA978AEC6CA4FE8AF582DB61E9854
```

非占位值扫描结果为零。它们不是实际环境文件；为保留首次运行说明而列入
候选清单，不包含凭据。

## 7. 安全扫描

### 7.1 当前工作树

扫描范围：

```text
All tracked + non-ignored untracked files
Scanned text files: 1,086
Skipped: 2
```

高置信度秘密规则：

```text
Private key headers:       0
AWS access keys:           0
GitHub tokens:             0
OpenAI keys:               0
Slack tokens:              0
Google API keys:           0
Files with such findings:  0
```

宽泛规则命中的 21 处均为以下安全内容：

- `password` 等对象字段名；
- 测试用占位字符串；
- `example.invalid` / `dev.invalid` URL；
- URL 密码占位符 `REPLACE_WITH_...`；
- `SHA256SUMS` 中恰好符合手机号正则的十六进制片段。

真实邮箱：0  
真实手机号：0

扫描未打印凭据值，未打开实际 `.env` / `.env.test`。

### 7.2 Git 历史

```text
Commits: 16
Unique history paths: 219
History authors: Codex <codex@local.invalid>
```

历史敏感文件名只包括：

```text
.env.example
.env.test.example
```

未发现历史中的 `.env`、`.env.test`、私钥、API Token、真实数据库密码或
真实客户文件。历史新增行扫描中的 password/token-like 命中与当前工作树一致，
属于测试或配置字段/占位值。

当前没有足以触发现有历史重写条件的高置信度秘密。

## 8. README 状态

已重写根 `README.md`：

```text
Size: 8,185 bytes
Lines: 252
SHA-256: 5335130272043FF4927AAE058F02C478D83394A5A002ECD264DA780A5C946531
```

README 明确区分：

- Mock AI 与真实 AI；
- `DEMO_MOCK` 产品与真实产品；
- Demo-ready 与仓库级生产就绪；
- 设计完成与源码/Runtime 验证；
- 历史测试结果与本次重新执行结果。

## 9. 本次验证

已执行：

```text
pnpm --filter @elevator/contracts test
PASS — 4 files, 15 tests

pnpm --filter @elevator/selection-engine test
PASS — 2 files, 9 tests

pnpm typecheck
FAIL — pre-existing P1-3 upload/FileVersion chain errors

git diff --check -- README.md
exit 0
```

未执行：

- 数据库连接、SQL 或 Migration；
- `.env` / `.env.test` 读取；
- E2E、Browser Runtime 或真实 AI；
- `pnpm build`、Native RPC 或部署；
- 任何 GitHub 远端写操作。

历史 Full MVP Acceptance Report 记录的测试结果继续作为历史证据引用，但
未被视为本次发布验证的重复 PASS。

## 10. 原有未提交工作

没有执行 Git 写操作：

```text
git add:    NONE
git commit: NONE
git push:   NONE
git reset/restore/clean/checkout/stash: NONE
```

原有 41 个 tracked modified 文件、869 个 untracked 文件均保留。README 和本
报告是本轮新增修改，尚未 stage 或 commit。

## 11. 发布后核验

```text
GitHub Repository:          NOT VERIFIED — NOT CREATED
Public Visibility:          NOT VERIFIED — NOT CREATED
Target Branch:              NOT VERIFIED
Remote HEAD:                NOT VERIFIED
README on GitHub:           NOT VERIFIED
Key Files on GitHub:        NOT VERIFIED
Remote Credential Scan:     NOT VERIFIED
```

## 12. 恢复条件

在继续发布前，需要用户或受控环境完成至少一项：

1. 配置具备创建公开仓库权限的 GitHub Token，并仅通过 Credential Manager
   或受控环境变量提供；
2. 安装并认证 GitHub CLI；
3. 提供明确的目标 GitHub 仓库 URL 和可用的 Git HTTPS 凭据。

恢复后必须先重新执行 Manifest/报告哈希核验、敏感信息扫描、显式白名单
staging、`git diff --cached --check`、Public 可见性核验，再 commit 和 push。

## 13. 当前结论

```text
Local publication preparation:
PARTIAL — README and candidate inventory complete

Security scan:
PASS WITH TEMPLATE FILE EXCEPTION

Repository publication:
BLOCKED — GitHub authentication and remote target unavailable

Production readiness:
NOT VERIFIED
```
