# P1-3 C-6.2-L2 Legacy Build Artifact 隔离与启动安全审计报告

## 文档信息

- 阶段：`C-6.2-L2`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`BLOCKED`

## 1. 最终结论

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

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

原因：

- 旧 Web `.next` 可由 `next start` 直接加载；
- 旧 Worker `dist` 可由 `node dist/index.js` 直接加载；
- 两者仍含 Legacy 物理删除 marker；
- 无 Manifest、artifact digest、签名或启动门禁；
- 无法证明生产构建状态。

## 2. 检查范围

- Git Branch/HEAD/worktree；
- K、L、L1、L2 文档；
- root/Web/Worker package scripts；
- Web `next.config.ts` 和 Worker tsconfig；
- Web `.next`；
- Worker `dist`；
- package `dist`；
- TS build cache 和 test-results；
- deployment archives/executables；
- 启动命令和构建入口；
- 旧删除 marker；
- 运行版本标识；
- 现有测试和构建工具边界。

未读取 `.env`、`.env.test` 或真实 secret。未连接数据库。

## 3. 构建产物清单

扫描器发现 8 个 artifact roots：

| Artifact ID | Path | Type | Startup Reachable | Legacy Delete | Recommendation |
|---|---|---|---|---|---|
| ART-001 | `apps/web/.next` | Web server bundle | YES | YES | QUARANTINE / REBUILD |
| ART-002 | `apps/web/test-results` | Test artifact | NO | NO | KEEP |
| ART-003 | `apps/web/tsconfig.tsbuildinfo` | TS cache | NO | NO | KEEP / DISCLOSE REFRESH |
| ART-004 | `apps/worker/dist` | Worker bundle | YES | YES | QUARANTINE / REBUILD |
| ART-005 | `packages/contracts/dist` | Package bundle | YES dependency | NO | KEEP |
| ART-006 | `packages/file-storage/dist` | Package bundle | YES dependency | NO | KEEP / verify |
| ART-007 | `packages/selection-engine/dist` | Package bundle | YES dependency | NO | KEEP |
| ART-008 | `packages/shared-ui/dist` | Package bundle | YES dependency | NO | KEEP |

未发现压缩包、安装包、`.turbo`、`.vercel` 或 coverage。

### 3.1 Cache Side Effect

运行 Web `typecheck` 时，`incremental: true` 刷新了：

```text
apps/web/tsconfig.tsbuildinfo
Length = 394709
LastWriteTime = 2026-11-18 01:50:18
SHA256 = 018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777
```

这是非运行时 TypeScript cache，不是 `.next` 或 Worker `dist`。但本阶段要求不覆盖现有构建产物，因此这是一次已披露的流程非一致性。未删除、伪造恢复或进一步修改该文件。

## 4. 旧删除代码证据

只读扫描结果：

```text
artifactRootCount = 8
dangerousFindingCount = 49
affectedFiles = 23
exitCode = 1
```

入口级危险文件：

```text
apps/web/.next/server/chunks/[root-of-the-server]__0e5-f2rdyijtd._.js
apps/web/.next/server/chunks/[root-of-the-server]__0e5-f2rdyijtd._.js.map
apps/web/.next/server/chunks/[root-of-the-server]__0jh743w8n5ftu._.js.map
apps/worker/dist/file-maintenance.js
```

### Web

旧 production server chunk 包含：

- 旧 Upload complete cleanup；
- 旧 Storage Adapter 删除实现；
- `.removeStaging` / `.removeObject` 调用；
- source map 中的旧源码。

Build ID：

```text
LULjk7Rp3QcYPDlFEyycy
```

没有 Git SHA 映射。

### Worker

`apps/worker/dist/file-maintenance.js` 包含：

```text
line 220: .removeStaging
line 225: .removeObject
line 271: .cleanupOrphanObjects
line 272: .cleanupTemp
```

当前 `packages/file-storage/dist` 已 fail-closed，因此旧 Worker dist 在当前 workspace 中调用删除会失败。但旧 Worker dist 若与旧 package snapshot 一起运行，风险恢复。

## 5. 启动链映射

| 启动命令 | 使用的产物 | 版本证据 | 风险 |
|---|---|---|---|
| `pnpm dev:web` | Next dev cache | source only | MEDIUM |
| Web `start` / `next start` | `apps/web/.next` | Build ID，无 SHA | HIGH |
| `pnpm dev:worker` | source via `tsx watch` | source only | LOW/MEDIUM |
| Worker `start` / `node dist/index.js` | `apps/worker/dist` | VERSION UNKNOWN | HIGH |
| root `pnpm build` | current dirs | dirty worktree | NOT EXECUTED |
| Worker build | `apps/worker/dist` | dirty worktree | NOT EXECUTED |
| E2E Worker | source via `tsx` | test worktree | TEST ONLY |
| test-db reset | guarded test root | test script | TEST ONLY |

关键问题：

- `next start` 不重新编译源码；
- Worker `start` 不重新编译源码；
- 没有 Manifest/Gate；
- 没有 build failure no-fallback；
- 没有证明 Web/Worker 同步更新；
- 生产启动配置 UNKNOWN。

## 6. 版本识别结论

当前没有：

- 统一 Build Manifest；
- Git SHA 的 runtime 上报；
- Web/Worker Image Digest；
- Source Tree Digest；
- Artifact Digest；
- Release ID；
- lifecycleSafetyVersion；
- cleanupCapability 的机器可验证声明；
- Manifest 签名/attestation。

Web `.next/BUILD_ID` 只标识一次本地构建，不能对应源码 SHA。Worker `dist` 完全没有 Build ID。

```text
Git HEAD != Runtime Artifact Identity
```

## 7. 构建配置风险

`apps/web/next.config.ts` 在模块加载时执行：

```text
loadEnv({ path: workspaceRoot/.env })
```

这会在 build 阶段读取真实 `.env`，违反“构建过程不读取 secret”的目标。当前没有修改该配置。

其他缺口：

- Web/Worker 都使用默认输出目录；
- 没有 manifest 生成；
- 没有 artifact digest；
- 没有只读 release directory；
- 没有 launch wrapper。

## 8. 已实现审计工具

新增：

```text
apps/web/scripts/p13-build-audit/scanner.ts
apps/web/scripts/p13-build-audit/cli.ts
apps/web/tests/p13-build-audit.test.ts
```

### Scanner 能力

- 发现 8 类 artifact root；
- 发现 cache、test artifact、archive；
- 扫描已知 Legacy delete marker；
- 跳过 symlink；
- 最大读取单文件 20 MiB；
- 输出 JSON；
- 有危险 finding 时退出 1；
- 不执行/import/require artifact。

### Manifest Validator

实现纯函数：

```text
validateBuildManifest(input, expected)
```

验证 application、buildId、Git SHA、source/artifact digest、timestamp、lifecycle safety、cleanupCapability。

### 测试结果

```text
4/4 PASS
```

覆盖：

- Worker 危险调用识别；
- safe fail-closed error 不误报；
- Web/Package/cache/test/archive 分类；
- 合法 Manifest；
- 缺失、过旧、不匹配和不安全 Manifest。

## 9. Manifest 设计

推荐字段：

```text
manifestVersion
application
buildId
releaseId
gitSha
gitDirty
sourceTreeDigest
dependencyLockDigest
artifactDigest
artifactDigestAlgorithm
buildTimestamp
lifecycleSafetyVersion
cleanupCapability
artifactRoots
manifestSignature
manifestSignatureKeyId
```

必须使用：

```text
Git SHA
+ clean worktree digest
+ artifact digest
+ Build ID
+ Release ID
+ lifecycleSafetyVersion
+ cleanupCapability=DISABLED
+ signed attestation
```

没有签名时，Manifest 与 artifact 可被同时修改并重新计算摘要，不能宣称不可伪造。

## 10. Startup Gate

设计为：

```text
launcher
  -> verify signed manifest
  -> verify app/build/git/lifecycle fields
  -> recompute artifact digest
  -> verify cleanupCapability=DISABLED
  -> verify Web/Worker compatibility
  -> dynamically load verified entry
```

必须 fail closed：

- Manifest 缺失/非法；
- Build ID/Git SHA 缺失；
- digest 不匹配；
- safety version 过旧；
- cleanup capability 不是 DISABLED；
- 签名/attestation 无效；
- artifact 含危险 marker；
- 校验后文件被替换；
- 版本不兼容。

不得 fallback 到旧 `.next`/`dist`。Worker 自动重启也必须经过 launcher。

当前只设计，`Startup Gate = NOT IMPLEMENTED`。

## 11. 旧产物隔离方案

后续独立授权顺序：

1. scanner 记录；
2. 冻结旧启动入口；
3. 隔离旧 `.next`/`dist`；
4. 构建到唯一隔离 release directory；
5. 生成 Manifest/摘要/签名；
6. scanner 零 finding；
7. 独立环境验证 gate；
8. 部署并排空旧 Worker；
9. 最后授权清理旧产物。

本阶段没有执行任何步骤，所有旧产物保持原位。

## 12. 独立自审

| 问题 | 结果 |
|---|---|
| 是否遗漏构建目录 | 常见目录已扫描；非标准目录仍可能遗漏 |
| 是否遗漏 Web bundle | 已识别 `.next` |
| 是否遗漏 Worker bundle | 已识别 `dist` |
| 是否遗漏 Docker image | 本机无 Docker；外部 UNKNOWN |
| 是否遗漏压缩包 | 本地未发现 |
| 是否遗漏 dev 入口 | 已映射 Web/Worker dev scripts |
| 是否遗漏 fallback | 无显式 fallback，外部 unknown |
| Manifest 是否可脱离产物 | 可行；需签名和完整 digest |
| Digest 范围是否完整 | 尚未实施 |
| 文件是否可能替换 | TOCTOU 存在 |
| 手工修改 Manifest | 无签名时可能 |
| Git SHA 对但 dirty | 需 gitDirty + sourceTreeDigest |
| Web/Worker 版本差异 | 当前无 releaseId |
| 自动重启绕过 | 当前无 gate |
| 旧镜像 | UNKNOWN |
| 回滚旧版 | 当前无 gate，风险存在 |
| CI 失败继续发布 | 无 CI 配置证据 |
| secret 泄露 | `next.config.ts` 会读取 `.env` |
| 本地状态等同生产 | 否；Production UNKNOWN |
| Gate 影响正常业务 | 未实施，无法验证 |

## 13. 未解决风险

### Critical / High

1. `apps/web/.next` 含旧删除代码且可由 `next start` 加载；
2. `apps/worker/dist` 含旧删除调用且可由 `node dist/index.js` 加载；
3. 无 Manifest/Artifact Digest；
4. 无签名/attestation；
5. 无 Startup Gate；
6. 无运行时版本身份；
7. 生产构建制品 UNKNOWN；
8. 旧产物隔离/清理 NOT EXECUTED。

本阶段已提供可执行扫描器和完整设计，但不能宣称实际启动链安全。

## 14. 文件 SHA-256

### 审计工具与测试

```text
scanner.ts
187BFEAF80E7AA5EAFF4C201D65062CBFADAAF7703A0EC0BFA75A7E6E45F85BE

cli.ts
EF45626F8E6BDF4F68395C4804E84C5FA98154B843C0AFDF5CBB5886A62AE392

p13-build-audit.test.ts
2C9AC1D182B50E9CF56F4A780A0A61C65A03ADB0D84C1403B2AF13D391E65DD6
```

### 文档

```text
L2 设计
3A16A8A669CD88E506D7CDDC8CEF507AE651399007CF5107EBF3A01924E58CF1

数据库行为测试计划
A0936661B11743960EF69E3A105EFA06C136CF37B2C0303CB1E35A4D138BF774

实现状态
F7AD8587A54A10E3861DFEE85564C4962AE5973C2AB3CD9E0976B6D2F6FF5E32
```

L2 报告自身哈希在最终消息外部计算。

### 旧产物

```text
apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/worker/dist/index.js
D7DF17BC2CF23A7923527648A98FC5AABB8FD36A21D6A0B24EA92F8C1DE5BBB9

apps/web/.next/server/chunks/[root-of-the-server]__0e5-f2rdyijtd._.js
486056923EF04D9BD0D0B33C93F6A2EFFBF0DF9F25110DF35F491FD6C885C10D

apps/web/.next/server/chunks/[root-of-the-server]__0jh743w8n5ftu._.js
6D7ACDA4F2CC6436D67DB0AB6BB44DD820E267CBB7117AFF618C9A257FD2F74C

apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1
```

### 受保护文件

```text
prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777
```

`tsconfig.tsbuildinfo` 在上述受保护清单中单独标记为已刷新缓存，不能表述为原始状态保持。

## 15. 修改文件清单

新增：

```text
apps/web/scripts/p13-build-audit/scanner.ts
apps/web/scripts/p13-build-audit/cli.ts
apps/web/tests/p13-build-audit.test.ts
docs/architecture/file-lifecycle-p13-c6-2-l2-design.md
docs/architecture/file-lifecycle-p13-c6-2-l2-report.md
```

更新：

```text
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改：

- Web/Worker 业务源码；
- package scripts；
- Web/Worker 危险运行时 build output；
- `.env`；
- Prisma Schema/Migration；
- 数据库、角色或 ACL；
- 部署配置；
- Git。

已披露例外：

- Web typecheck 刷新了 `apps/web/tsconfig.tsbuildinfo`；
- 该文件是 TS cache，不是 Web Server bundle 或 Worker runtime。

## 16. 未执行操作

```text
No build
No next build
No TypeScript build
No dangerous runtime artifact overwrite
No artifact delete
No artifact move
No artifact rename
No old Worker execution
No Web start
No deployment
No process stop/restart
No Scheduler/Service/Container change
No CI/CD change
No database connection
No SQL
No Migration
No physical delete
No Git write

Typecheck cache refresh:
  apps/web/tsconfig.tsbuildinfo

Nonconformance:
  The original byte-for-byte cache state was not preserved.
```

## 17. 后续条件

必须独立授权：

1. 移除 build 阶段 `.env` 读取；
2. 隔离旧 `.next`/`dist`；
3. 使用唯一隔离 release output；
4. 生成 Manifest、artifact digest、签名；
5. 实施 Startup Launcher；
6. 验证 Web/Worker compatibility；
7. 验证 build failure 不 fallback；
8. 验证 TOCTOU/只读 release；
9. 排空旧实例；
10. 最后清理旧 artifact。

在完成前：

```text
Production Artifact Status:
UNKNOWN

Legacy Artifact Removal:
NOT EXECUTED

Startup Gate:
NOT IMPLEMENTED

New Cleanup:
NOT ENABLED

Next Phase:
NOT AUTHORIZED
```

## 最终状态

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

Database:
NOT CONNECTED

SQL:
NOT EXECUTED

Prisma Schema / Migration:
NOT MODIFIED

Git Commit:
NOT CREATED

Next Phase:
NOT AUTHORIZED
```
