# P1-3 C-6.2-L3 Build Identity、Signed Manifest 与 Startup Gate 报告

## 文档信息

- 阶段：`C-6.2-L3`
- 日期：`2026-11-18`
- 分支：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 结论：`PASS WITH WARNINGS`

## 1. 最终状态

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
IMPLEMENTED / TEST-KEY VERIFIED

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

## 2. 修改文件清单

### 新增共享安全包

```text
packages/build-integrity/package.json
packages/build-integrity/src/index.mjs
packages/build-integrity/src/index.d.ts
```

### Web

```text
apps/web/src/instrumentation.ts
apps/web/src/server/security/startup-gate.ts
apps/web/scripts/build-secure.ts
apps/web/scripts/start-secure.mjs
apps/web/tests/p13-release-security.test.ts
apps/web/next.config.ts
apps/web/package.json
```

### Worker

```text
apps/worker/src/index.ts
apps/worker/src/worker-entry.ts
apps/worker/src/security/startup-gate.ts
apps/worker/src/config.ts
apps/worker/scripts/build-secure.ts
apps/worker/package.json
apps/worker/tsconfig.json
```

### Workspace

```text
pnpm-lock.yaml
```

### 文档

```text
docs/architecture/file-lifecycle-p13-c6-2-l3-design.md
docs/architecture/file-lifecycle-p13-c6-2-l3-report.md
docs/architecture/file-lifecycle-p13-implementation-status.md
docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md
```

未修改：

- Prisma Schema；
- Migration；
- 数据库 ACL/角色；
- Web/Worker 历史危险构建产物；
- 部署/CI/CD/Service/Scheduler；
- Git 历史。

## 3. Build Identity

已实现：

```text
application
buildId
releaseId
gitSha
gitDirty
sourceTreeDigest
sourceTreeExclusionPolicyVersion
dependencyLockDigest
artifactDigest
artifactDigestAlgorithm
buildTimestamp
lifecycleSafetyVersion
cleanupCapability
artifactRoots
```

Build ID 由应用、Git SHA、Source Digest、Lock Digest、Artifact Digest 和构建时间计算，不接受手工固定值。

Git：

- 使用只读 `rev-parse` / `status --porcelain`；
- Windows 构建显式使用 `safe.directory`，不修改 Git 配置；
- Git 不可用时构建失败；
- Dirty Tree 由 `gitDirty=true` 标记，Source Digest 仍覆盖当前关键源码。

## 4. Source Tree Digest

已验证：

- 相同源码 + 排除文件变化 => digest 不变；
- 关键源码变化 => digest 变化；
- 路径排序稳定；
- 文件读取期间 size/mtimeNs 变化拒绝；
- 非排除 symlink 拒绝；
- `node_modules/.env/dist/.next/.p13-releases/cache` 不进入 Source Digest；
- Manifest/Gate/security 包/构建配置在默认包含范围内。

排除策略版本：

```text
p13-l3-source-v1
```

## 5. Artifact Digest

已实现：

- SHA-256；
- 稳定路径排序；
- 全 regular file 集合；
- symlink/Junction 拒绝；
- 大小写重复路径拒绝；
- 文件读取前后 size/mtimeNs 比较；
- Manifest 自身排除。

隔离 Worker build 验证：

```text
artifact files = 36
artifactDigest = 8d529fdad4daaab9b84da8b9f57860d288b0e679a6b3647ffffc45f0d37e1d9f
```

Warnings：

- 当前 Worker release root 不包含完整 `node_modules`；
- `dependencyLockDigest` 验证 lockfile，但不验证已安装依赖字节；
- 因而运行时依赖完整覆盖率仍为 `PARTIAL`；
- 后续应打包 standalone/deploy artifact，将所有运行时依赖纳入 release root 和 Artifact Digest。

## 6. Signed Manifest

已实现：

- Ed25519；
- Trusted keyId 映射；
- Canonical JSON；
- 严格 JSON parser；
- duplicate field 拒绝；
- unknown Manifest field 拒绝；
- Manifest 完整性字段检查；
- signature 仅覆盖 canonical Manifest body；
- Manifest 和 signature 同文件，Manifest 自身排除 Artifact Digest。

已测试：

- 合法签名通过；
- Manifest 篡改拒绝；
- signature/keyId 错误拒绝；
- 未知字段拒绝；
- capaability 非 DISABLED 拒绝；
- Build ID/Git/SHA/digest 格式错误拒绝；
- build timestamp 过期或未来拒绝；
- wrong app/release 拒绝。

### 生产密钥

```text
Production Signing Private Key: NOT CONFIGURED
Production Trust Root: NOT CONFIGURED
```

本轮只用一次性 Ed25519 测试密钥，测试后删除临时目录。

## 7. Trust Root 设计

Trust Root 格式：

```json
{
  "keys": {
    "key-id": "PUBLIC KEY PEM"
  }
}
```

约束：

- 公钥不从待验证 Manifest 读取；
- 公钥路径由外部启动配置提供；
- keyId 必须存在于信任集合；
- 未知 keyId 拒绝；
- trust root 文件必须为 regular file；
- 轮换时并存新旧公钥，撤销时移除旧 keyId；
- trust root 应由部署系统只读注入。

代码已实现公钥映射与 keyId 验证，但生产信任根与只读部署尚未配置。

## 8. Worker Startup Gate

新入口：

```text
apps/worker/src/index.ts
  -> build-integrity
  -> security/startup-gate
  -> verify signed manifest/artifact/lifecycle/legacy scan
  -> dynamic import("./worker-entry.js")
```

业务模块：

```text
apps/worker/src/worker-entry.ts
```

才导入 Prisma、pg-boss、Storage 和 Worker config。

验证：

- 源码静态检查确认没有静态导入 `worker-entry.js`；
- 没有直接静态导入 `pg-boss` 或 `@prisma/client`；
- 隔离 Worker build 的 Signed Manifest 和 Gate 验证通过；
- Gate 失败时只在 bootstrap 输出错误码并退出。

## 9. Web Startup Gate

### Start wrapper

`pnpm --filter @elevator/web start` 现在执行：

```text
node scripts/start-secure.mjs
```

Wrapper 在 spawn Next 前验证：

- manifest；
- signature；
- trust key；
- app/git/release；
- lifecycle safety；
- artifact digest；
- legacy markers。

### Instrumentation

```text
apps/web/src/instrumentation.ts
```

在 production Next 启动阶段再次执行 Web Gate。它只导入 Gate 模块，不导入 Prisma、pg-boss 或 Storage。

### 绕过边界

仓库支持入口已经使用 wrapper；外部直接：

```text
next start
```

仍可能绕过 wrapper。新迁移的 `.next` 应有 instrumentation，但旧 `.next` 没有。部署侧必须禁止直接 next start，并配合只读 release。

因此 Web Gate：

```text
IMPLEMENTED / UNIT TESTED / PRODUCTION BYPASS CONTROL PARTIAL
```

Web production build 未执行。

## 10. Build Pipeline

### Web

```text
apps/web/scripts/build-secure.ts
```

- 要求 `P13_RELEASE_ID` / release root / signing key；
- 目标目录必须预先不存在；
- 强制 `.p13-releases/<releaseId>`；
- 通过 `P13_NEXT_DIST_DIR` 隔离输出；
- Next build 失败立即退出；
- 成功后生成/签名 Manifest。

### Worker

```text
apps/worker/scripts/build-secure.ts
```

- 要求唯一不存在的 release root；
- 使用 `tsc --outDir <temp> --incremental false`；
- 成功后才生成/签名 Manifest。

### Build Failure Test

缺少 `P13_RELEASE_ID`：

```text
Web build exit = 1
Worker build exit = 1
```

旧产物哈希：

```text
Web .next/BUILD_ID:
before = 06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1
after  = 06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

Worker dist/file-maintenance.js:
before = C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3
after  = C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3
```

没有 fallback 到已有产物。

## 11. 隔离 Worker 构建结果

构建位置：

```text
系统临时目录/p13-l3-worker-<random>/release
```

结果：

```text
buildId = 276f3a99c8ca0fba9aaa2f6c519f45a9
releaseId = l3-worker-30f0d1eddfaf
artifactFiles = 36
artifactDigest = 8d529fdad4daaab9b84da8b9f57860d288b0e679a6b3647ffffc45f0d37e1d9f
legacyFindings = 0
signedManifest = PASS
startupGate = PASS
```

测试完成后删除临时目录和一次性测试密钥。

Web build：

```text
NOT EXECUTED
```

原因：避免对现有 Next 配置/缓存/历史 `.next` 产生未审查副作用；Web gate 通过单元测试验证。

## 12. Secret Isolation

已修改 `apps/web/next.config.ts`：

- 删除显式 `dotenv` import；
- 删除 root `.env` load；
- production build 必须有隔离 distDir；
- distDir 只允许安全相对 release path。

Worker:

- build script 不执行 Worker config；
- minimal bootstrap 不加载 config；
- Worker config 只在 Gate 验证后由 business entry 动态加载；
- `NODE_ENV=test` 下不调用 dotenv。

仍未验证：

- Next.js 自身所有 env 加载路径；
- production build 输出字节中无秘密；
- 部署环境 secret injection。

状态：

```text
Secret Isolation: PARTIALLY VERIFIED
```

本轮未读取根 `.env` 或 `.env.test`。

## 13. Web / Worker 兼容性

Web/Worker Gate 都要求：

```text
P13_RELEASE_ID
```

Manifest releaseId 必须与其一致。不同 release ID 拒绝。

未实现 peer manifest 互读；同一 release ID 由独立部署配置保证。

## 14. TOCTOU

已实现：

- 摘要前后 stat；
- 文件变化拒绝；
- symlink/Junction 拒绝；
- Manifest/Trust Root regular-file 检查；
- Gate 后使用同一 release root；
- Web distDir 由已校验 release root 反推；
- Worker dynamic import 固定相对入口。

未实现/未验证：

- release root OS 只读 ACL；
- 文件句柄/inode 级执行绑定；
- docker read-only root filesystem；
- 校验后到 import 之间的原子不可替换；
- 生产文件系统 TOCTOU。

状态：

```text
TOCTOU: PARTIAL
```

## 15. 自动化测试

### Web 全量纯单元测试

```text
19 files / 105 tests PASS
```

### L3 Security

```text
15/15 PASS
```

覆盖：

- canonical JSON；
- duplicate JSON；
- Source/Artifact Digest；
- symlink/Junction；
- Ed25519；
- 错误 key；
- Manifest 篡改；
- unknown fields；
- cleanup capability；
- release mismatch；
- extra artifact；
- Web/Worker Gate；
- minimal bootstrap；
- build/start wrappers；
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

### 测试环境安全

- 未运行 integration/E2E；
- 未启动真实 Web/Worker；
- 未连接数据库；
- 未执行 Cleanup；
- 未访问业务 Storage Root。

## 16. 独立攻击性自审

| 检查 | 结果 |
|---|---|
| Web Gate 绕过 | wrapper + instrumentation；外部 direct next start 需部署禁止 |
| Worker Gate 绕过 | minimal bootstrap + dynamic import |
| 静态 import 提前加载业务 | Worker 测试已检查 |
| 旧 dist fallback | build scripts 失败不 fallback |
| 旧 `.next` fallback | Web wrapper 指定 release root |
| Manifest 自签名信任 | 公钥来自外部 trust root |
| Manifest 替换公钥 | 公钥不来自 Manifest |
| 私钥进入仓库 | 未配置生产私钥；测试密钥临时删除 |
| 私钥进入产物 | Manifest 只含签名 |
| Artifact 范围遗漏 | runtime node_modules 仍 PARTIAL |
| 路径穿越 | manifest/gate/root path 校验 |
| Reparse Point | Junction/symlink 拒绝 |
| TOCTOU | 检测文件变化，但无 OS 只读证明 |
| Dirty Tree | gitDirty + sourceTreeDigest |
| 关键文件排除 | 路径为默认包含；排除规则固定 |
| Web/Worker 版本 | 同 releaseId 要求 |
| build 失败继续启动 | secure script 失败退出 |
| 构建缓存复用 | release root 必须不存在；incremental false |
| 自动重启绕过 | 新 Worker 入口始终 Gate |
| direct next start | 外部部署控制尚未验证 |
| direct node dist | 新 dist index 是 Gate；旧 dist 仍需隔离 |
| Next env 读取 | 显式 root load 已移除，自动机制 PARTIAL |
| Secret 写入 Manifest | Manifest 无环境值 |
| 日志泄漏 secret | startup/build 日志只输出错误码 |
| 本地测试等同生产 | 未等同；Production UNKNOWN |
| 上传/下载破坏 | L 单元测试通过 |
| L fail-closed 回退 | 未重新开启删除 |

## 17. 未解决风险

1. 生产签名私钥未配置；
2. 生产 Trust Root 未配置；
3. 生产 service/CI/CD 未接入 secure build/start；
4. Web production build 未执行；
5. runtime dependencies 未完整纳入 Artifact Digest；
6. release root 只读权限未实现；
7. OS 级 TOCTOU 未验证；
8. 外部 direct `next start` 尚未控制；
9. 旧 `.next` 和 Worker `dist` 仍在原位；
10. 旧实例排空仍为 UNKNOWN；
11. Production Artifact Status UNKNOWN；
12. Next 自动环境加载未通过真实 production build 验证；
13. peer web/worker manifest compatibility 仅靠共享 release ID；
14. 依赖安装恢复曾创建 node_modules `.prisma` Junction，需要部署环境正常运行 `prisma generate` 或等价流程。

## 18. SHA-256

### 共享安全包

```text
packages/build-integrity/package.json
05F71D009863D20503A34BC29D53DF5493AAFAC614EFABA98E93AB254523B8AC

packages/build-integrity/src/index.mjs
1CA4AE9349F0544E5B4331FFB15DD86A2C48C959698B92816120AD2374680053

packages/build-integrity/src/index.d.ts
D86DA9676FBBDB4927BD142043905EFA471DECDBB28DE6FEF6E32008A35CCFFF
```

### Web / Worker

```text
apps/web/src/instrumentation.ts
28EF596F2E2201C8549CC98A7D1B288FEA8B6438D007CB56DF37F75B4E251AD0

apps/web/src/server/security/startup-gate.ts
B8EB4F1943DF3D5E1F2DD98BC37D5A12FD0AE2143B7D590BB608412DCEE08991

apps/web/scripts/build-secure.ts
33B207DAB93C2CD051F03404AE1CCDDCB624E5EA6256BCDDF1FEAF46FECD07F2

apps/web/scripts/start-secure.mjs
4A1C5501C15AE80CA091FA5AFFB6453AB2CAD026FE8452FF736566E944B2BA71

apps/web/next.config.ts
2195DB6CBA6F845845C4AF76C195FF250BA371366A86EB45BEAF216B2CE08331

apps/web/package.json
07E63F244E650AED2D3B273EE16D904DCE7FD92EFA93B5F3C1A4E389C922B176

apps/web/tests/p13-release-security.test.ts
0E4CCA3C2D448F055577233F7BF5362EFA2230B0CCB1DD48D8A607401CC454DA

apps/worker/src/index.ts
C01A2F6848B29D66C798F7F534C729FA9AB65788FEAB4CD5E892AD58BBC8F48D

apps/worker/src/worker-entry.ts
9C7979588A6B723252AE63B64EFE0C49DFA3ABEF01937544DFC4FD973D9021FA

apps/worker/src/security/startup-gate.ts
A38F0973680C7B012B375FC02BD510B0DFE975A7AC3CAB4E0F374C026B4C4562

apps/worker/src/config.ts
AFEDCE09C4C1347ABF3D0E603D1F98A766987056C092A4B96FA520F914773432

apps/worker/scripts/build-secure.ts
897F876BC59AD7EB2A68E01296898F8CF0A6CF95BBFE98B3F3CB9EE030629CD0

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
L3 设计
D4A8A6AE43C22109A131969B53B7BDBF3BC0677805F1B154C56527417BFE0CF2

测试计划
861ADC94C7CC21A9CAC051C181E2B30B47C3ABE3DC73EF4FF53CC085FC567090

实现状态
3226B4A5EE0373F4223DAFDEAB9725EECD177908C37112C6BB74C568432BC690
```

L3 报告自身哈希在最终消息外部提供。

### 受保护旧产物

```text
apps/web/.next/BUILD_ID
06955B147BD0009CD09B566531E3D2BC93B77142582145564E219C1530F9F5A1

apps/worker/dist/file-maintenance.js
C6B5B0EBD2AD047CF32AE447470B19D2AB02F413DDB33BABF80828A6FEFCABE3

apps/web/tsconfig.tsbuildinfo
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777

prisma/schema.prisma
78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299

apps/web/next-env.d.ts
0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC
```

## 19. 未执行操作

```text
No production signing key
No production trust root
No Web production build
No deployment
No Web/Worker real start
No Service/Scheduler/Container/CI change
No database connection
No SQL
No Migration
No Storage ACL/IAM change
No real cleanup
No legacy artifact delete/move/rename/overwrite
No Git write
```

## 20. 下一步

必须独立授权：

1. 配置生产签名私钥保管和 CI 签名流程；
2. 配置只读生产 Trust Root 与轮换策略；
3. 将完整 runtime dependencies 纳入 release artifact；
4. 执行隔离 Web production build 并验证无 secret；
5. 配置 release root 只读 ACL；
6. 接入部署 Service/CI，禁止 direct next start；
7. 验证 OS 级 TOCTOU；
8. 排空旧 Worker/旧构建；
9. 最后清理历史产物。

## 最终门禁

```text
C-6.2-L3:
PASS WITH WARNINGS

Build Identity:
IMPLEMENTED

Source Tree Digest:
VERIFIED

Artifact Digest:
PARTIAL

Signed Manifest:
TEST-KEY VERIFIED

Trust Root:
PRODUCTION NOT CONFIGURED

Web Startup Gate:
IMPLEMENTED / BUILD NOT EXECUTED

Worker Startup Gate:
IMPLEMENTED / ISOLATED BUILD VERIFIED

Build Failure Protection:
VERIFIED

TOCTOU:
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
