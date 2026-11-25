# GitHub 公开仓库发布报告

Date: 2026-11-25

## 1. 最终状态

```text
Repository publication:
PASS — PUBLIC REPOSITORY PUBLISHED

Product production readiness:
PARTIAL / NOT VERIFIED
```

本轮完成了 GitHub 认证恢复、Public 仓库确认、候选文件复核、显式白名单
staging、暂存区安全扫描、发布 commit 和 push。公开发布本身通过；仓库级
生产就绪度仍受下文技术限制约束。

## 2. 仓库与发布目标

| 项目 | 值 |
|---|---|
| 本地仓库 | `D:\thinkbook\Desktop\jieya` |
| GitHub 账号 | `11cc66` |
| 仓库名 | `ai-elevator-advisor` |
| GitHub 公开地址 | `https://github.com/11cc66/ai-elevator-advisor` |
| 可见性 | `PUBLIC` |
| 默认远端分支 | `main` |
| 本地发布分支 | `codex/public-github-sync` |
| 发布内容 commit | `e72297115701583fed6d1d2cf99b36ecf8a7b44a` |
| 发布前 HEAD | `b224388bc6160eb4a66ad8db7cecd4d23aa75fb8` |

本报告更新会形成发布内容 commit 之后的纯文档收尾 commit；最终远端 HEAD 在
push 后重新读取并记录于最终交付信息。

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

加入 `.gitattributes`、本报告和候选 Manifest 后：

```text
Raw non-ignored candidates:            1,090
Explicit non-ignored exclusions:            2
Published tree files:                   1,089
Manifest records excluding itself:      1,088
```

最终逐文件 SHA-256 由伴生 Manifest 记录。发布内容 commit 的 tree 包含
1,089 个文件。

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

最终 index 扫描范围：

```text
Indexed files:             1,089
Scanned:                   1,089
Skipped:                       0
Total indexed bytes:  13,641,962
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

原始开发分支仍保留在：

```text
feature/p1-3-storage-lifecycle-schema
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

原有 worktree 内容已通过显式白名单提交到独立发布分支，因此开发成果没有
丢失；发布提交在受控白名单中包含了原 41 个 tracked modified 文件的修改和
需公开的 untracked 文件。实际执行：

```text
git add --pathspec-from-file=<NUL whitelist>
git commit -m "chore: publish AI elevator advisor project"
git push -u origin codex/public-github-sync:main
```

没有执行 reset、restore、clean、checkout、stash 或 force push。

## 11. 发布后核验

```text
GitHub Repository:          VERIFIED
Public Visibility:          VERIFIED — PUBLIC
Target Branch:              VERIFIED — main
Remote HEAD at content push:e72297115701583fed6d1d2cf99b36ecf8a7b44a
README on GitHub:           VERIFIED
Key Files on GitHub:        VERIFIED
Viewer Permission:          ADMIN / PUSH
Remote Credential Scan:     VERIFIED — NO TOKEN IN REMOTE URL
```

GitHub API 确认：

```text
full_name:      11cc66/ai-elevator-advisor
visibility:     public
private:        false
default_branch: main
permissions:    admin=true, maintain=true, push=true, pull=true
```

## 12. 发布门禁结果

```text
R5 candidate Manifest coverage: PASS
Explicit path whitelist:        PASS
git diff --cached --check:      PASS
Staged/index secret scan:       PASS — 0 high-confidence hits
Forbidden path check:           PASS
Remote URL credential check:    PASS
Public visibility check:        PASS
Push:                           PASS — no force
```

`.env.example` 和 `.env.test.example` 是已跟踪的纯占位模板，不是实际
环境文件；实际 `.env`、`.env.test`、`.next`、`dist`、数据库数据和缓存均
未进入发布树。

## 13. 当前结论

```text
Public Repository Publication:
PASS

Security scan:
PASS — placeholder templates only

Remote consistency:
PASS

Production readiness:
PARTIAL / NOT VERIFIED
```

技术限制：

- Repository-wide `pnpm typecheck` 仍在旧 P1-3 upload/FileVersion chain 失败；
- Playwright browser runtime 和完整 E2E 未在发布任务中重新执行；
- 真实 AI、真实厂家数据、正式报价、合同、勘察和部署未实现；
- PostgreSQL、ACL、Migration Lock 和 Runtime 并发仍有多项 NOT VERIFIED。
