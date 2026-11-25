# P1-3 C-6.2-L2 Legacy Build Artifact 隔离与启动安全审计设计

## 文档信息

- 阶段：`C-6.2-L2`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 状态：`READ-ONLY AUDIT / BLOCKED`
- 构建：`NOT EXECUTED`
- 旧产物删除/隔离/移动：`NOT EXECUTED`
- Startup Gate：`NOT IMPLEMENTED`
- Production Artifact Status：`UNKNOWN`

## 1. 总体结论

当前源码已完成 L fail-closed，但本地可由启动脚本直接引用的旧构建产物仍包含 Legacy 物理删除代码：

```text
apps/web/.next
apps/worker/dist
```

只读扫描结果：

```text
Artifact roots: 8
Dangerous marker hits: 49
Affected files: 23
Dangerous startup-reachable roots: 2
```

扫描器以退出码 1 结束，这是预期的 fail-closed 审计结果。

```text
C-6.2-L2:
BLOCKED

Legacy Build Artifacts:
PRESENT / STARTUP-REACHABLE

Startup Entry Audit:
PARTIALLY VERIFIED

Build Identity:
NOT IMPLEMENTED / VERSION UNKNOWN

Startup Gate:
NOT IMPLEMENTED

Legacy Artifact Removal:
NOT EXECUTED

Production Artifact Status:
UNKNOWN
```

本轮只完成审计、设计、只读扫描器、Manifest 纯函数验证和文档，不实施构建或启动门禁。

## 2. 审计工具

新增只读扫描器：

```text
apps/web/scripts/p13-build-audit/scanner.ts
apps/web/scripts/p13-build-audit/cli.ts
```

安全边界：

- 只读取 build artifact 目录和文本；
- 不 import、require 或执行扫描到的构建模块；
- 不修改、移动、重命名、删除或覆盖产物；
- 不执行 build；
- 不启动 Web/Worker；
- 不连接数据库；
- 不读取秘密配置；
- 跳过 symlink；
- 单文件超过 20 MiB 不读取；
- 危险 marker 存在时退出码为 1。

扫描器不能替代完整 AST 分析、制品签名或运行时门禁。

## 3. 构建产物清单

| Artifact ID | Path | Type | Build Identity | Legacy Delete | Startup Reachable | Risk | Proposed Action |
|---|---|---|---|---|---|---|---|
| ART-001 | `apps/web/.next` | Web server bundle | Build ID `LULjk7Rp3QcYPDlFEyycy`; Source SHA UNKNOWN | YES | YES via `next start` | HIGH | QUARANTINE / REBUILD |
| ART-002 | `apps/web/test-results` | Test artifact | UNKNOWN | NO | NO | LOW | KEEP |
| ART-003 | `apps/web/tsconfig.tsbuildinfo` | TS cache | UNKNOWN | NO | NO | LOW | KEEP |
| ART-004 | `apps/worker/dist` | Worker bundle | Build ID/SHA UNKNOWN | YES | YES via `node dist/index.js` | HIGH | QUARANTINE / REBUILD |
| ART-005 | `packages/contracts/dist` | Package bundle | UNKNOWN | NO | Reachable dependency | MEDIUM | KEEP / manifest later |
| ART-006 | `packages/file-storage/dist` | Package bundle | UNKNOWN | NO; current fail-closed code | Reachable dependency | MEDIUM | KEEP / verify digest |
| ART-007 | `packages/selection-engine/dist` | Package bundle | UNKNOWN | NO | Reachable dependency | MEDIUM | KEEP / manifest later |
| ART-008 | `packages/shared-ui/dist` | Package bundle | UNKNOWN | NO | Reachable dependency | MEDIUM | KEEP / manifest later |

未发现：

- `.zip/.7z/.rar/.tgz/.tar/.gz` 部署压缩包；
- `.exe/.msi`；
- `.turbo/.vercel/coverage`。

所有 `dist/.next` 都被 `.gitignore` 排除。目录 mtime 只可作为观测值，不能作为可信 build time。

执行审计测试时，TypeScript `noEmit` 检查因 `incremental: true` 刷新了忽略文件 `apps/web/tsconfig.tsbuildinfo`。该文件是非运行时缓存；危险运行时产物 `.next` 和 `apps/worker/dist` 未被修改。该缓存副作用使“完全不产生任何构建副产物写入”的严格要求未被满足，已保留原状并如实记录。

## 4. 危险构建代码检测

扫描 marker：

```text
fs.rm(
fs.unlink(
.removeStaging(
.removeObject(
.cleanupOrphanObjects(
.cleanupTemp(
deleteObject(
```

当前结果：

```text
dangerous marker hits = 49
affected files = 23
dangerous artifact roots = apps/web/.next, apps/worker/dist
```

入口级危险文件：

```text
apps/web/.next/server/chunks/[root-of-the-server]__0e5-f2rdyijtd._.js
apps/web/.next/server/chunks/[root-of-the-server]__0e5-f2rdyijtd._.js.map
apps/web/.next/server/chunks/[root-of-the-server]__0jh743w8n5ftu._.js.map
apps/worker/dist/file-maintenance.js
```

Web chunk 包含旧 Upload cleanup 和 Storage delete；Worker dist 包含 expired Intent、orphan 和 temp cleanup。`.next/dev` 另有多份旧 chunk/source map。

工具限制：

- marker 只能覆盖已知 Legacy 形式；
- source map 会产生重复 finding；
- minified bundle 可能重命名符号；
- 必须与 Manifest、签名、摘要和 Startup Gate 分层使用。

## 5. 启动入口映射

| 命令 | Artifact | Source Evidence | Risk |
|---|---|---|---|
| `pnpm dev:web` | Next dev cache | working tree only | MEDIUM：源码已修，旧 dev cache 仍存在 |
| Web `start` / `next start` | `apps/web/.next` | Build ID，无 Git SHA 映射 | HIGH：可直接加载旧删除代码 |
| `pnpm dev:worker` | `tsx watch src/index.ts` | working tree only | LOW/MEDIUM |
| Worker `start` / `node dist/index.js` | `apps/worker/dist` | VERSION UNKNOWN | HIGH |
| root `pnpm build` | current build dirs | dirty worktree | NOT EXECUTED |
| Worker build | `apps/worker/dist` | dirty worktree | NOT EXECUTED |
| E2E Worker | source via `tsx` | test worktree | TEST ONLY |
| test-db reset | guarded test root | test script | TEST ONLY |

关键事实：

1. `next start` 不会自动重新编译源码；
2. `node dist/index.js` 不会自动重新编译源码；
3. 当前无 Startup Gate；
4. 当前无 build failure no-fallback 门禁；
5. 当前无证据表明 Web 与 Worker 同步更新；
6. 生产启动入口仍 UNKNOWN。

## 6. Build Identity Model

| 标识 | 作用 | 限制 |
|---|---|---|
| Git SHA | 提交追溯 | 不能表达 dirty tree 或实际制品 |
| Build ID | 区分构建 | 可人工伪造 |
| Build Timestamp | 辅助排序 | 目录 mtime 不可信 |
| Source Tree Digest | 检测未提交输入 | 需定义排除项 |
| Artifact Digest | 检测产物变化 | 需定义完整范围 |
| Manifest | 组合构建身份 | 需签名或受信 attestation |
| Release ID | Web/Worker 发布绑定 | 需发布系统维护 |

推荐组合：

```text
gitSha
sourceTreeDigest
buildId
artifactDigest
dependencyLockDigest
releaseId
lifecycleSafetyVersion
cleanupCapability
manifestSignature
```

### Manifest 示例

```json
{
  "manifestVersion": 1,
  "application": "worker",
  "buildId": "ci-run-id-or-generated-id",
  "releaseId": "web-worker-compatible-release",
  "gitSha": "40-hex-commit",
  "gitDirty": false,
  "sourceTreeDigest": "sha256:64-hex",
  "dependencyLockDigest": "sha256:64-hex",
  "artifactDigest": "sha256:64-hex",
  "artifactDigestAlgorithm": "sha256",
  "buildTimestamp": "2026-11-18T00:00:00.000Z",
  "lifecycleSafetyVersion": "p13-l2-1.0.0",
  "cleanupCapability": "DISABLED",
  "artifactRoots": [
    "apps/worker/dist",
    "packages/contracts/dist",
    "packages/file-storage/dist"
  ],
  "manifestSignature": "signed-by-trusted-ci",
  "manifestSignatureKeyId": "non-secret-key-id"
}
```

Manifest 不得包含连接串、Token、Storage Secret、客户数据或绝对私有路径。

## 7. Manifest Validation

本阶段实现纯函数：

```text
validateBuildManifest(input, expected)
```

校验内容：

- Manifest 对象；
- `manifestVersion=1`；
- application；
- buildId；
- 40-hex Git SHA 及期望值；
- 64-hex source/artifact digest；
- artifact digest 与期望值；
- buildTimestamp；
- lifecycleSafetyVersion 最低版本；
- `cleanupCapability=DISABLED`；
- 未知字段不会使安全字段被忽略。

防伪造边界：

```text
artifactDigest
  + manifestSignature / attestation
  + trusted public key or release record
```

没有签名时，同时修改 Manifest 与产物摘要仍可能自洽，不能声称不可伪造。

## 8. Startup Gate 设计

分层防护：

```text
Build
  -> Manifest + artifact digest
  -> CI dangerous-marker scan

Release
  -> sign Manifest / attestation
  -> immutable artifact storage

Startup
  -> verify signature
  -> verify app/build/git/lifecycle fields
  -> recompute artifact digest
  -> verify cleanupCapability=DISABLED
  -> verify Web/Worker release compatibility
  -> only then dynamic import verified entry
```

必须拒绝：

- Manifest 缺失或 JSON 非法；
- Build ID 缺失；
- Git SHA 缺失、非法或不匹配；
- digest 非法或不匹配；
- lifecycleSafetyVersion 过旧；
- cleanupCapability 缺失、未知或不是 `DISABLED`；
- signed attestation 无效；
- artifact 含已知危险 marker；
- Web/Worker release 不兼容；
- 校验后文件被替换。

禁止 fallback：

- Manifest 缺失时默认安全；
- 手工填写安全字段后跳过摘要；
- 校验失败后启动旧目录；
- Worker 自动重启绕过 launcher；
- 构建失败后继续发布旧 build。

### Web launcher

```text
release launcher
  -> verify web manifest/digest/signature
  -> spawn verified server entry
```

不应在生产直接运行 `next start` 指向不受信 `.next`。

### Worker launcher

```text
release launcher
  -> verify worker manifest/digest/signature
  -> dynamic import verified worker entry
```

不应在生产直接运行未受信的 `node dist/index.js`。

### TOCTOU

摘要校验和 import 之间仍有替换窗口。缓解包括：

- release 目录只读；
- 独立 OS 身份；
- 容器只读 root filesystem；
- 启动后复核关键文件；
- 记录文件身份；
- Runtime 无权写 release 目录。

## 9. 当前构建配置风险

`apps/web/next.config.ts` 当前执行：

```text
loadEnv({ path: workspaceRoot/.env })
```

即使配置未使用环境值，构建仍会读取真实 `.env`。这与“build 不读取 secret”的目标冲突。后续应独立授权：

- 移除 build-time `.env` 读取；
- Build 只接收非秘密 Build ID/Release 参数；
- Runtime secret 仅在启动时注入；
- 不把 secret 写入 bundle、source map、Manifest 或日志。

当前 Web 默认写入 `apps/web/.next`，Worker 默认写入 `apps/worker/dist`，两者都没有独立 release root 或 Manifest。

## 10. 旧产物隔离、重建和清理流程

### Step 1：识别

- 运行只读 scanner；
- 记录 root、file count、size、Build ID、危险 marker；
- 不把目录 mtime 当可信 build time。

### Step 2：冻结启动

- 移除旧 `next start` / Worker `start` 启动入口；
- 禁止自动重启旧目录；
- 记录实例和启动时间。

### Step 3：隔离

获得独立授权后：

- 将旧产物移动到受限 quarantine release directory；或
- 将旧产物设为不可执行/只读；
- 阻止服务管理器回退引用。

本轮不移动、不改名、不删除。

### Step 4：隔离输出重建

获得独立授权且证明输出隔离后：

- Web 构建到新的唯一 release directory；
- Worker 构建到新的唯一 release directory；
- package dist 同步生成；
- 构建不得覆盖旧历史产物；
- 构建失败不得发布。

### Step 5：生成身份

- sourceTreeDigest；
- dependencyLockDigest；
- artifactDigest；
- buildId；
- releaseId；
- lifecycleSafetyVersion；
- cleanupCapability；
- manifestSignature / attestation。

### Step 6：验证

- scanner 零危险 finding；
- Manifest 合法；
- artifact digest 重算一致；
- Web/Worker compatibility；
- signed attestation。

### Step 7：独立环境启动门禁

- 缺 Manifest 拒绝；
- 篡改 artifact 拒绝；
- 旧 capability 拒绝；
- 旧目录 fallback 拒绝；
- Web/Worker 不兼容拒绝。

### Step 8：部署切换

- 新旧 Worker 不并行拥有删除权；
- 旧 Worker 排空；
- 旧 Scheduler 停用；
- New Cleanup 保持关闭。

### Step 9：最终处置

只有部署、排空和历史依赖均确认后，才允许独立授权 REMOVE。

## 11. 历史产物处置建议

| Artifact | Recommendation | Reason |
|---|---|---|
| `apps/web/.next` | QUARANTINE / REBUILD | 旧 server bundle 含危险 marker，`next start` 可达 |
| `apps/worker/dist` | QUARANTINE / REBUILD | 旧 file-maintenance 含删除调用 |
| `packages/file-storage/dist` | KEEP / VERIFY | 当前 L fail-closed，但缺 Manifest |
| 其他 package dist | KEEP | 非已知危险入口，仍需版本身份 |
| `test-results` | KEEP | 非启动测试产物 |
| `tsconfig.tsbuildinfo` | KEEP | 缓存，不是运行时 |

`REMOVE` 必须后续独立授权，本轮实际处置全部为 `NOT EXECUTED`。

## 12. 自动化测试

### 已实现

Legacy Artifact Scanner：

- 识别 Worker 删除调用；
- 安全 fail-closed error 本身不误报；
- 识别 Web/Worker/Package bundle；
- 识别 cache、test artifact、archive；
- 跳过 symlink；
- 不执行 artifact。

Manifest Validator：

- 合法 DISABLED Manifest 通过；
- 缺 Manifest 拒绝；
- Build ID 缺失拒绝；
- Git SHA 不匹配拒绝；
- Artifact Digest 不匹配拒绝；
- lifecycle safety 过旧拒绝；
- cleanup capability 非 DISABLED 拒绝；
- 未知字段不会掩盖缺失安全字段。

结果：

```text
4/4 PASS
```

### 设计但未实现

- signature/attestation 验证；
- Startup Launcher integration；
- Web/Worker release compatibility；
- build failure no-fallback；
- artifact replacement TOCTOU；
- read-only release directory；
- Worker restart gate；
- deployment rollback gate。

这些测试不得通过启动旧业务 artifact 完成。

## 13. 静态扫描器执行

```text
pnpm --filter @elevator/web exec tsx \
  scripts/p13-build-audit/cli.ts <workspace> --summary
```

当前仓库：

```text
artifactRootCount = 8
dangerousFindingCount = 49
exitCode = 1
```

退出码 1 是 fail-closed 审计结果，不是扫描器异常。

## 14. 独立反向自审

| 问题 | 结论 |
|---|---|
| 是否遗漏其他构建目录 | scanner 覆盖常见 8 类目录；非标准目录仍可能遗漏 |
| 是否遗漏 Web server bundle | ART-001 已识别 |
| 是否遗漏 Worker bundle | ART-004 已识别 |
| 是否遗漏 Docker Image | 本地无 Docker；外部镜像 UNKNOWN |
| 是否遗漏压缩包 | 本地未发现 |
| 是否遗漏 dev 启动 | Web/Worker dev 已映射 |
| 是否遗漏回退逻辑 | 未见显式 fallback，外部脚本 UNKNOWN |
| Manifest 是否可能与产物脱离 | 需签名与完整 digest |
| Digest 范围是否完整 | 当前未实施 |
| 文件构建后是否可替换 | TOCTOU 存在，需只读 release |
| 手工修改 Manifest 是否可伪装 | 无签名时可能，已列缺口 |
| Git SHA 正确但 dirty | Manifest 需 gitDirty/sourceTreeDigest |
| Web/Worker 版本差异 | 当前无 releaseId |
| 自动重启绕过 | 当前无 gate |
| 旧镜像重新部署 | 本地无证据，生产 UNKNOWN |
| 回滚旧版 | 当前无 gate，风险存在 |
| CI 失败继续发布 | 无 CI 配置证据 |
| 秘密泄露 | `next.config.ts` 当前读取 `.env` |
| 本地状态等同生产 | 未等同，Production UNKNOWN |
| Gate 影响正常业务 | 未实施，无法验证 |

## 15. 阻断与后续依赖

当前 BLOCKED：

- 旧 Web `.next` 可被 `next start` 引用；
- 旧 Worker `dist` 可被 `node dist/index.js` 引用；
- 无 Manifest；
- 无 artifact digest；
- 无 signature/attestation；
- 无 Startup Gate；
- 无运行时 Build ID；
- 无部署制品清单；
- 生产 Artifact Status UNKNOWN。

后续独立授权：

1. 隔离旧 `.next` 和 Worker `dist`；
2. 更新 start scripts/launcher；
3. 移除 build-time `.env` 读取；
4. 生成 Manifest 与签名；
5. 写入只读 release 目录；
6. 实施 Startup Gate；
7. 用 Clone/临时目录验证；
8. 排空旧实例；
9. 切换部署；
10. 最后清理历史产物。

## 16. 当前门禁

```text
C-6.2-L2:
BLOCKED

Legacy Build Artifacts:
PRESENT / STARTUP-REACHABLE

Startup Entry Audit:
PARTIALLY VERIFIED

Build Identity:
NOT IMPLEMENTED

Startup Gate:
NOT IMPLEMENTED

Legacy Artifact Removal:
NOT EXECUTED

Production Artifact Status:
UNKNOWN

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
