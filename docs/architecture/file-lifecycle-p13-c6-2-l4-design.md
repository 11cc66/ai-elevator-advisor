# P1-3 C-6.2-L4 Build Integrity 独立审计与运行时依赖完整性设计

## 文档信息

- 阶段：`C-6.2-L4`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 总体结论：`PASS WITH WARNINGS`
- Production Deployment：`NOT EXECUTED`
- Production Artifact Status：`UNKNOWN`

## 1. 实施摘要

L4 在 L3 基础上完成：

- 完整 Runtime Dependency Closure；
- Web / Worker Manifest 绑定已安装依赖闭包；
- 受控依赖 symlink/Junction 策略；
- Web 隔离 production build；
- Web build 秘密探针验证；
- Web Startup Gate 隔离验证；
- Worker 完整依赖闭包构建/Gate 验证；
- 依赖篡改、文件缺失、额外文件检测；
- Windows Junction/root replacement 测试；
- 供应链与锁文件审计；
- 第二轮攻击性自审。

## 2. Runtime Dependency Closure

## 2.1 算法

从 application root 的 `package.json` 开始，递归解析：

- `dependencies`；
- `optionalDependencies`；
- `peerDependencies`；
- workspace package；
- Node package manager 中的实际 realpath；
- 传递依赖。

Node built-ins 不展开文件，但 Node 版本、平台和架构进入闭合身份。

每个包记录：

```text
name
version
requestedVersion
package file digest
fileCount
totalBytes
native addon flag
```

总体 Runtime Dependency Digest 对稳定排序后的：

```text
nodeVersion
platform
arch
packages
missingOptionalDependencies
```

进行 SHA-256。

## 2.2 文件覆盖

- 遍历每个已安装包的真实目录；
- 包内有界并发读取文件；
- 每个文件读取前后比较 size/mtimeNs；
- `.node` Native Addons 纳入摘要并标记；
- 包目录内部嵌套的 `node_modules` 不作为包本体重复扫描，传递依赖由图遍历单独纳入；
- 未声明的动态包无法通过 package graph 发现，属剩余风险。

## 2.3 当前闭包结果

Worker：

```text
packages = 93
files = 7702
bytes = 341755987
digest = 0accdd025b738595a3fbf8cf44d4c53b1aa0945abaaf4c054230f8f91ef07f3f
native packages =
  @napi-rs/canvas-win32-x64-msvc@1.1.1
  @prisma/engines@6.19.0
  prisma@6.19.0
missing optional/peer entries = 12
```

最终隔离 Worker build 的 Manifest 数据：

```text
runtimePackages = 93
runtimeDependencyDigest =
0accdd025b738595a3fbf8cf44d4c53b1aa0945abaaf4c054230f8f91ef07f3f
```

Web：

```text
packages = 189
files = 20376
bytes = 669923536
digest = 0cd67bf0d1b34809383831d7d50efef9f627a626bdf34daf5b7fe2f98eb76220
native packages =
  @img/sharp-win32-x64@0.35.5
  @next/swc-win32-x64-msvc@16.4.6
  @prisma/engines@6.19.0
  @rollup/rollup-win32-x64-gnu@4.68.3
  @rollup/rollup-win32-x64-msvc@4.68.3
  lightningcss-win32-x64-msvc@1.33.0
  prisma@6.19.0
missing optional/peer entries = 124
```

最终隔离 Web build 的 Manifest 数据：

```text
runtimePackages = 189
runtimeDependencyDigest =
0cd67bf0d1b34809383831d7d50efef9f627a626bdf34daf5b7fe2f98eb76220
```

## 2.4 性能

完整 SHA-256 闭包测试：

```text
Worker ≈ 6.0 seconds
Web ≈ 13.6 seconds
```

当前策略优先安全，每次 Gate 都对实际已安装依赖重新计算。后续如需降低启动延迟，可在仅读 Release Root 和独立依赖 Seal 完成后再优化，不能取消验证。

## 3. Artifact Digest 与受信依赖链接

Artifact Digest 覆盖 release root 全部普通文件。

### 3.1 Symlink/Junction 策略

默认拒绝。

只允许 realpath 位于以下根的链接：

```text
Release Root
Runtime Root
Runtime Root/node_modules
Workspace/node_modules
Workspace/packages
```

链接目标内容按逻辑相对路径加入 Artifact Digest。目标变化会改变摘要。

不允许链接到：

- 任意系统目录；
- secrets；
- Workspace 源码根；
- Release Root 外部未登记目录。

拒绝 cycle、特殊文件和越界目标。

### 3.2 防止 Digest 范围脱离

Manifest 同时包含：

```text
artifactDigest
runtimeDependencyDigest
runtimeDependencyCount
runtimePlatform
dependencyLockDigest
```

Gate 重新计算全部四项。

## 4. Manifest 扩展

Manifest 新增：

```text
runtimeDependencyDigest
runtimeDependencyCount
runtimePlatform = platform-arch:nodeVersion
```

Build ID 也纳入 Runtime Dependency Digest。

Manifest 仍要求：

```text
cleanupCapability = DISABLED
lifecycleSafetyVersion >= 1.0.0
```

未知字段拒绝，缺失字段拒绝。

## 5. Web 隔离 Production Build

### 5.1 输出隔离

输出：

```text
apps/web/.p13-releases/<releaseId>
```

验证：

- 构建前不存在；
- 不使用历史 `.next`；
- 不清空历史 `.next`；
- 不读取真实 `.env`；
- 使用虚构数据库 URL/Auth Secret/Storage Root；
- 使用一次性测试签名密钥。

### 5.2 tsbuildinfo 隔离

构建生成临时：

```text
apps/web/.p13-build/<releaseId>/tsconfig.json
```

设置：

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "incremental": false,
    "tsBuildInfoFile": "./.tsbuildinfo.json"
  }
}
```

Next config 只接受隔离路径。

历史 `apps/web/tsconfig.tsbuildinfo` 哈希保持不变。

### 5.3 next-env 保护

Next build 会改写 `next-env.d.ts` 指向临时 distDir。Build wrapper：

1. 构建前读取原始字节；
2. Next build 返回后立即恢复；
3. Manifest Source Tree Digest 使用恢复后的源码；
4. finally 再恢复一次。

验证 `next-env.d.ts` 原哈希：

```text
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC
```

### 5.4 最终 Web build 结果

```text
Build ID = 0adb204efeeceeb6b13401a353a03ced
Release ID = l4-web-37eb5f4bcb02
artifactFiles = 1031
artifactBytes = 190175594
artifactDigest =
983c9db7c68ed596e3cd1943e36f8776729052ae956931b3a438098c581a0da8
runtimePackages = 189
runtimeDependencyDigest =
0cd67bf0d1b34809383831d7d50efef9f627a626bdf34daf5b7fe2f98eb76220
legacyFindings = 0
signedManifest = PASS
startupGate = PASS
```

历史产物：

```text
.next BUILD_ID = unchanged
Worker dist/file-maintenance.js = unchanged
tsconfig.tsbuildinfo = unchanged
next-env.d.ts = unchanged
```

## 6. Worker 隔离 Build

最终结果：

```text
Build ID = 969e9faa8974395f210552e5bef848bf
Release ID = l4-worker-708d6f80ea76
artifactFiles = 36
artifactBytes = 131855
artifactDigest =
b251ad29dec99c963acb8a445be1c7c5176af95fd17938c511424c97dd5f2f86
runtimePackages = 93
runtimeDependencyDigest =
0accdd025b738595a3fbf8cf44d4c53b1aa0945abaaf4c054230f8f91ef07f3f
legacyFindings = 0
signedManifest = PASS
startupGate = PASS
```

测试临时目录已删除；历史 `apps/worker/dist` 未修改。

## 7. Startup Gate 独立审计

### Worker

```text
index.ts
  -> no business static imports
  -> verify manifest/signature/artifact/runtime deps/legacy scan
  -> dynamic import worker-entry.js
```

Gate 失败不加载：

- Prisma；
- pg-boss；
- Storage Adapter；
- Worker config；
- processing/maintenance。

### Web

两个层级：

1. `scripts/start-secure.mjs` 在 spawn Next 前验证；
2. Node-only Next instrumentation 在 production server 启动时验证。

Instrumentation 通过：

```text
if NEXT_RUNTIME === nodejs
  -> dynamic import startup gate
```

避免 Edge bundle 引入 Node crypto/fs。

### 仓库内入口

| 入口 | Gate |
|---|---|
| Web package `start` | PASS THROUGH WRAPPER |
| Next instrumentation | PASS IN SECURE BUILD |
| Worker package `start` | PASS THROUGH dist bootstrap |
| Worker dev | `tsx watch src/index.ts` -> Gate，需要签名 release 配置 |
| Web dev | instrumentation 在 development 不执行 |
| E2E Worker | test-only |

### 仍然存在的绕过

外部直接执行：

```text
next start
```

仍可绕过 package wrapper。新构建应自动加载 instrumentation，但旧 `.next` 没有 Gate。

部署层必须禁止 direct start，并使用不可变 release 目录。

## 8. TOCTOU 与 Release Root

### Code-Level TOCTOU

已验证：

- Manifest/Trust file 必须 regular file；
- Artifact symlink/Junction root 拒绝；
- 受信 symlink target 范围；
- Artifact/依赖读取期间变化拒绝；
- 连续两次 Gate 检查中修改 Artifact 会拒绝。

状态：

```text
Code-Level TOCTOU: VERIFIED
```

### Isolated Filesystem TOCTOU

已测试：

- Windows Junction 拒绝；
- symlink target 范围；
- artifact root Junction 拒绝；
- 文件替换后 digest mismatch。

未测试：

- 父目录原子替换；
- 多用户 ACL；
- 无权限写入身份；
- 文件锁定执行句柄。

```text
Isolated Filesystem TOCTOU: PARTIALLY VERIFIED
Windows ACL Simulation: NOT VERIFIED
Production Release Root Immutability: NOT VERIFIED
```

### 推荐生产机制

- 每个 Release 使用新目录；
- 发布完成后设置只读 ACL；
- Web/Worker 使用独立运行身份；
- Release Root 父目录禁止 Runtime 写；
- 原子切换 `current` pointer；
- 验证与执行使用同一 realpath；
- 容器使用 read-only root filesystem；
- 旧 Release 只读保留；
- 回滚只切回已签名且安全版本仍允许的 Release。

## 9. Secret Isolation

Web build 使用唯一虚构探针：

```text
P13_SECRET_PROBE = 一次性随机值
```

扫描全部 Release 文件：

```text
Client Bundle
Server Bundle
Manifest
Source Map
Other Artifact Files
```

结果：

```text
ProbeFound = false
```

同时：

- `next.config.ts` 无 dotenv import/load；
- Next production build 使用隔离 distDir；
- build 使用虚构 environment；
- log level silent；
- Manifest 不包含环境值；
- 未读取根 `.env`。

状态：

```text
Secret Isolation: VERIFIED IN ISOLATED WEB BUILD
```

剩余风险：

- Next.js 自动 `.env` 机制依赖目录布局；
- 外部 build script/CI 仍可能注入 secret；
- 生产日志/CI log 未审计。

## 10. Trust Root 与密钥生命周期

### 信任根

生产建议：

```text
Trusted Public Key Registry
  + keyId
  + public key fingerprint
  + validity window
  + revocation status
```

Trust Root 由部署系统只读注入，不来自 Manifest，不由构建产物生成。

### 私钥管理比较

| 方案 | 安全性 | 复杂度 | 推荐 |
|---|---:|---:|---|
| CI secret file | 中 | 低 | 临时过渡 |
| KMS asymmetric signing | 高 | 中 | 推荐 |
| HSM signing | 最高 | 高 | 高保障阶段 |
| 独立 Release Signing Service | 高 | 高 | 多产品阶段 |

推荐当前项目：

```text
受控 CI + KMS/HSM-backed Ed25519 signing
```

私钥不进入 build checkout；构建产物只接收签名。

### 轮换

1. 生成新 key pair；
2. 公钥加入 Trust Root；
3. 新 Release 使用新 key；
4. 旧 Release 在兼容窗口仍可验证；
5. 旧 keyId 撤销；
6. 记录撤销时间和受影响 Release。

### 私钥泄露

1. 停止发布；
2. 撤销 keyId；
3. 标记受影响 Release 不可信；
4. 重新签名安全 Release；
5. 更新 Trust Root；
6. 重启 Web/Worker Gate；
7. 记录审计证据。

当前：

```text
Production Signing Key: NOT CONFIGURED
Production Trust Root: NOT CONFIGURED
Production Key Rotation: DESIGNED / NOT IMPLEMENTED
```

## 11. 供应链审计

### 已确认

```text
Node = v24.22.1
pnpm = 11.25.0
lockfileVersion = 9.0
save-exact = true
strict-peer-dependencies = true
auto-install-peers = false
workspace = apps/*, packages/*
```

允许安装脚本的包：

```text
@prisma/client
@prisma/engines
esbuild
prisma
```

项目自身 package 未发现 preinstall/install/postinstall/prepare。

### 风险

```text
verifyDepsBeforeRun = false
```

该设置削弱普通 pnpm 脚本运行前的依赖校验。L4 构建/Gate 通过 Runtime Dependency Digest 弥补安全发布路径，但其他开发命令仍需人工关注。

### Native/Platform

Runtime Closure 显式记录：

- Next SWC；
- Prisma engines；
- sharp；
- rollup native binaries；
- lightningcss；
- canvas native。

平台或 Native Addon 变化会改变 Runtime Digest。

### Dynamic Dependencies

- 声明在 dependencies/optional/peer 的包递归覆盖；
- 未声明、运行时按字符串任意导入的包不能被静态依赖图证明；
- 此类动态依赖必须视为新增设计审查项。

### Prisma Client

当前环境恢复使用本地已生成 Prisma Client 缓存。CI/生产必须显式保证 `prisma generate` 或等价生成步骤，且不得读取真实 env 才能构建。该流程仍为：

```text
Prisma Client Provisioning: PARTIAL
```

## 12. 自动化测试

### Web

```text
19 test files / 110 tests PASS
```

### L4 Security

```text
20/20 PASS
```

覆盖：

- Source/Artifact Digest；
- Runtime Dependency Closure；
- 依赖文件修改/新增/缺失；
- trusted/disallowed symlink；
- Junction root；
- Manifest/signature；
- dependency/artifact tampering；
- Web/Worker Gate；
- Startup config missing；
- TOCTOU recheck；
- instrumentation Node-only；
- build/start wrapper；
- secret config isolation。

### Worker

```text
5 test files / 16 tests PASS
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

### Build

```text
Web isolated production build: PASS
Worker isolated build: PASS
```

## 13. 第二轮攻击性自审

| 检查 | 结果 |
|---|---|
| Web runtime deps 遗漏 | Closure 189 packages，验证通过 |
| Worker runtime deps 遗漏 | Closure 93 packages，验证通过 |
| 动态依赖遗漏 | 未声明动态包仍 UNKNOWN |
| Native Addons | 显式摘要并列出 |
| 运行时配置 | env/config 未进入 Manifest |
| Next server chunks | Artifact Digest 覆盖 |
| Next standalone deps | 使用完整 runtime closure 补偿 |
| Worker external deps | Runtime Closure 覆盖 |
| lockfile/安装不一致 | Closure 检测实际安装结果 |
| build cache 污染 | 隔离 dist/tsconfig；build 目录不存在才启动 |
| install scripts | allowBuilds 显式；项目自身无 lifecycle |
| Artifact漏洞 | 文件集合、链接目标和 runtime closure 组合 |
| Manifest脱离Artifact | digest 重算 |
| Trust Root替换 | 外部公共 key registry；生产未配置 |
| 私钥泄露 | 测试密钥临时；production key absent |
| 密钥轮换 | 设计完成，未实施 |
| Web Gate绕过 | wrapper+instrumentation；direct start部署侧待禁 |
| Worker Gate绕过 | bootstrap dynamic import |
| 静态 import | 检查通过 |
| 自动重启绕过 | Worker入口每次重启执行Gate |
| 构建失败回退 | secure build fail closed |
| TOCTOU | 代码/隔离部分验证；OS未验证 |
| Junction/Reparse | Junction 拒绝；生产全量未验证 |
| 父目录 ACL | NOT VERIFIED |
| Secret probe | 0 occurrence |
| 旧构建误用 | 历史哈希未变；direct start仍需部署控制 |
| L fail-closed | 未改变 |
| cleanup 重新开放 | 未改变，仍 DISABLED |

## 14. 未解决风险

1. Production Signing Key 未配置；
2. Production Trust Root/Rotation 未配置；
3. Production Release Root 只读 ACL 未验证；
4. Windows 独立运行身份/ACL 未验证；
5. 父目录/Junction 全路径 TOCTOU 未生产验证；
6. 外部 direct `next start` 未在部署层禁止；
7. 生产 Service/Scheduler/CI 未接入新 build/start；
8. 未声明动态依赖无法从 package graph 证明；
9. Prisma Client 生成在 clean install 中的可复现流程仍 PARTIAL；
10. `verifyDepsBeforeRun=false` 的非发布路径风险；
11. Production Artifact Status UNKNOWN；
12. 旧危险 `.next`/Worker dist 仍存在且 NOT REMOVED；
13. Web/Worker 未真实启动或部署；
14. 完整 production log/CI secret 扫描未执行。

## 15. 门禁

```text
C-6.2-L4:
PASS WITH WARNINGS

Runtime Dependency Closure:
IMPLEMENTED / VERIFIED

Web Production Build:
VERIFIED IN ISOLATION

Web Startup Gate:
VERIFIED IN ISOLATION

Worker Runtime Dependency:
VERIFIED IN ISOLATION

Worker Startup Gate:
VERIFIED IN ISOLATION

Artifact Digest:
IMPLEMENTED / VERIFIED IN ISOLATION

TOCTOU:
CODE-LEVEL VERIFIED / OS PARTIAL

Secret Isolation:
VERIFIED IN ISOLATED WEB BUILD

Trust Root Design:
COMPLETE / PRODUCTION NOT CONFIGURED

Production Signing Key:
NOT CONFIGURED

Production Trust Root:
NOT CONFIGURED

Production Release Root:
NOT VERIFIED

Legacy Artifact Removal:
NOT EXECUTED

Production Deployment:
NOT EXECUTED

Production Artifact Status:
UNKNOWN

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```
