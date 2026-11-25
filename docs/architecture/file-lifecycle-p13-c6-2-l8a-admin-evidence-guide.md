# P1-3 C-6.2-L8-A 生产证据采集管理员指南

## 1. 目的与安全边界

本指南用于收集 Legacy Worker Drain 人工审核所需的只读生产证据。

禁止向 Codex、ChatGPT、工单、共享盘或聊天工具提交：

- 密码；
- Token；
- API Key；
- 数据库连接串；
- 私钥；
- `.env` / `.env.test`；
- 生产签名私钥；
- 未脱敏的命令行参数。

本工具只能输出：

- 公钥；
- 公钥指纹；
- ACL/身份证据；
- 脱敏进程和启动入口；
- Artifact/Manifest identity；
- Queue 统计；
- 完整性摘要和签名。

## 2. 证据可信度

| Level | 来源 | 可以证明 | 不能证明 |
|---|---|---|---|
| 0 | 口头声明 | 仅说明某人声称的状态 | 实例、权限、签名或实际配置 |
| 1 | 截图/人工文本 | 有人观察到某个界面 | 截图来源、完整性、跨主机一致性 |
| 2 | 原始命令输出 | 命令在某个时间产生了输出 | 命令执行者身份、输出未被修改 |
| 3 | 可信只读采集工具的结构化证据 | 采集工具在声明主机和时间采集了结构化结果 | 采集端未被攻陷、跨文件真实性 |
| 4 | 独立签名并由外部 Trust 验证 | 证据 body 与特定 Evidence Signer 绑定 | 生产实际操作已执行或业务审批已通过 |

L8-A 关键证据要求 Level 3 或 Level 4，并且 Evidence Bundle 必须由独立 Evidence Signer 签名。

## 3. 证据采集顺序

1. 冻结旧版本新部署和旧 Artifact 回滚；
2. 获取主机清单；
3. 获取 Web/Worker/Maintenance 进程和启动命令；
4. 获取 Service、Scheduler、Watchdog、Auto Restart；
5. 获取 Artifact/Release Root/Manifest；
6. 获取 Trust Root 公钥、指纹和生命周期；
7. 获取 Runtime Identity；
8. 获取 Release/Trust/Storage ACL；
9. 获取 Queue、Running Job、Retry、Upload、Operation 状态；
10. 获取 Network/Dependency 证据；
11. 两名独立管理员审批；
12. 由独立 Evidence Signer 签名；
13. 由离线 Validator 验证。

## 4. 主机与实例

每个主机至少记录：

- Host ID；
- Host Role；
- OS 版本；
- Production/Staging；
- Region；
- 采集时间和采集器身份。

每个实例必须把以下字段与实际进程交叉核对：

```text
Instance ID
Host ID
Process ID
Parent Process ID
Executable
Command Line（脱敏）
Working Directory
Runtime Identity
Startup Entry
Artifact Path
Release ID
Build ID
Manifest/Artifact/Runtime Dependency Digest
Lifecycle Safety Version
Process Start Time
Auto Restart Mechanism
```

不得只按 `node.exe` 或进程名称归类。命令行中如包含凭据，必须删除参数值，只保留参数名和脱敏标记。

## 5. Scheduler / Watchdog / Auto Restart

必须分别覆盖：

- Windows Service recovery；
- Task Scheduler；
- PM2；
- Docker restart policy；
- Kubernetes Deployment/StatefulSet/DaemonSet；
- Cron；
- systemd；
- Supervisor；
- 外部 Watchdog；
- CI/CD 自动发布；
- 云平台托管任务。

每个项目必须记录：

```text
Scheduler/Watchdog ID
Host
Type
Job Name
Schedule
Command（脱敏）
Working Directory
Target Artifact
Target Entry
Restart Policy
Enabled
Last Execution
Next Execution
Evidence Source
```

如需证明“没有 Scheduler”，应提交采集范围和查询结果，不能只写一句 `NONE`。

## 6. Artifact 与 Manifest

每个生产 Artifact 必须提供：

- 绝对路径；
- Release ID；
- Build ID；
- Source/Artifact/Runtime Dependency Digest；
- Manifest Schema Version；
- 签名 Manifest envelope；
- Key ID；
- Lifecycle Safety Version；
- Legacy delete marker 数量；
- Startup Gate 结果；
- `cleanupCapability`；
- 是否可直接启动或自动重启。

只提供公钥和验证结果，不提供私钥。

## 7. Trust Root

Trust Root 证据包括：

- Trust Root ID；
- 只读路径；
- Key ID；
- Ed25519 公钥 PEM；
- SPKI DER SHA-256 指纹；
- validFrom / validTo；
- ACTIVE / REVOKED / EXPIRED；
- 修改主体；
- 读取主体；
- 最近轮换时间。

运行身份不得是 Trust Root 修改主体。

## 8. Runtime Identity 与 Storage ACL

必须分别证明 Web、Worker、Maintenance 使用不同账户。

ACL 权限必须至少记录：

```text
Read
Create
Write
Rename
Delete
Modify ACL
Change Owner
Inheritance
Parent-wide permission
Reparse Point
External Object Store
ACL Modifier identities
```

以下任一情况阻断：

- Web/Worker/Maintenance 任一具有 Delete；
- Runtime 可 Modify ACL 或 Change Owner；
- Runtime 是 Trust Root/Release Root 修改主体；
- 父目录宽权限；
- Reparse Point；
- 外部对象存储身份不明；
- 三个运行身份共享账户。

## 9. Queue 与 Drain

Queue 快照必须在 15 分钟内，来源必须是批准的脱敏导出。

必须记录：

- Waiting；
- Active；
- Retry；
- Failed；
- Scheduled；
- Oldest Job；
- Worker Consumption Rate；
- Unfinished Operations；
- Active Uploads；
- Processing Recovery Status。

READY 要求 active/retry/waiting/failed/scheduled、Unfinished Operation 和 Active Upload 均为 0，Recovery 为 IDLE。

## 10. 只读采集示例

以下命令仅示例。实际命令由生产管理员按平台审批规则执行。

### 进程

```powershell
Get-Process |
  Where-Object { $_.ProcessName -in @('node','pm2') } |
  Select-Object Id,ProcessName,Path,StartTime
```

需要 Command Line 时，使用批准的 EDR/CMDB 导出，不要直接共享可能含凭据的原始命令行。

### Service

```powershell
Get-Service |
  Select-Object Name,DisplayName,Status,StartType
```

### Task Scheduler

```powershell
Get-ScheduledTask |
  Select-Object TaskName,TaskPath,State
```

### ACL

```powershell
Get-Acl -LiteralPath '<approved-path>' |
  Format-List
```

### File Hash

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '<approved-file>'
```

数据库和 PgBoss 状态只能由 DBA/平台管理员通过批准的脱敏导出提供。不得让 Validator 直接连接数据库。

## 11. Evidence Bundle

Schema Version 2 包含：

```text
hosts
processes
services
schedulers
watchdogs
instances
artifacts
trustRoots
releaseRoots
runtimeIdentities
storageAcls
queueSnapshots
runningJobs
networkDependencies
approvals
integrity
signature
```

所有条目必须包含采集来源字段：

```text
Evidence ID
Category
Host ID
Collected At
Collector Identity
Collector Version
Collection Method
Trust Level
```

## 12. 封存、签名与验证

### 12.1 封存

准备 Draft JSON 后：

```powershell
pnpm --filter @elevator/web p13:evidence:validate -- seal <draft.json> <sealed.json>
```

该步骤：

- 严格 schema 校验；
- 生成 Bundle SHA-256；
- 不读取私钥；
- 生成 `signature=null` 的未签名证据。

### 12.2 外部签名

Evidence Signer 对 canonical bundle（包含 integrity，不含 signature）使用批准的 Ed25519 KMS/HSM 签名。

不得把私钥写入仓库、Release Root、环境变量或 Evidence。

### 12.3 验证

```powershell
pnpm --filter @elevator/web p13:evidence:validate -- validate <sealed.json> <verification-trust.json>
```

`verification-trust.json` 包含：

```json
{
  "signerPublicKeys": {
    "evidence-key-id": "PUBLIC KEY PEM"
  },
  "trustedCollectorIdentities": [
    "trusted-collector-id"
  ]
}
```

## 13. 验证结果处理

### INVALID / BLOCKED / PARTIAL

任一出现时必须：

1. 不执行 Drain；
2. 根据 blocker 路径定位证据；
3. 检查是否为遗漏、过期、跨主机时间偏差、签名错误或权限异常；
4. 重新采集受影响证据；
5. 重新封存并签名整个 Bundle；
6. 重新验证。

不得手工修改 `integrity.digest`、签名值或安全布尔字段。

### READY FOR HUMAN REVIEW

只表示证据包可提交人工审核。

它不表示：

- Drain 已执行；
- 生产操作已获授权；
- 旧 Artifact 可删除；
- Future Cleanup 已启用。

## 14. 必须重新采集的情况

- Evidence 超过 freshness window；
- Bundle 被修改；
- 签名失败或 Signer 不受信；
- Collector 不受信；
- Host/Instance/Scheduler 清单变化；
- Artifact/Manifest/Trust Root 变化；
- ACL 或运行身份变化；
- Queue 状态变化；
- 审批过期或审批人与范围不匹配；
- 任一 UNKNOWN 状态。

## 15. 双人审批

至少两名身份不同的管理员独立确认：

1. Host/Instance/Scheduler 清单完整；
2. Artifact/Manifest/Trust Root 已验证；
3. Runtime/ACL 无删除权限；
4. Queue/Operation/Upload 已排空；
5. 自动重启和 Watchdog 不再指向旧 Artifact；
6. Future Cleanup 未启用；
7. Bundle ID 和摘要一致。

审批记录必须绑定 bundle ID，不得审批一个可继续变化的未封存文件。
