# P1-3 C-6.2-L3 Build Identity、Signed Manifest 与 Startup Gate 设计

## 文档信息

- 阶段：`C-6.2-L3`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS WITH WARNINGS`
- 生产签名密钥：`NOT CONFIGURED`
- 生产信任根：`NOT CONFIGURED`
- 生产部署：`NOT EXECUTED`
- New Cleanup：`NOT ENABLED`

## 1. 实施摘要

已实现统一 `@elevator/build-integrity` 安全包，提供：

- 确定性 Source Tree Digest；
- Artifact Digest；
- 严格 JSON 解析；
- Canonical JSON；
- Ed25519 Signed Manifest；
- 公钥信任映射；
- Startup Release 验证；
- Legacy delete marker 扫描；
- Lifecycle Safety Version；
- `cleanupCapability=DISABLED` 强制校验。

已接入：

- Worker 最小 Bootstrap；
- Worker business entry 动态加载；
- Web instrumentation Gate；
- Web production start wrapper；
- Web/Worker secure build scripts；
- Next production build 隔离输出目录要求；
- Next 显式 `.env` 加载移除。

生产密钥、公钥信任根和部署配置仍保持未配置；缺失时所有 Gate fail-closed。

## 2. Build Identity

### 2.1 字段

```text
manifestVersion = 1
application = web | worker
buildId = SHA-256(app/git/source/lock/artifact/timestamp) 前 32 hex
releaseId
gitSha
gitDirty
sourceTreeDigest
sourceTreeExclusionPolicyVersion
dependencyLockDigest
artifactDigest
artifactDigestAlgorithm = sha256
buildTimestamp
lifecycleSafetyVersion = 1.0.0
cleanupCapability = DISABLED
artifactRoots
```

Build ID 由应用名、Git SHA、Source Digest、Lock Digest、Artifact Digest 和时间生成，不使用手工固定字符串。

### 2.2 Dirty Tree

构建脚本只读调用：

```text
git rev-parse HEAD
git status --porcelain
```

结果写入 `gitSha` 和 `gitDirty`。Git SHA 正确但 dirty 时，Source Tree Digest 仍覆盖当前关键源码。

Git 不可用时构建拒绝，不生成安全 Manifest。

## 3. Source Tree Digest

### 3.1 算法

- SHA-256；
- 路径统一为 `/`；
- 按 UTF-8 路径码点稳定排序；
- 每项写入路径长度、路径、文件长度、内容和 NUL 分隔；
- 文件读取前后比较 size/mtimeNs；
- 文件在摘要期间变化则拒绝；
- symlink 默认拒绝。

### 3.2 排除规则

目录：

```text
.git
.next
.p13-releases
.turbo
.vercel
build
coverage
dist
node_modules
out
output
test-results
```

文件：

```text
.env
.env.*
p13-build-manifest.json
*.key
*.pem
*.tsbuildinfo
```

排除规则版本：

```text
p13-l3-source-v1
```

关键启动文件、Cleanup 安全代码、Manifest/Gate 模块、构建配置均包含在 Source Tree Digest。

## 4. Artifact Digest

Artifact Digest：

- 遍历 release root 中全部普通文件；
- 拒绝 symlink、特殊文件；
- 拒绝大小写不明确重复路径；
- 文件读取前后比较 size/mtimeNs；
- 按规范化路径稳定排序；
- 对路径长度、路径、内容长度和内容计算 SHA-256。

Manifest 文件自身通过 `excludedRelativePaths` 排除，避免自引用。

当前 Warn：

- Worker 隔离构建的 digest 覆盖 36 个 Worker release 文件；
- 运行时 `node_modules` 依赖尚未打包进 release root；
- `dependencyLockDigest` 覆盖 lockfile，但不证明已安装依赖字节；
- 因此 `Artifact Digest = IMPLEMENTED / RUNTIME DEPENDENCY COVERAGE PARTIAL`。

后续应采用 standalone/deploy bundle，将全部运行依赖纳入 Artifact Digest。

## 5. Signed Manifest

### 5.1 结构

```json
{
  "manifest": {
    "manifestVersion": 1,
    "application": "worker",
    "buildId": "32-hex",
    "releaseId": "release-id",
    "gitSha": "40-hex",
    "gitDirty": true,
    "sourceTreeDigest": "64-hex",
    "sourceTreeExclusionPolicyVersion": "p13-l3-source-v1",
    "dependencyLockDigest": "64-hex",
    "artifactDigest": "64-hex",
    "artifactDigestAlgorithm": "sha256",
    "buildTimestamp": "ISO-8601",
    "lifecycleSafetyVersion": "1.0.0",
    "cleanupCapability": "DISABLED",
    "artifactRoots": ["."]
  },
  "signature": {
    "algorithm": "ed25519",
    "keyId": "non-secret-key-id",
    "value": "base64url"
  }
}
```

### 5.2 签名流程

```text
canonicalize(manifest)
  -> UTF-8 bytes
  -> Ed25519 sign
  -> base64url signature
```

私钥只从构建脚本指定路径读取，不进入 Manifest、artifact、日志或报告。

### 5.3 Canonical JSON

- 对象 key 按码点排序；
- 数组保持顺序；
- 拒绝 undefined、function、non-finite number；
- 严格 JSON parser 拒绝重复字段、尾随内容和非法结构；
- 未知 Manifest 字段拒绝；
- Manifest 字段必须完整。

### 5.4 验证

验证顺序：

1. 严格 JSON；
2. 顶层 envelope 字段；
3. Manifest 全部字段和格式；
4. application/build/release/git/build ID；
5. cleanupCapability；
6. lifecycleSafetyVersion；
7. trusted keyId；
8. Ed25519 signature；
9. build timestamp 时效；
10. Artifact Digest；
11. Legacy delete scan。

## 6. Trust Root 与密钥轮换

运行时从外部 file path 读取：

```text
{
  "keys": {
    "key-id": "PUBLIC KEY PEM"
  }
}
```

Trust Root 不在 Manifest 内，不从待验证产物读取公钥。

设计要求：

- 生产公钥文件由部署系统以只读方式注入；
- 文件路径由受信启动配置指定；
- keyId 必须存在于信任集合；
- 未知 keyId 拒绝；
- 轮换时同时发布新旧公钥一段时间；
- 撤销时从信任集合移除旧公钥；
- trust root 文件本身应由外部配置管理/只读挂载保护；
- 当前代码不使用生产密钥，生产 Trust Root 未配置。

## 7. Worker Startup Gate

### 7.1 入口结构

```text
src/index.ts
  -> import only build-integrity and security/startup-gate
  -> runWorkerStartupGate()
  -> dynamic import("./worker-entry.js")
  -> startWorker()
```

`worker-entry.ts` 才静态导入：

- Prisma Client；
- pg-boss；
- Storage Adapter；
- Worker config；
- processing/maintenance。

Gate 失败时不会加载这些业务模块，也不会连接数据库或初始化 Storage。

### 7.2 必需配置

```text
P13_WORKER_RELEASE_ROOT
P13_WORKER_MANIFEST_PATH
P13_TRUSTED_PUBLIC_KEYS_PATH
P13_BUILD_GIT_SHA
P13_RELEASE_ID
```

任一缺失：

```text
worker.startup_rejected
exit 1
```

### 7.3 自动重启

仓库内的 `node dist/index.js` 指向 minimal bootstrap。PM2/systemd/Service 即使自动重启，也重新进入 Gate。

外部直接执行旧 Worker bundle 仍需要部署侧禁止。

## 8. Web Startup Gate

### 8.1 Start wrapper

`apps/web/package.json`：

```text
start = node scripts/start-secure.mjs
```

Wrapper 在启动 Next 前：

- 校验 Web release manifest；
- 校验签名与公钥；
- 校验 Git/Release/Lifecycle；
- 重算 Artifact Digest；
- 扫描 Legacy delete；
- 设置隔离的 `P13_NEXT_DIST_DIR`；
- 只有验证成功才启动 Next。

### 8.2 Next instrumentation

新增 `apps/web/src/instrumentation.ts`：

- production 启动再次执行 `runWebStartupGate()`；
- 只依赖 Gate 模块；
- 不导入 Prisma、pg-boss 或 Storage；
- 校验失败阻止服务进入可用状态。

### 8.3 绕过边界

仓库支持的 `pnpm --filter @elevator/web start` 经过 Gate。

外部人员仍可直接执行：

```text
next start
```

来启动一个存在/不存在的 `.next`。因此必须由部署配置禁止直接命令，并使用 wrapper/read-only release。

本阶段没有修改部署环境；`Web Startup Gate = IMPLEMENTED / PRODUCTION BYPASS CONTROL PARTIAL`。

## 9. Build Pipeline

### 9.1 Web

`apps/web/package.json`：

```text
build = tsx scripts/build-secure.ts
```

`build-secure.ts`：

- 要求 `P13_RELEASE_ID`；
- 要求 `P13_WEB_RELEASE_ROOT` 等于 `.p13-releases/<releaseId>`；
- 目标必须不存在；
- 设置 `P13_NEXT_DIST_DIR`；
- 执行 Next build；
- build 非零立即停止；
- 生成 Source/Artifact Digest；
- 扫描 Legacy delete；
- 生成并签署 Manifest；
- 不 fallback 旧 `.next`。

本阶段没有执行 Web Next build。

### 9.2 Worker

`apps/worker/package.json`：

```text
build = tsx scripts/build-secure.ts
```

流程：

- 要求唯一不存在的 release root；
- `tsc --outDir <temp-release> --incremental false`；
- build 失败立即停止；
- 生成/签名 Manifest；
- 静态扫描新产物。

已执行隔离构建：

```text
artifact files = 36
legacy findings = 0
signed manifest verification = PASS
```

### 9.3 Failure Protection

未设置构建配置时：

```text
Web build exit = 1
Worker build exit = 1
旧 .next BUILD_ID hash = unchanged
旧 worker dist hash = unchanged
```

构建失败不会启动已有产物。

## 10. Next.js 秘密隔离

已修改 `apps/web/next.config.ts`：

- 删除 `dotenv` import；
- 删除根 `.env` 的显式 `loadEnv()`；
- production build 必须设置隔离 `P13_NEXT_DIST_DIR`；
- 未配置时直接拒绝 build；
- `distDir` 只允许 `.p13-releases/<safe-id>`。

Next.js 自身可能加载 app 目录环境文件；`apps/web` 当前不存在 `.env`/`.env.test`。本阶段未读取根真实 env。

剩余状态：

```text
Secret Isolation = PARTIALLY VERIFIED
```

Web build 未执行，不能证明所有 Next 编译输出均无秘密。

## 11. Web / Worker Compatibility

两个 Gate 都要求：

```text
P13_RELEASE_ID
```

Manifest `releaseId` 必须等于该值。

因此部署必须为 Web/Worker 注入同一 release ID；不同 release ID 会被拒绝。

未实现在线 peer manifest 互查。Worker/Web 不能直接读取彼此 manifest，依赖部署层保证同一 release ID。

## 12. TOCTOU

已实现：

- 摘要前后 stat 比较；
- 文件读取期间变化拒绝；
- Manifest/Trusted Key 文件必须为普通文件；
- 拒绝 symlink；
- Gate 后从同一 release root 启动；
- Web distDir 由 release root 反推；
- Worker dynamic import 使用编译后固定相对入口。

未实现/未验证：

- release root 只读 ACL；
- 启动器持有文件描述符或 inode 级执行绑定；
- 校验完成后到 dynamic import 之间的原子不可替换；
- 容器只读 root filesystem；
- OS 级 Reparse Point 全路径验证。

```text
TOCTOU = PARTIAL
```

## 13. 测试结果

### Web 全量纯单元测试

```text
19 files / 105 tests PASS
```

新增 L3 测试：

### L3 Security

```text
15/15 PASS
```

覆盖：

- canonical JSON；
- duplicate JSON；
- Source Digest 稳定性/排除/变更；
- symlink/Junction 拒绝；
- Ed25519 签名；
- 错误 key；
- Manifest 篡改；
- 未知字段；
- cleanup capability；
- Artifact Digest；
- 新增/替换文件；
- release mismatch；
- Web/Worker Gate；
- minimal bootstrap；
- build/start wrapper；
- Next secret config。

### Worker 全量纯单元测试

```text
5 files / 16 tests PASS
```

### file-storage

```text
15/15 PASS
```

### TypeScript

```text
Web: PASS（--incremental false）
Worker: PASS（--incremental false）
```

### 隔离 Worker 构建

```text
Signed Manifest = PASS
Artifact files = 36
Artifact Digest = 8d529fdad4daaab9b84da8b9f57860d288b0e679a6b3647ffffc45f0d37e1d9f
Legacy findings = 0
Startup Gate = PASS
```

测试 release 位于系统唯一临时目录，验证后删除。

## 14. 未解决风险

1. 生产签名私钥未配置；
2. 生产 Trust Root 未配置；
3. Web production build 未执行；
4. Web direct `next start` 外部绕过需部署控制；
5. Runtime node_modules 未进入 Artifact Digest；
6. release root 只读权限未配置；
7. TOCTOU 未完成 OS 级证明；
8. 旧 `.next`/Worker `dist` 未隔离、移动或删除；
9. Production Artifact Status UNKNOWN；
10. 生产 Service/CI/CD/Scheduler 未接入新命令；
11. `next.config.ts` 自动 env 机制只做静态审计，未用真实 build 验证；
12. 旧构建产物仍可由外部直接命令启动。

## 15. 验收状态

```text
C-6.2-L3:
PASS WITH WARNINGS

Build Identity:
IMPLEMENTED / VERIFIED

Source Tree Digest:
IMPLEMENTED / VERIFIED

Artifact Digest:
IMPLEMENTED / RUNTIME DEPENDENCY COVERAGE PARTIAL

Signed Manifest:
IMPLEMENTED / VERIFIED WITH TEST KEY

Trust Root:
DESIGNED / PRODUCTION NOT CONFIGURED

Web Startup Gate:
IMPLEMENTED / UNIT TESTED / BUILD NOT EXECUTED

Worker Startup Gate:
IMPLEMENTED / ISOLATED BUILD VERIFIED

Build Failure Protection:
IMPLEMENTED / VERIFIED

TOCTOU Protection:
PARTIAL

Secret Isolation:
PARTIALLY VERIFIED

Legacy Artifact Removal:
NOT EXECUTED

Production Signing Key:
NOT CONFIGURED

Production Trust Root:
NOT CONFIGURED

Production Deployment:
NOT EXECUTED

Production Artifact Status:
UNKNOWN

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
