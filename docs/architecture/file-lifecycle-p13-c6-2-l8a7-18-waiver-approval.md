# P1-3 C-6.2-L8-A7.18-A tsconfig.tsbuildinfo Narrow Waiver Approval

## 1. 文档信息

- 阶段：`C-6.2-L8-A7.18-A`
- 日期：`2026-11-19`
- Branch：`feature/p1-3-storage-lifecycle-schema`
- HEAD：`b224388bc6160eb4a66ad8db7cecd4d23aa75fb8`
- 原始 A7.18 Report：`docs/architecture/file-lifecycle-p13-c6-2-l8a7-18-report.md`
- 原始 A7.18 Report SHA-256：
  `71C6F0D1C0374A558304AB8A3E1B7F0B29EF0B6E80FE8A3F18E78CC2B3BDDAF5`
- A7.18-R 资格结论：`PASS WITH WARNINGS`
- 豁免资格：`ELIGIBLE FOR NARROW WAIVER`
- 人工决定：`APPROVED`

本文件只记录人工窄范围豁免决定，不修改 A7.18 原始报告或其他历史结论。

## 2. 人工审批原文

用户正式批准原文：

> 我正式批准 A7.18 对 apps/web/tsconfig.tsbuildinfo 这一次历史哈希变化给予单文件窄范围豁免。

批准范围：

```text
单文件
单次已经发生的历史字节变化
仅限 A7.18 的受保护文件完整性处置
```

本批准不是未来自动许可，不扩展到其他文件、其他 cache 或其他阶段。

## 3. 审批对象

精确路径：

```text
apps/web/tsconfig.tsbuildinfo
```

文件身份：

```text
Exists:            YES
Regular file:      YES
Size:              407109 bytes
CreationTimeUtc:   2026-11-15T11:31:07Z
LastWriteTimeUtc:  2026-11-19T09:08:31Z
Attributes:        Archive
LinkType:          none
Target:            none
```

Git 身份：

```text
Tracked:    NO
Ignored:    YES
Rule:       .gitignore:28:*.tsbuildinfo
Status:     !! apps/web/tsconfig.tsbuildinfo
```

## 4. 获准比较的两个哈希

原始 SHA-256：

```text
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777
```

获准豁免的当前 SHA-256：

```text
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520
```

原始哈希继续保留为历史事实。不得删除、替换或改写成“从未发生变化”。

原始缓存内容不可获得，禁止通过伪造内容来宣称恢复了原始字节。

## 5. A7.18-R 资格核验

A7.18-R 的前一阶段只读核验结论：

```text
A7.18-R: PASS WITH WARNINGS
Eligibility: ELIGIBLE FOR NARROW WAIVER
WAIVER STATUS at review time: NOT APPROVED
```

依据：

1. 文件是 TypeScript 5.9.3 incremental build info；
2. Web `tsconfig.json` 配置 `incremental: true`、`noEmit: true`；
3. Web `typecheck` 是未覆盖 incremental 行为的 `tsc --noEmit`；
4. 文件 JSON 结构包含 `fileNames`、`fileInfos`、`root`、`options`、
   `referencedMap`、`affectedFilesPendingEmit`、`version`；
5. 文件被 `*.tsbuildinfo` 忽略且未被 Git 跟踪；
6. 静态搜索未发现应用源码、运行时、Startup Gate、Preflight、Manifest
   对该文件的读取或 import；
7. Source Tree Digest 明确排除 `.tsbuildinfo`；
8. Build Artifact Audit 将 extension `.tsbuildinfo` 归类为
   `CACHE`，并设置 `startupReachable=false`；
9. Web 正式构建使用 isolated config，显式设置 `incremental: false`；
10. Worker 正式构建显式传入 `--incremental false`。

A7.18-R 同时保留警告：

```text
Full apps/web/.next tree digest:    NOT VERIFIED
Full apps/worker/dist tree digest:  NOT VERIFIED
Original 018C byte diff:            NOT VERIFIED
Other ignored cache baselines:      NOT VERIFIED
```

## 6. 不参与安全与发布输入的证据

### Startup Gate 与 Preflight

`startup-security.mjs` 的 `REQUIRED_FILES` 不包含目标 cache。未发现 Startup
Gate、Web/Worker launcher、Preflight 或 instrumentation 读取目标文件。

### Source Tree Digest

`packages/build-integrity/src/index.mjs` 的
`SOURCE_EXCLUDED_EXTENSIONS` 包含：

```text
.tsbuildinfo
```

目标 cache 不参与 Source Tree Digest。

### Build Artifact Audit

`apps/web/scripts/p13-build-audit/scanner.ts`：

```text
CACHE_FILE_EXTENSIONS = { ".tsbuildinfo" }
artifactType = CACHE
startupReachable = false
```

### 正式 Build

Web production build 使用 `.p13-build/<releaseId>/tsconfig.json`，设置：

```text
incremental: false
tsBuildInfoFile: ./.tsbuildinfo.json
```

Worker production build 使用：

```text
--incremental false
```

目标文件不是正式 Web/Worker Release Artifact。

## 7. 批准决定

```text
WAIVER APPROVED
Scope:
apps/web/tsconfig.tsbuildinfo

Historical change:
018C24B24976726C8837E6C70B57DA982DAE635E98C62BC721F3F63AEF7FF777
->
21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520

Occurrences covered:
ONE

Future changes covered:
NONE
```

本豁免只处理已经发生的受保护文件完整性告警，不改变 A7.18 原始报告中的
其他事实、测试结果、UNKNOWN 边界或独立审查要求。

## 8. 明确不覆盖

本豁免不覆盖：

- 其他任何 `.tsbuildinfo` 文件；
- `apps/web/.next` 中任何文件或整树；
- Worker `dist` 中任何文件或整树；
- `apps/web/next-env.d.ts`；
- `.next/BUILD_ID`；
- Prisma Schema；
- P1-3 Migration；
- `startup-security.mjs`；
- 原有 Preflight test；
- A7.18 `script-security.mjs`；
- A7.18 新测试；
- A7.18 Design、Report 或 Implementation Status；
- Startup Gate、Manifest、Trust Root；
- Runtime Dependency Digest；
- 未来 TypeScript 检查或 Build 的 cache 写入；
- A7.19 独立安全审查。

## 9. 状态约束

```text
A7.18 ORIGINAL RESULT:
FAIL

A7.18 WAIVER:
APPROVED / SINGLE FILE / ONE HISTORICAL CHANGE

A7.18 FINAL DISPOSITION:
PASS WITH NARROW WAIVER AND WARNINGS

A7.19:
NOT AUTHORIZED

GIT COMMIT:
NOT AUTHORIZED
```

最终 disposition 是对 A7.18 原始 FAIL 的人工处置覆盖，不删除或重写原始报告。
