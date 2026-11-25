# P1-3 C-6.2-L4 Build Integrity 独立审计与 Web 构建验收报告

## 文档信息

- 阶段：`C-6.2-L4`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH WARNINGS`

## 1. 最终状态

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

## 2. Git 基线

```text
Branch:
feature/p1-3-storage-lifecycle-schema

HEAD:
b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
```

工作树保留此前全部未提交文件以及 L4 新增/修改内容。未执行 Git 写操作。

## 3. 修改文件清单

### Build Integrity

```text
packages/build-integrity/package.json
packages/build-integrity/src/index.mjs
packages/build-integrity/src/index.d.ts
```

### Web

```text
apps/web/next.config.ts
apps/web/scripts/build-secure.ts
apps/web/scripts/start-secure.mjs
apps/web/src/instrumentation.ts
apps/web/src/server/security/startup-gate.ts
apps/web/tests/p13-release-security.test.ts
```

### Worker

```text
apps/worker/package.json
apps/worker/scripts/build-secure.ts
apps/worker/src/config.ts
apps/worker/src/index.ts
apps/worker/src/security/startup-gate.ts
apps/worker/src/worker-entry.ts
apps/worker/tests/legacy-cleanup-shutdown.test.ts
apps/worker/tsconfig.json
```

### Workspace 与文档

```text
apps/web/package.json
pnpm-lock.yaml
docs/architecture/file-lifecycle-p13-c6-2-l4-design.md
docs/architecture/file-lifecycle-p13-c6-2-l4-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改：

- Prisma Schema / Migration；
- 历史 `.next` / Worker `dist`；
- 数据库、Storage、ACL、角色；
- 部署/CI/CD/Service/Scheduler；
- Git 历史。

## 4. Runtime Dependency Closure

### 算法

从 application root 开始解析：

```text
dependencies
optionalDependencies
peerDependencies
workspace packages
transitive dependencies
```

每个包摘要内容：

```text
name
version
requestedVersion
file digest
file count
bytes
native addon
```

Closure 身份还包括：

```text
Node version
platform
arch
missing optional/peer dependencies
```

### Web

```text
packages = 189
files = 20,376
bytes = 669,923,536
closure digest =
0cd67bf0d1b34809383831d7d50efef9f627a626bdf34daf5b7fe2f98eb76220
missing optional/peer = 124
```

Native packages：

```text
@img/sharp-win32-x64@0.35.5
@next/swc-win32-x64-msvc@16.4.6
@prisma/engines@6.19.0
@rollup/rollup-win32-x64-gnu@4.68.3
@rollup/rollup-win32-x64-msvc@4.68.3
lightningcss-win32-x64-msvc@1.33.0
prisma@6.19.0
```

Web Manifest：

```text
runtimeDependencyCount = 189
runtimeDependencyDigest =
0cd67bf0d1b34809383831d7d50efef9f627a626bdf34daf5b7fe2f98eb76220
```

### Worker

```text
packages = 93
files = 7,702
bytes = 341,755,987
closure digest =
0accdd025b738595a3fbf8cf44d4c53b1aa0945abaaf4c054230f8f91ef07f3f
missing optional/peer = 12
```

Native packages：

```text
@napi-rs/canvas-win32-x64-msvc@1.1.1
@prisma/engines@6.19.0
prisma@6.19.0
```

Worker Manifest：

```text
runtimeDependencyCount = 93
runtimeDependencyDigest =
0accdd025b738595a3fbf8cf44d4c53b1aa0945abaaf4c054230f8f91ef07f3f
```

### 性能

```text
Worker closure ≈ 6.0 seconds
Web closure ≈ 13.6 seconds
```

每次 Gate 都重新计算实际已安装依赖闭包。没有因性能而降低覆盖。

### 动态依赖边界

声明依赖及其传递关系已覆盖。未声明、运行时任意字符串导入的包无法通过 package graph 证明，保持剩余风险。

## 5. Artifact Digest 加固

### 受控 Symlink

默认拒绝 symlink/Junction。

仅允许 realpath 位于：

```text
Release Root
Runtime Root
Runtime Root/node_modules
Workspace/node_modules
Workspace/packages
```

链接目标内容纳入 Artifact Digest；目标变化会改变摘要。

不允许链接到 workspace 源码根、系统目录或任意外部路径。

已测试：

- 非允许 symlink 拒绝；
- 允许依赖 Junction 通过；
- 修改链接目标内容导致 Artifact Digest 变化；
- 根目录为 Junction 拒绝；
- cycle/特殊文件拒绝策略。

## 6. Signed Manifest

Manifest 现在同时绑定：

```text
Source Tree Digest
Dependency Lock Digest
Runtime Dependency Digest
Runtime Dependency Count
Runtime Platform
Artifact Digest
Lifecycle Safety Version
cleanupCapability = DISABLED
```

Build ID 包含 Runtime Dependency Digest。

签名验证仍使用外部 Trust Root 和 Ed25519。

依赖字段缺失、格式错误、数量不一致或 Digest 不匹配均 fail closed。

## 7. Web Production Build

### 隔离措施

- 输出到唯一 `.p13-releases/<releaseId>`；
- 目标必须预先不存在；
- 不复用历史 `.next`；
- Next distDir 由 `P13_NEXT_DIST_DIR` 强制隔离；
- 使用临时 `.p13-build/<releaseId>/tsconfig.json`；
- `incremental=false`；
- 不覆盖历史 tsbuildinfo；
- 构建后恢复 `next-env.d.ts` 原字节；
- 使用虚构数据库 URL/Auth Secret/Storage Root；
- 使用一次性 Ed25519 测试私钥；
- 唯一测试秘密探针。

### 结果

```text
Build ID =
0adb204efeeceeb6b13401a353a03ced

Release ID =
l4-web-37eb5f4bcb02

artifactFiles = 1031
artifactBytes = 190,175,594

artifactDigest =
983c9db7c68ed596e3cd1943e36f8776729052ae956931b3a438098c581a0da8

runtimePackages = 189
runtimeDependencyDigest =
0cd67bf0d1b34809383831d7d50efef9f627a626bdf34daf5b7fe2f98eb76220

legacyFindings = 0
signedManifest = PASS
startupGate = PASS
secretProbeFound = false
```

### 历史产物保护

```text
apps/web/.next/BUILD_ID = unchanged
apps/worker/dist/file-maintenance.js = unchanged
apps/web/tsconfig.tsbuildinfo = unchanged
apps/web/next-env.d.ts = unchanged
```

构建首次曾由 Next 改写 `next-env.d.ts`；已通过精确离线哈希枚举恢复原内容，并在 build wrapper 中实施保存/恢复机制，最终 hash 恢复为：

```text
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC
```

## 8. Worker Isolated Build

```text
Build ID =
969e9faa8974395f210552e5bef848bf

Release ID =
l4-worker-708d6f80ea76

artifactFiles = 36
artifactBytes = 131,855

artifactDigest =
b251ad29dec99c963acb8a445be1c7c5176af95fd17938c511424c97dd5f2f86

runtimePackages = 93
runtimeDependencyDigest =
0accdd025b738595a3fbf8cf44d4c53b1aa0945abaaf4c054230f8f91ef07f3f

legacyFindings = 0
signedManifest = PASS
startupGate = PASS
```

临时 release 与私钥在验证后删除；旧 Worker `dist` 未修改。

## 9. Startup Gate 审计

### Web

仓库支持 entry：

```text
package start -> scripts/start-secure.mjs
```

执行：

```text
Manifest / signature / trust key
Application / Git / Release
Lifecycle Safety
Cleanup Capability
Artifact Digest
Runtime Dependency Digest
Legacy scan
```

Next instrumentation：

- 仅在 `NEXT_RUNTIME=nodejs` 且 production；
- dynamic import Gate；
- Edge bundle 不再引入 Node crypto/fs；
- Web build 警告从 12 条降至 0 条。

外部直接 `next start` 仍可能绕过 package wrapper。新构建有 instrumentation，但旧 `.next` 没有。部署侧必须禁止 direct start。

### Worker

```text
index.ts
  -> Gate
  -> dynamic import worker-entry.js
```

静态业务模块不会在 Gate 前加载。失败时不会：

- 加载 Prisma；
- 初始化 pg-boss；
- 初始化 Storage；
- 连接数据库；
- 启动 Scheduler；
- 执行 Cleanup。

## 10. Runtime Dependency 攻击测试

已验证：

- 依赖文件修改 -> Digest mismatch；
- 依赖文件删除 -> Digest mismatch；
- 新增文件 -> Digest mismatch；
- optional/peer 缺失记录稳定；
- native addon 被识别；
- Web/Worker 依赖闭包不同；
- lockfile 变化字段进入 Manifest；
- closure digest 改变 Build ID。

## 11. TOCTOU

### Code-Level

```text
VERIFIED
```

覆盖：

- Manifest / Trust root regular file；
- Artifact root Junction；
- nested symlink/Junction；
- trusted target 范围；
- artifact replacement；
- runtime dependency replacement/deletion；
- 连续 Gate 检查之间 Artifact 变化拒绝；
- 文件读取期间 size/mtimeNs 变化拒绝。

### Isolated Filesystem

```text
PARTIALLY VERIFIED
```

已验证 Windows Junction 拒绝和目标内容绑定。

未验证：

- 父目录原子替换；
- 独立低权限运行身份；
- ACL 拒绝写入；
- 文件句柄执行绑定。

### Production

```text
Production Release Root Immutability:
NOT VERIFIED
```

没有修改真实服务器 ACL、运行身份或部署目录。

## 12. Secret Isolation

Web build 使用唯一虚构探针。扫描全部 Release 文件，包括：

- Client chunks；
- Server chunks；
- Source maps；
- Manifest；
- 其他静态文件。

结果：

```text
ProbeFound = false
```

同时确认：

- `next.config.ts` 无 dotenv import/load；
- Build 使用虚构非秘密 env；
- Manifest 不含 env 值；
- 日志未输出测试 secret；
- `next-env.d.ts` 构建后恢复。

状态：

```text
Secret Isolation:
VERIFIED IN ISOLATED WEB BUILD
```

仍不能证明外部 CI/部署脚本不会注入 secret。

## 13. Trust Root 与密钥生命周期设计

推荐生产：

```text
Ed25519 keys in KMS/HSM-backed signing
  -> signed Manifest
  -> Trusted Public Key Registry
  -> read-only runtime trust root
```

轮换：

1. 新 key pair；
2. 公钥加入 Trust Registry；
3. 新 Release 使用新 key；
4. 兼容窗口保留旧 key；
5. 撤销旧 keyId；
6. 记录受影响 Release。

泄露处置：

1. 停止发布；
2. 撤销 keyId；
3. 标记相关 Release 不可信；
4. 重新签名；
5. 更新 Trust Root；
6. 重启 Gate；
7. 保留审计证据。

当前：

```text
Production Signing Key: NOT CONFIGURED
Production Trust Root: NOT CONFIGURED
Production Key Rotation: DESIGNED / NOT IMPLEMENTED
```

## 14. 供应链审计

```text
Node = v24.22.1
pnpm = 11.25.0
lockfileVersion = 9.0
save-exact = true
strict-peer-dependencies = true
auto-install-peers = false
```

允许 build scripts 的包：

```text
@prisma/client
@prisma/engines
esbuild
prisma
```

项目自身未发现 preinstall/install/postinstall/prepare。

风险：

```text
verifyDepsBeforeRun = false
```

发布构建/Gate 使用 Runtime Dependency Closure 进行独立校验，但其他普通开发命令仍缺少 pnpm 自动依赖一致性检查。

Prisma Client 当前依赖本地已生成 `.prisma` 内容。CI/生产必须显式保证生成步骤且不得读取真实 env：

```text
Prisma Client Provisioning: PARTIAL
```

## 15. 自动化测试结果

```text
Web:
19 test files / 110 tests PASS

Worker:
5 test files / 16 tests PASS

file-storage:
15 tests PASS

Web TypeScript:
PASS（--incremental false）

Worker TypeScript:
PASS（--incremental false）

Web production build:
PASS（isolated）

Worker build:
PASS（isolated）
```

L4 security suite：

```text
20/20 PASS
```

覆盖 canonical JSON、Source/Artifact Digest、Runtime Closure、symlink/Junction、签名、篡改、依赖变化、Gate、TOCTOU recheck、Node-only instrumentation、构建配置和 secret 隔离。

## 16. 第二轮独立攻击性自审

| 检查 | 结果 |
|---|---|
| Web runtime deps 遗漏 | Closure 189 packages，PASS |
| Worker runtime deps 遗漏 | Closure 93 packages，PASS |
| 动态依赖 | 声明依赖覆盖；未声明动态包 UNKNOWN |
| Native Addons | 已摘要并列出 |
| 运行时配置文件 | Runtime closure 覆盖，Manifest 不含值 |
| Next server chunks | Artifact Digest 覆盖 |
| Next standalone deps | 完整 closure 补偿 |
| Worker external deps | Closure 覆盖 |
| Lockfile/安装不一致 | Closure 使用实际安装结果 |
| 构建缓存污染 | 隔离 dist/tsconfig，未覆盖历史缓存 |
| Install scripts | allowBuilds 白名单；项目无 lifecycle |
| Artifact Digest 漏洞 | root + trusted links + runtime closure |
| Manifest/Artifact 脱离 | 重算 Artifact/Runtime Digests |
| Trust Root 替换 | 外部路径；生产未配置 |
| 私钥泄露 | 一次性测试 key，验证后删除 |
| 密钥轮换 | 设计完成，未实施 |
| Web Gate 绕过 | wrapper + Node instrumentation；direct start 待部署禁止 |
| Worker Gate 绕过 | minimal bootstrap dynamic import |
| Static import 提前加载 | 静态检查 PASS |
| 自动重启绕过 | Worker 重启必须重新走 index Gate |
| 构建失败回退 | secure script 失败退出，旧产物 hash unchanged |
| TOCTOU | Code-level verified；OS partial |
| Junction/Reparse | Junction tests PASS；全路径 ACL UNKNOWN |
| 父目录权限 | NOT VERIFIED |
| Build secret | ProbeFound=false |
| 旧构建误用 | 历史 hash unchanged；direct start部署风险 |
| L fail-closed | 未改变 |
| 物理删除重新开放 | 未改变，cleanup capability DISABLED |

## 17. 未解决风险

1. 生产签名私钥未配置；
2. 生产 Trust Root / Key Rotation 未配置；
3. 生产 Release Root 只读 ACL 未验证；
4. Windows 独立运行身份 ACL 未验证；
5. 父目录/Reparse Point 原子 TOCTOU 未生产验证；
6. 外部 direct `next start` 未在部署层禁止；
7. Production Service/Scheduler/CI 未接入新 build/start；
8. 未声明动态依赖无法由 package graph 完全证明；
9. Prisma Client clean-install 生成流程 PARTIAL；
10. `verifyDepsBeforeRun=false` 的非发布路径风险；
11. Production Artifact Status UNKNOWN；
12. 旧 `.next` / Worker dist 仍存在，NOT REMOVED；
13. Web/Worker 真实部署启动未执行；
14. 完整生产 CI/log secret scan 未执行。

## 18. 历史旧产物保护

```text
apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC
```

四个文件哈希最终均保持不变。

## 19. 未执行操作

```text
No production signing key
No production trust root
No production ACL/service identity
No deployment
No real Web/Worker start
No PostgreSQL connection
No SQL
No Migration
No real Storage access/delete
No real Cleanup
No historical artifact delete/move/rename/overwrite
No Git write
```

## 20. 文件 SHA-256

### Build Integrity

```text
packages/build-integrity/package.json
05F71D009863D20503A34BC29D53DF5493AAFAC614EFABA98E93AB254523B8AC

packages/build-integrity/src/index.mjs
6E5AF2D3261E6C03AA231CC67A122E7156EEDFB0FE89F554624CEF0C792F7875

packages/build-integrity/src/index.d.ts
4460ABAEC100C7FA35C936CC69FD2292C95107C58B765E70A532DC54BA1E644E
```

### Web

```text
apps/web/src/instrumentation.ts
034681C379E473CD7438E490BDD6B43124CC4AECB2E59A9FEBD2F95E20B3FCE3

apps/web/src/server/security/startup-gate.ts
0AE7E4D02D1CCF172C935B48663CF2F5A9A4BE3F286410344B865743A6156A86

apps/web/scripts/build-secure.ts
4E68CF54C91E0CE6089409FF92C487E574F395FDB6A763B77040EAE55B683051

apps/web/scripts/start-secure.mjs
F7E60F47C9462C6C438AFF102E6155941E0B9949D9D14DC202C4B4C836CA17DF

apps/web/next.config.ts
FD22E031B5C92AF888F4D5C973AECC70A2B307A99A8436B923BB4D3FEFCC6AE3

apps/web/package.json
07E63F244E650AED2D3B273EE16D904DCE7FD92EFA93B5F3C1A4E389C922B176

apps/web/tests/p13-release-security.test.ts
4F4385166FCCCFA48167D712E2355E0C00C9B8A679874585DA2ADB0519985026
```

### Worker

```text
apps/worker/src/index.ts
C01A2F6848B29D66C798F7F534C729FA9AB65788FEAB4CD5E892AD58BBC8F48D

apps/worker/src/worker-entry.ts
9C7979588A6B723252AE63B64EFE0C49DFA3ABEF01937544DFC4FD973D9021FA

apps/worker/src/security/startup-gate.ts
98C4B6CE8BC0FFA30DF871D6D55D5EA036B8CF8FEE7B9F2BB5E695B0C4BADF98

apps/worker/src/config.ts
AFEDCE09C4C1347ABF3D0E603D1F98A766987056C092A4B96FA520F914773432

apps/worker/scripts/build-secure.ts
C05430FC86DFCEFE81F72357DE25011939F8161F6C5611B172E33B770C561D82

apps/worker/package.json
30AAF4EDD3D9BA2BF9CCE1D74A65FB13649352ABE9C5C78D7A1CCFEB39D8A0AD

apps/worker/tests/legacy-cleanup-shutdown.test.ts
CA485D9CF5738C55756801D54BA510511FEAA1EA8A59AB7C2F4B88138C302F47

apps/worker/tsconfig.json
28B612646DEEDD70A2FB9121FA199E2EEED84BF388D66FA712053A2B3DB2F375

pnpm-lock.yaml
E8961A034B82150223E4E16778F930C841C8B8B917EE94F36501B9BA2D794FD7
```

### 文档

```text
L4 设计
C0F6D68A61393653AADBEFF506A506390F870E55A7F388A17844E277766D0BA4

数据库行为测试计划
193C0543A889E4C81FEC863DC2F2B8F61288B46BA34E539C24B9121653229EA2

实现状态
3D2BC7F83519743A362EDA2DB7177F4DFB1874423BB8380BB16DADD9189BE845
```

L4 报告自身 SHA-256 在最终交付消息外部提供，避免自引用。

## 21. 下一阶段条件

1. 配置 KMS/HSM-backed production signing；
2. 部署只读 Trust Root；
3. 配置 Release Root 只读 ACL 和独立运行身份；
4. 禁止 direct Next/start 和旧 dist 入口；
5. 建立可复现 Prisma Client generation 流程；
6. 为不可信/未声明动态依赖建立审查门禁；
7. 在隔离发布环境验证 Service restart/rollback Gate；
8. 完成生产 Artifact Inventory；
9. 排空旧 Worker/旧构建；
10. 最后清理历史危险产物。

## 最终门禁

```text
C-6.2-L4:
PASS WITH WARNINGS

Runtime Dependency Closure:
VERIFIED

Web Production Build:
VERIFIED IN ISOLATION

Web Startup Gate:
VERIFIED IN ISOLATION

Worker Runtime Dependency:
VERIFIED IN ISOLATION

Worker Startup Gate:
VERIFIED IN ISOLATION

Artifact Digest:
VERIFIED IN ISOLATION

TOCTOU:
PARTIAL

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
