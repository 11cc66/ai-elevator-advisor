# P1-3 C-6.2-L8-A5 Legacy Artifact Isolation Strategy Design

## 文档信息

- 阶段：`C-6.2-L8-A5`
- 日期：`2026-11-19`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`DESIGN COMPLETE / FILE ACTIONS NOT EXECUTED`

## 1. 目标

将以下四种状态彻底分开：

1. Git HEAD 内容；
2. 当前工作树安全修复；
3. 已存在的历史构建产物；
4. 未来 signed Release。

隔离目标：

- 历史 Web `.next` 不能进入 production 启动；
- 历史 Worker `dist` 不能进入 production 启动；
- 新构建不写入或复用历史产物；
- 普通开发者不会误把历史目录当当前 Release；
- 后续文件移动、ACL 和删除分别获得独立审批。

## 2. 当前 Artifact 事实

### 2.1 Web

```text
Path:
apps/web/.next

Files:
1,413

Bytes:
446,890,260

Reparse Entries:
6 (pnpm dependency junctions under .next/node_modules)

Last Write UTC:
2026-11-16T17:17:29Z

BUILD_ID:
LULjk7Rp3QcYPDlFEyycy

BUILD_ID SHA-256:
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1
```

没有 P13 signed Manifest/Trust Root。

### 2.2 Worker

```text
Path:
apps/worker/dist

Files:
32

Bytes:
135,078

Reparse Entries:
0

Last Write UTC:
2026-11-15T17:08:16Z

index.js SHA-256:
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

file-maintenance.js SHA-256:
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3
```

### 2.3 新 Release 目录

当前不存在：

```text
apps/web/.p13-releases
apps/web/.p13-build
workspace/.p13-quarantine
```

Web new Release 固定格式：

```text
apps/web/.p13-releases/<releaseId>
```

Worker new Release：

```text
P13_WORKER_RELEASE_ROOT
```

构建要求目标预先不存在。

## 3. 信任分层

| State | Identity | Manifest | Gate | 允许 production |
|---|---|---|---|---|
| Git HEAD | Git SHA | 无构建 Manifest | 旧 next/start scripts | NO |
| Current worktree | dirty source | 可构建 signed Release | secure launcher/config | SOURCE ONLY |
| Historical `.next` | BUILD_ID only | 无 P13 Manifest | 无 Gate marker | NO |
| Historical Worker dist | none | 无 P13 Manifest | 无 Gate | NO |
| Future Web Release | `.p13-releases/<id>` | signed | secure start + instrumentation | YES after approval |
| Future Worker Release | configured root | signed | secure start + bootstrap Gate | YES after approval |

## 4. Web Legacy Artifact 分析

### 4.1 直接启动

历史 package script：

```text
next start
```

历史 Build 中没有：

```text
runWebStartupGate
P13_WEB_RELEASE_ROOT
STARTUP_CONFIGURATION_MISSING
verifyStartupRelease
server/instrumentation.js
```

因此旧 Artifact 可以被 Next CLI 用作默认 `.next`，且没有证明经过 Gate。

### 4.2 Production 配置门禁

当前工作树 `next.config.ts`：

```text
PHASE_PRODUCTION_BUILD
PHASE_PRODUCTION_SERVER
```

均要求：

```text
P13_NEXT_DIST_DIR=.p13-releases/<releaseId>
```

所以在当前工作树：

- 无 P13 dist 的 direct `next start` 拒绝；
- 合法 isolated Release 可由 secure launcher 或 instrumentation Gate 验证；
- `next dev` 仍可使用默认 `.next`，但只允许开发。

### 4.3 删除逻辑

旧 production chunk 中存在：

```text
cleanupExpiredUploadIntents
  -> removeStaging
  -> removeObject

completeUpload catch
  -> removeObject
  -> removeStaging
```

还有：

```text
cleanupOrphanObjects
cleanupTemp
```

方法定义。

如果旧 `.next` 被启动并访问 upload route，旧操作可能删除 Storage 对象。当前本地没有项目 Web 进程。

### 4.4 Directory Collision

默认 `.next` 与 feature Release 的关系：

```text
Legacy/default: apps/web/.next
Feature:        apps/web/.p13-releases/<releaseId>
Build temp:     apps/web/.p13-build/<releaseId>
```

当前 worktree 强制的路径不重叠。

但：

- `next dev` 可重新写入 `.next`；
- `next start` 在 HEAD/旧配置下默认读取 `.next`；
- 手工 Next CLI 可尝试该路径；
- 因此磁盘保留旧 `.next` 仍为风险。

## 5. Worker Legacy Artifact 分析

### 5.1 直接启动

旧 `dist/index.js`：

```text
startWorker()
  -> readWorkerEnv
  -> PrismaClient
  -> PgBoss
  -> queue registration
  -> Maintenance schedule
  -> immediate Maintenance
```

无 Worker Startup Gate。

### 5.2 当前依赖缓解

旧 `dist/storage.js` 通过 Junction 解析当前：

```text
packages/file-storage/dist
```

当前 `LocalPrivateStorage` 不含四个删除方法，因此旧 Maintenance 删除调用在当前本地依赖组合下预计失败。

但这只是依赖状态巧合，不能作为隔离边界：

- 其他 checkout 可能安装旧 package；
- 旧 dist 仍可初始化 DB/PgBoss；
- Gate bypass 本身仍是 CRITICAL；
- 不应依赖 TypeError 保护业务。

### 5.3 构建输出混用

HEAD：

```text
tsc -p tsconfig.build.json
  -> apps/worker/dist

start:
node dist/index.js
```

当前工作树：

```text
secure build -> P13_WORKER_RELEASE_ROOT
secure start -> verified Release index
```

当前 secure build 使用：

```text
tsc -p tsconfig.build.json --outDir <releaseRoot>
```

因此未来 Build 强制不存在的新 Release root，不覆盖 `dist`。

手工执行 `tsc -p tsconfig.build.json` 仍可能写入 `dist`，但不会恢复旧代码；会生成当前 Gate-first 源码。该命令仍不是批准发布路径。

## 6. 启动入口矩阵

| 入口 | 当前路径 | Gate | 可使用 Legacy | 风险 |
|---|---|---|---|---|
| Web package `start` | `scripts/start-secure.mjs` | YES + instrumentation | NO | LOW |
| Web `next dev` | default `.next` | NO | YES | DEV ONLY |
| Web direct `next start` current | requires P13 dist | config + instrumentation | NO if config absent | BLOCKED ELSE SAFE RELEASE |
| Web direct `next start` HEAD | `.next` | NO | YES | CRITICAL |
| Worker package `start` | secure launcher | YES + Gate | NO | LOW |
| Worker `src/index.ts` | Gate-first Bootstrap | YES | NO | LOW |
| Worker release index | signed release | Gate | NO | LOW |
| Worker `worker-entry.ts` direct | source entry | NO external Gate | NO legacy | PROHIBITED |
| Test Worker Entry | test-only | test only | test DB/Storage | TEST ONLY |
| Worker `node dist/index.js` | old dist | NO | YES | CRITICAL |
| Root `pnpm build` current | package secure builds | require P13 config | New Release only | MEDIUM |
| Direct `tsc -p tsconfig.build.json` | default dist | NO release gate | can write dist | PROHIBITED |
| Documented legacy commands | docs only | not executable by doc | Explain risk | LOW |

## 7. HEAD 与工作树差异

### 7.1 HEAD

```text
Web build: next build
Web start: next start
Worker build: tsc -p tsconfig.build.json
Worker start: node dist/index.js
next.config: no P13 production dist requirement
Worker index: direct startup, no Gate
```

因此从纯 HEAD checkout 构建：

- 生成/复用 `.next`；
- 生成/复用 `dist`；
- 正式脚本可直接启动 legacy/default entry；
- 安全修复不会自动出现。

### 7.2 当前工作树

```text
Web build/start: secure scripts
Worker build/start: secure scripts
next.config: production build/server require isolated P13 dist
Worker index: Gate-first Bootstrap
Worker secure launcher: NODE_ENV=production
```

因此：

```text
Current worktree supported production entries:
SECURE

HEAD production entries:
UNSAFE
```

## 8. Web 隔离方案比较

### W1：In-place Guard + Release-only Packaging

内容：

- 保留 `.next` 不移动；
- 正式启动仅允许 secure launcher；
- production Next 强制 P13 dist；
- 发布包/部署命令白名单不含 `.next`；
- CI 扫描历史入口。

优点：

- 当前可立即实施；
- 无文件移动；
- 无 ACL 修改；
- 对开发 `.next` 使用影响最低；
- 可回滚仅需脚本/文档。

缺点：

- 手工 `next start` / `next dev` 仍存在；
- 旧文件仍在磁盘；
- 不能阻止有权限用户强制启动。

安全性：MEDIUM。

### W2：Move `.next` to Quarantine

内容：

```text
apps/web/.next
  -> <quarantine>/web-next-<artifact-id>/
```

记录完整 Manifest（文件数、大小、关键 SHA、mtime、旧 Build ID）。

优点：

- 默认 `.next` 不再存在；
- direct `next start` 无默认可用 Build；
- 可回滚为同一卷 rename；
- Next 后续 dev 可创建新的 `.next`。

缺点：

- 需要文件移动授权；
- 旧 `.next` 内含 6 个 Junction；移动时必须不跟随目标；
- 现有开发缓存丢失；
- 必须先确认没有正在运行的 Next 进程。

安全性：HIGH。

### W3：ACL Deny Runtime Read/Execute

内容：

- Legacy path 保留；
- 未来 Web Runtime 身份禁止读取；
- Admin/Quarantine Operator 保持读取；
- 父目录不允许重命名/Junction。

优点：

- 不依赖文件名；
- Admin 可保留证据；
- 对运行身份强约束。

缺点：

- 当前开发身份与运行身份可能相同；
- 需要独立身份和 Windows ACL 验证；
- 会影响开发者直接检查 `.next`。

安全性：HIGH WITH SEPARATE IDENTITY。

### W4：Archive then Delete

内容：

- 先复制/移动至受控 Archive；
- 验证 Archive hash；
- 删除原 `.next`。

优点：最高安全，路径不再存在。

缺点：需独立删除授权，无法原路径回滚；恢复依赖 Archive。

安全性：HIGHEST / OPERATIONALLY DESTRUCTIVE。

## 9. Worker 隔离方案比较

### K1：In-place Guard + Release-only Packaging

- 仅 secure launcher；
- 发布包排除 `apps/worker/dist`；
- 文档禁止 direct dist；
- 当前无 OS 自动启动引用。

优点：立即、无文件操作、开发影响小。

缺点：旧 `node dist/index.js` 手工命令仍可执行。

安全性：MEDIUM。

### K2：Move `dist` to Quarantine

```text
apps/worker/dist
  -> <quarantine>/worker-dist-<artifact-id>/
```

优点：

- 默认 direct entry消失；
- 可逆 rename；
- secure build 不依赖 dist；
- 对当前测试无影响。

缺点：需要文件操作授权；需确认没有进程使用旧 dist。

安全性：HIGH。

### K3：ACL Deny Read/Execute

- Legacy `dist` 保留；
- Runtime 和开发者组不可读；
- 仅隔离管理员可访问；
- 需专用身份和窗口文件句柄检查。

优点：不改变路径，可审计保留。

缺点：ACL 复杂；开发身份可能共享；真实 Windows ACL 必须测试。

安全性：HIGH WITH SEPARATE IDENTITY。

### K4：Archive then Delete

最高安全；单独删除审批；Archive 保留 hash/审计。

## 10. 推荐架构

```text
Development
  -> apps/web/.next [DEV ONLY]

Production Web
  -> apps/web/.p13-releases/<releaseId>
  -> signed Manifest
  -> Secure Launcher + instrumentation Gate

Production Worker
  -> P13_WORKER_RELEASE_ROOT/<releaseId>
  -> signed Manifest
  -> Secure Launcher + Gate-first Bootstrap

Legacy Quarantine (future)
  -> <external-or-admin controlled root>/<artifact-id>/
  -> read-only archive metadata
  -> no runtime read/execute
```

原则：

- Production start whitelist 只允许 release；
- `.next` 只代表开发缓存；
- Worker `dist` 不是发布目录；
- Quarantine 不与任何 default output path 重叠；
- Build/Deploy 包排除 `.next`/Worker `dist`；
- 任何 Artifact identity 未知时拒绝部署。

## 11. 分阶段执行方案

### Phase I：立即低风险措施（无需文件/ACL 修改）

1. 保持当前 secure package scripts/config/bootstrap；
2. Formal start 只使用 package `start`；
3. 禁止手工 `next start`、`node dist/index.js`；
4. 禁止从 HEAD-only checkout 部署；
5. 记录 `.next`/dist 哈希；
6. 不在旧目录上构建。

验收：

- no project process；
- package scripts safe；
- hashes unchanged；
- no old artifact executed。

### Phase II：源码/发布流程整改

前置：获准提交当前 worktree。

1. 提交 secure scripts/config/bootstrap；
2. CI 拒绝 direct entry；
3. Release packaging allowlist；
4. Build manifest artifact roots；
5. 打包排除 `.next`、`apps/worker/dist`、`.p13-build` 历史缓存；
6. 发布前扫描 legacy marker 和 direct scripts。

验收：

- clean build uses isolated release；
- unsigned/incomplete release rejected；
- no default legacy path in package；
- Build failure does not fallback。

### Phase III：文件 Quarantine

前置：独立授权、无运行实例、文件句柄 0、hash 清单完成。

1. 选择同卷受控 quarantine root；
2. 创建 artifact manifest；
3. 同一卷 rename；
4. 验证原路径不存在；
5. 验证 package start/dev/test 不读取 quarantine；
6. 保留回滚 rename 记录。

禁止跟随 `.next` 内 Reparse Point。

### Phase IV：ACL / Runtime Identity

前置：独立 ACL 授权、专用身份设计。

1. Web/Worker/Maintenance 低权限身份；
2. Runtime 对 Quarantine 无读取/执行；
3. Release Root 只读；
4. Trust Root Admin-only；
5. Parent/Reparse/Junction 防护；
6. 真实 ACL 导出和有效权限验证。

### Phase V：Retirement

前置：保留期结束、无回滚需求、审批完成。

1. 删除 Quarantine Artifact；
2. 保存删除证据和 hash；
3. 不把删除成功当成生产信任；
4. 不自动启用 Cleanup。

## 12. 当前允许立即采用的配置

本轮没有新增运行配置。

推荐的当前操作规则：

```text
Allowed formal Web start:
pnpm --filter @elevator/web start

Allowed formal Worker start:
pnpm --filter @elevator/worker start

Development:
pnpm --filter @elevator/web dev
pnpm --filter @elevator/worker dev

Forbidden:
next start
node apps/worker/dist/index.js
direct worker-entry
```

缺少 P13 环境时，正式 start 应失败；不得提供 fallback。

## 13. 未验证事项

- 当前工作树的 P13 secure Release 尚未构建；
- P13 Web `.p13-releases` 当前不存在；
- Production Trust Root 未配置；
- 真实 Windows ACL/低权限身份未验证；
- Quarantine 路径尚未创建；
- 旧 Artifact 尚未移动；
- 生产环境未部署；
- 生产安全未验证。

## 14. 最终策略状态

```text
Recommended Isolation Strategy:
DEFINED

Immediate Phase:
IN-PLACE GUARD / NO FILE OPERATION

Quarantine:
DESIGNED / NOT EXECUTED

ACL Isolation:
DESIGNED / NOT EXECUTED

Deletion:
DESIGNED / NOT AUTHORIZED

Production Deployment:
NOT EXECUTED

Next Phase:
NOT AUTHORIZED
```
