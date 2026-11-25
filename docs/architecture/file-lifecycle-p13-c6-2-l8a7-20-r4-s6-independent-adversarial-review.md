# P1-3 C-6.2-L8-A7.20-R4-S6 Independent Adversarial Review

## 0. 审查结论

```text
A7.20-R4-S6:
FAIL

R4S4-P1-C Per-request IPC Authentication:
OPEN

R4S4-P1-4 Helper Process Model:
OPEN

P1-3 SEALED Regression:
REGRESSION FOUND / OPEN

New P1 findings:
3

R4 Design Freeze:
NOT APPROVED
```

本轮结论不是因为 R4-S5 使用了 `ClientPID` 而失败。`ncalrpc` +
`RpcServerInqCallAttributes` + process handle/lifetime + Token/SID 的方向有
官方 API 基础，优于 Named Pipe + HMAC。

失败来自三个组合缺口：

1. 每请求身份检查没有被固定到官方保证的每调用执行点。R4-S5 允许把它放在
   RPC security callback；官方文档只保证 callback 可能在一客户端/接口上被
   调用不止一次，没有保证每次 RPC 调用都调用一次。
2. Helper 自行打开并加入 Job，但设计没有关闭 Helper 自身 Job handle。
   `KILL_ON_JOB_CLOSE` 只在最后一个 Job handle 关闭时终止关联进程；Helper
   保留或重新取得 Job handle 时，Supervisor 崩溃不会保证终止 Helper。
3. “Canonical Guardian 是只读 owner”在 Windows 安全语义下不成立。对象 owner
   默认隐含 `WRITE_DAC`，可重写 DACL 再授予自己写权限。R4-S5 没有使用 Owner
   Rights SID 阻断该隐式权限，因此 `OS_ENFORCED_SEALED` 未被证明。

上述缺口可以设计修复，但本轮只审查、不修改。R4-S5 不得据此进入 Design
Freeze，也不得进入实现、Schema、DB、Storage、Cleanup 或部署。

## 1. 审查范围与限制

```text
Mode: READ-ONLY ADVERSARIAL DESIGN REVIEW
Platform scope: Windows V1 only
Source changes: NOT AUTHORIZED
Schema / Migration / SQL: NOT AUTHORIZED
Database connection: NOT EXECUTED
Storage access: NOT EXECUTED
Build / Test / Scanner: NOT EXECUTED
Git write operations: NOT EXECUTED
Production deployment: NOT EXECUTED
R4-S7: NOT AUTHORIZED
```

本轮只做文档、静态源码、配置名和官方 API 契约审查。没有 Windows 实机
进程/ACL/Job/RPC 测试，因此即使设计逻辑通过的部分也不能写成 runtime PASS。

## 2. 基线

```text
Repository: D:\thinkbook\Desktop\jieya
Branch: feature/p1-3-storage-lifecycle-schema
HEAD: b224388bc6160eb4a66ad8db7cecd4d23aa75fb8
Tracked modified: 26
Untracked files: 154
Staged: 0
Deleted: 0
```

开始前目标报告不存在：

```text
docs/architecture/file-lifecycle-p13-c6-2-l8a7-20-r4-s6-independent-adversarial-review.md
```

受保护文件：

| 文件 | SHA-256 |
|---|---|
| FZ | `E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705` |
| ST | `5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586` |
| DBTP | `FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7` |
| `prisma/schema.prisma` | `78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299` |
| `apps/web/next-env.d.ts` | `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC` |
| `apps/web/tsconfig.tsbuildinfo` | `21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520` |
| R4-S5 Design | `8A83D4FD13ED92FEF3C51E902096D08D9B15925F35F8DB9BB238B6E308336B1C` |
| R4-S5 Report | `D77FDF7AF96C685211590D198CF4D8368C4E6C74486F1E2D1A2E388EA4DB4EC0` |

## 3. Skills 和审查材料

实际读取并应用：

- `$project-architecture`
- `$prisma-db-safety`
- `$security-audit`
- `$testing-and-verification`
- `$file-lifecycle`

完整复核：

- 根/蓝图 `AGENTS.md`
- `FZ`、`ST`、`DBTP`
- R4-S1 Design / Report
- R4-S2 Review
- R4-S3 Design / Report
- R4-S4 Review
- R4-S5 Design / Report
- 当前 Schema/Migration/Storage/Worker/Capability 相关只读材料
- R4-S5 的 Job、RPC、Grant、Release、Evidence、SEALED、DELETED、Recovery
  章节及状态机

没有修改上述任何文件。

## 4. 官方资料

查询日期：`2026-11-19`。

| 官方资料 | 官方语义 | 本次审查用途 / 未保证部分 |
|---|---|---|
| [Security (RPC)](https://learn.microsoft.com/en-us/windows/win32/rpc/security) | RPC 提供客户端认证与授权基础 | 支持 server-side authenticated RPC；不等于自动得到逐调用进程身份 |
| [ncalrpc protocol sequence](https://learn.microsoft.com/en-us/windows/win32/rpc/protocol-sequence-constants) | `ncalrpc` 是 local procedure call，只支持 `RPC_C_AUTHN_WINNT` | 支持本机专用传输；仍需真实 Windows 验证 |
| [Authentication levels](https://learn.microsoft.com/en-us/windows/win32/rpc/authentication-level-constants) | `ncalrpc` 始终使用 `RPC_C_AUTHN_LEVEL_PKT_PRIVACY` | 支持隐私通道；不能替代实际进程身份 |
| [`RpcServerRegisterIf3`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcserverregisterif3) | 可设置 interface Security Descriptor 和 `IfCallback` | 支持接口 ACL/回调；具体 ACL rights 未在设计中给出或验证 |
| [`RPC_IF_CALLBACK_FN`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nc-rpcdce-rpc_if_callback_fn) | callback 可以取得 client binding；返回非 OK 则拒绝。官方说明 callback 可能在一客户端/接口上调用不止一次 | **不保证每 RPC call 恰好调用一次**，不能作为唯一逐调用门禁 |
| [`RpcServerInqCallAttributesW`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/nf-rpcasync-rpcserverinqcallattributesw) | Server 获取当前 call 的 security context attributes | 支持当前调用属性；失败时字段 undefined，必须 fail-closed |
| [`RPC_CALL_ATTRIBUTES_V2_W`](https://learn.microsoft.com/en-us/windows/win32/api/rpcasync/ns-rpcasync-rpc_call_attributes_v2_w) | `RPC_QUERY_CLIENT_PID` 填充调用客户端 `ClientPID`，仅支持 `ncalrpc` | 接受 `ClientPID` 来源；它不是完整身份，必须与进程和 token 绑定 |
| [`I_RpcBindingInqLocalClientPID`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdcep/nf-rpcdcep-i_rpcbindinginqlocalclientpid) | 旧 API，官方建议改用 `RpcServerInqCallAttributes` | 新实现不得依赖旧 API |
| [`RpcImpersonateClient`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcimpersonateclient) | 服务线程可模拟当前 client；必须有活动 call context；失败时可能保留 server 自身身份 | 必须检查返回值并在受控线程内安全恢复；异步/跨线程需特别处理 |
| [`RpcRevertToSelf`](https://learn.microsoft.com/en-us/windows/win32/api/rpcdce/nf-rpcdce-rpcreverttoself) | 结束 impersonation，恢复 server identity；其他 client thread 情形使用 `RpcRevertToSelfEx` | R4-S5 未固定异常安全恢复契约 |
| [`OpenThreadToken`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openthreadtoken) | 打开线程 token；`OpenAsSelf` 影响 access check；token handle 必须关闭 | impersonation token 生命周期和 handle 清理未完整定义 |
| [Access Tokens](https://learn.microsoft.com/en-us/windows/win32/secauthz/access-tokens) | token 标识进程/线程安全上下文，包含 User/Group/Logon SID 和 privileges | 支持 process token/SID 校验；token 与 RPC principal 不是同一概念 |
| [`OpenProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess) | 打开进程须满足进程 DACL 和 access rights | 设计选择 query-limited + synchronize；跨 service SID access 未验证 |
| [`GetProcessTimes`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | 返回进程 creation time | 支持 PID reuse 区分；需要稳定 64-bit 比较 |
| [`GetTokenInformation`](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation) | 可查询 User/Groups/Integrity/Session 等 token 信息 | 支持 token 校验；设计需固定必须查询的字段和失败规则 |
| [`DuplicateHandle`](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle) | 跨进程复制 handle 需要源/目标进程 `PROCESS_DUP_HANDLE` | 可复制 handle，但不能改变后续 RPC call 的 `ClientPID`；Process DACL 仍需实机验证 |
| [CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw) | `bInheritHandles=TRUE` 可继承调用进程所有可继承 handle | R4-S5 禁止继承，但启动实现和 handle list 未固定 |
| [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) | Job 管理关联进程；子进程默认关联，但 `Win32_Process.Create` 创建的进程不属于该 Job；Windows 8+ 可嵌套 | Job 不是所有进程创建路径的完备边界 |
| [JOBOBJECT_BASIC_LIMIT_INFORMATION](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) | `KILL_ON_JOB_CLOSE` 在**最后一个 Job handle**关闭时终止关联进程；active-process 超限会终止新加入进程 | 用于证明 Helper Job handle 缺口；只一个 handle 不保证 |
| [`AssignProcessToJobObject`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject) | 进程需要 `PROCESS_SET_QUOTA`/`PROCESS_TERMINATE`；Job 需要 assign right；已有 Job 时对 nested job 有限制 | 自关联并非无竞态；Windows 版本/既有 Job 需实机验证 |
| [`TerminateJobObject`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-terminatejobobject) | 终止 Job 中关联进程；文档要求 Job/process 的相应权限 | R4-S5 未定义 Supervisor 的 terminate/close rights |
| [`CreateJobObjectW`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-createjobobjectw) | 若同名对象已存在，返回既有对象并设置 `ERROR_ALREADY_EXISTS`；返回 handle 具有全部访问权 | 命名 Job 需防抢占/复用；R4-S5 未要求检查该错误 |
| [`IsProcessInJob`](https://learn.microsoft.com/en-us/windows/win32/api/jobapi/nf-jobapi-isprocessinjob) | 检查进程与 Job/任意 Job 的关联 | 能验证关联状态；不能替代 handle 生命周期或进程退出 |
| [`QueryServiceStatusEx`](https://learn.microsoft.com/en-us/windows/win32/api/winsvc/nf-winsvc-queryservicestatusex) | `SC_STATUS_PROCESS_INFO` 在 RUNNING/PAUSED 等状态可给出 process ID；启动/停止 pending 时可能无效 | SCM PID 只能辅助；最终必须绑定实际 process handle |
| [Service Control Manager](https://learn.microsoft.com/en-us/windows/win32/services/service-control-manager) | SCM 管理 service install/start/status/control | 支持固定 service 启动；不等于进程退出或身份证明 |
| [Process mitigation policy](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/ns-ntddk-_process_mitigation_child_process_policy) | `NoChildProcessCreation` 可禁止进程直接创建子进程 | 官方文档没有证明覆盖 WMI/其他代理创建路径；需实机验证 |
| [WDAC](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/windows-defender-application-control/wdac) | 应用控制可限制可执行代码 | 设计目标有依据；策略、签名和替换窗口未验证 |
| [How AccessCheck Works](https://learn.microsoft.com/en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object) | 对象访问按 thread token 与 DACL ACE 做 access check | DACL 是规则来源；不能假设修改 DACL 会关闭已有 handle |
| [Owner of a New Object](https://learn.microsoft.com/en-us/windows/win32/secauthz/owner-of-a-new-object) | 对象 owner 隐式拥有 `WRITE_DAC`，可修改 DACL 并控制访问 | 直接反驳“只读 owner”表述；必须使用 Owner Rights 或不可激活 owner |
| [Special Identity Groups](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-special-identities-groups) | `Owner Rights` SID `S-1-3-4` 的 ACE 可使系统忽略 owner 的隐式 `READ_CONTROL`/`WRITE_DAC` | 修复 SEALED ACL 需要显式设计 |
| [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) | `SECURITY DEFINER` 函数以 owner 权限执行；可用 `SET search_path` | Grant 设计应有基础；数据库实现与真实角色测试未执行 |

## 5. RPC 方案独立评估

### 5.1 接受的部分

以下判断与官方资料一致：

- `ncalrpc` 是本机 RPC，不用引入 loopback 网络协议；
- `RPC_CALL_ATTRIBUTES_V2_W.ClientPID` 来自当前调用客户端，不是 payload；
- `ClientPID` 仅在 `ncalrpc` 上按 flag 填充；
- `ClientPID`、process handle、creation time、process token 和 RPC principal
  联合可显著强于 HMAC；
- PID 重用可以通过 held process handle + creation time 防混淆；
- `ncalrpc` 的隐私认证级别可满足本机 RPC 传输保护目标；
- `OpenProcess` 的 API access check 和 `GetProcessTimes` 的 creation time
  语义支持设计方向。

### 5.2 不能接受的部分

- `ClientPID` 本身不是完整身份；R4-S5 虽然说联合验证，但没有固定
  token/principal 的一致关系。
- RPC interface callback 不是官方保证的逐调用钩子。
- Impersonation 的生命周期、错误清理、线程隔离和 `RpcRevertToSelf` 没有
  明确到可实现的安全算法。
- `OpenProcess` 在不同 service SID 下的 process DACL 权限未验证。
- `RPC_CALL_ATTRIBUTES_V2` 失败/`ERROR_MORE_DATA` 的字段完整性处理没有被
  明确写入失败规则。

### 5.3 结论

```text
TRANSPORT/PRIMITIVE SELECTION:
ACCEPTABLE

PER-CALL AUTHORIZATION DESIGN:
OPEN

R4S4-P1-C:
OPEN
```

## 6. P1-C 详细审查

### 6.1 正确身份链

符合设计意图的逐调用链应为：

```text
current RPC method invocation
  -> RpcServerInqCallAttributes(ClientBinding)
  -> ncalrpc + authenticated principal + privacy
  -> ClientPID
  -> OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE)
  -> GetProcessTimes(creationTime)
  -> read process token / SIDs / integrity / session
  -> compare with Session processIdentityTuple and heldProcessHandle
  -> check process not signaled
  -> check callerClass/method/action policy
  -> only then dispatch the manager operation
```

R4-S5 的方向与此一致，但没有把链条固定到唯一执行位置。

### 6.2 P1-C 反例

```text
1. A 与 Supervisor 建立 RPC session。
2. B 获得 A 的 RPC binding/handle（或同一连接上的复用能力）。
3. RPC runtime 没有为后续调用再次执行 security callback；
   或实现把 callback 当成唯一身份门禁。
4. Supervisor manager 直接处理 B 的调用。
5. Server 只看到旧的连接认证/Session，不重新取得 B 的当前 ClientPID。
```

这不是 `ClientPID` 被伪造，而是“没有在每次调用使用它”。R4-S5 §7.3 的
“callback 或 manager 之前”没有强制选择 manager/wrapper；官方 callback
文档又明确不能假设每调用只/必调用一次。因此 P1-C 仍是：

```text
OPEN
```

### 6.3 最小设计修复

- 每个 RPC manager 方法必须经过统一的 `AuthorizeCurrentCall` wrapper；
- wrapper 在方法进入业务逻辑前调用 `RpcServerInqCallAttributes`；
- security callback 只能作为接口级前置过滤，不能充当唯一的每调用身份门禁；
- 禁止把当前调用身份检查下沉到异步任务线程或依赖 thread token 继承；
- 对 `ClientPID` 缺失、`ERROR_MORE_DATA`、auth 字段不完整、PID 打开失败，
  一律拒绝；
- callback 多次调用必须幂等，但不得以 callback 次数作为身份状态数量。

## 7. P1-4 详细审查

### 7.1 Job Object 的最后一个 Handle

官方 `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` 语义是：

```text
所有关联进程在 Job 的最后一个 handle 关闭时终止
```

不是：

```text
Supervisor 的 handle 关闭时终止
```

R4-S5：

- Supervisor 创建 named Job；
- Helper 自己打开 Job 并加入；
- design 说 Job DACL 只允许 Supervisor 和对应 Helper SID；
- 但没有规定 Helper 在成功加入后立即关闭其 Job handle；
- 没有规定 Supervisor 独占最后一个 handle；
- 没有固定 Supervisor 对 `JOB_OBJECT_TERMINATE` / process terminate 的权限。

### 7.2 失败路径

```text
1. Supervisor 创建 epoch Job。
2. Helper 打开 Job，加入自身。
3. Helper 被暂停，暂停时仍持有 Job handle。
4. Supervisor 崩溃或关闭 own handle。
5. Job handle 总数仍大于 0。
6. KILL_ON_JOB_CLOSE 不触发。
7. Helper 恢复后可能继续持有旧 Grant/文件 handle。
8. 新 Supervisor 不能仅凭进程名/Service 状态证明旧 Helper 已退出。
```

即使新 Supervisor 将 DB Operation 标记 `UNKNOWN`，旧 Helper 仍可能已经或
即将产生文件系统效果。R4-S5 声称的 “Supervisor crash => Job kill” 不能成立。

### 7.3 附加 Job 缺口

- `CreateJobObject` 对同名已有 Job 返回既有 handle 并设置
  `ERROR_ALREADY_EXISTS`；R4-S5 没有要求检查，存在命名 Job 抢占/错误的
  安全边界。
- `CreateJobObject` 返回 handle 通常具有全部 access；Helper 保留 handle 时，
  Supervisor 无法仅靠 `KILL_ON_JOB_CLOSE` 获得独占终止权。
- `Job Objects` 官方说明 `Win32_Process.Create` 创建的进程不自动进 Job；
  Process Mitigation 也没有被官方文档证明能覆盖所有代理创建路径。
- Helper 若由共享 service host 托管，独立 service SID、single active process
  和退出证明都需要重新设计；R4-S5 没有明确 `SERVICE_WIN32_OWN_PROCESS`。

### 7.4 最小设计修复

优先使用独立 launcher：

```text
Supervisor / Launch Authority
  -> CreateProcessAsUser with fixed release
  -> create Job
  -> assign process before first user instruction
  -> close launcher/helper Job handles
  -> Supervisor retains sole Job handle
  -> IsProcessInJob verification
  -> handle inheritance disabled
```

或至少规定：

- Helper 加入 Job 后在同一启动函数中关闭所有自身 Job handles；
- Supervisor 持有唯一 association/kill handle；
- `CreateJobObject` 检查 `ERROR_ALREADY_EXISTS`；
- `TerminateJobObject`/handle close 所需 rights 明确；
- Supervisor crash、Helper pause、Helper exit 三条路径都有真实故障注入；
- Job 不是 child process 的唯一证明，WMI/代理创建路径必须被禁止或列入 TCB。

## 8. SEALED 独立回归

### 8.1 P1：Owner 隐含 WRITE_DAC

官方文档明确：

```text
对象 owner 隐式具有 WRITE_DAC
owner 可修改 DACL 并控制对象访问
```

R4-S5 的关键句：

```text
Canonical Guardian：只读 owner
canonical DACL 拒绝 write-DAC
```

两者不能直接共存。仅仅把 canonical target 的 owner 设为 Canonical Guardian，
并不会使它成为只读主体；Guardian 只要能被激活到进程/token，就可以重写 DACL，
再给自己授予写权限。R4-S5 也没有使用 Owner Rights SID `S-1-3-4` 显式阻断。

此外，若 Supervisor 或 Storage Owner 是 canonical/ancestor 的 owner，也存在
同类隐式 `WRITE_DAC` 路径。R4-S5 的 “Supervisor 只有 read” 与 owner 标签
没有完整对账。

### 8.2 P1 失败状态

```text
SEALED_ACL_CLAIM:
NOT PROVEN

Canonical/Ancestor Owner Rights:
UNDEFINED

Potential file modification after sealing:
YES, subject to owner activation / DACL rewrite
```

### 8.3 最小设计修复

- 在 canonical target、父目录和必需祖先上设置受保护 DACL；
- 对 Owner Rights SID `S-1-3-4` 设置显式 deny：
  `WRITE_DAC`、`WRITE_OWNER`、`WRITE_DATA`、`APPEND_DATA`、
  `WRITE_ATTRIBUTES`、`DELETE`；
- 或使用不可激活、不可登录的专用 owner identity，并证明其没有进程；
- 明确 Storage Root owner 和 ancestor owner；
- 用真实 Windows 测试验证 owner 无法自授权、父目录无法 delete child；
- 不能用“数据库 lifecycle=ACTIVE”或“名字存在”代替 OS ACL 事实。

在修复并实机验证前，P1-3 SEALED 必须为 `REGRESSION FOUND / OPEN`。

## 9. Operation Grant 审查

设计意图仍成立：

```text
DB-issued Grant
+ Helper-local reserve
+ Operation/generation/storageKey/action/helperType/release digest
+ CAS/unique active Grant
+ dual Evidence
```

正向结论：

- IPC 身份不替代 Grant；
- Grant 目标不由 Supervisor payload 任意指定；
- Helper 以独立 DB role reserve；
- 新 target 的 FileId 只能作为创建后 Evidence 输出，不能提前伪造；
- duplicate reserve 有 DB CAS 设计；
- old epoch/generation 可拒绝。

仍为设计/验证缺口：

- Grant schema、partial unique、Trigger、role、`SECURITY DEFINER` 的 SQL
  ownership、`search_path` 和 `PUBLIC EXECUTE` 撤销未落地；
- `p13_report_helper_effect` 的幂等和终态重复报告规则未给出完整 SQL；
- process lifetime 与 Grant 的链接在 DB 侧只能通过 RPC Supervisor
  attestation，不能代替实际 OS process handle；
- DB Owner/超级用户仍在 TCB；
- grant token/lease 不能撤销已打开的文件 handle，R4-S5 已正确说明。

本轮未发现新的 Grant P1；但“设计字段存在”不等于 DB 行为已经验证。

## 10. Signed Release 回归

```text
REGRESSION: PASS / DESIGN
RUNTIME: NOT VERIFIED
```

保留：

- 固定 service/executable；
- Signed manifest；
- executable/dependency/config digest；
- argument/environment/cwd allowlist；
- WDAC/Code Integrity；
- Grant release digest；
- Supervisor 不得任意启动 executable。

R4-S5 没有把以下事项变成已通过：

- WDAC 策略实际启用；
- 签名验证和 SCM 启动之间的替换窗口；
- helper DLL/依赖加载路径；
- Production Trust Root；
- Release root ACL。

## 11. Evidence 回归

```text
REGRESSION: PASS / DESIGN
RUNTIME / DB: NOT VERIFIED
```

双证据设计仍保留：

```text
Helper Effect Evidence
+ Supervisor Verification Evidence
+ matching Operation/Grant
=> DB APPLIED / DELETED
```

限制：

- Helper Effect 必须由 Helper 独立 DB role 写入；
- Supervisor 独立只读复核；
- 单侧伪造不能自动完成同一 terminal transaction；
- Supervisor/DB Owner/Helper 同时失陷仍为 TCB 失效；
- Evidence 的 process lifetime/Session/epoch 字段还没有 Schema 实现。

## 12. DELETED 回归

```text
REGRESSION: PASS / DESIGN
RUNTIME: NOT VERIFIED
```

仍保持：

```text
DELETED = Controlled Namespace Removal Completed
```

没有证据被提升为：

- 所有外部 handle 已关闭；
- memory map 已解除；
- 物理介质擦除；
- 存储块立即回收；
- 外部服务没有任何缓存副本。

因此 DELETED 业务语义没有出现严重回归。

## 13. R4-S4 八个 P2 重新核验

### R4S4-P2-01 Linux socket directory

```text
FINAL: OUT OF SCOPE
```

Linux 已退出 V1；原问题不再是 Windows V1 验收项。未来 Linux 重新进入时必须
重新设计 socket directory、UID/GID 和 peer credential。

### R4S4-P2-02 Named Pipe DACL rights

```text
FINAL: OUT OF SCOPE / REPLACED
```

Named Pipe 已被 `ncalrpc` 淘汰，原 Pipe rights 不再适用。但这不意味着新 RPC
ACL 已闭合；新 RPC interface/endpoint security descriptor rights 和 process
DACL 作为新 `R4S6-P2-03` 仍然 OPEN。

### R4S4-P2-03 Grant SECURITY DEFINER

```text
FINAL: DESIGN CLOSED / IMPLEMENTATION NOT VERIFIED
```

R4-S5 给出 owner、search_path、PUBLIC revoke、单 role EXECUTE 和
`session_user` 规则，但实际函数、权限和 Trigger 未实现/未测试。

### R4S4-P2-04 HMAC lifecycle

```text
FINAL: OUT OF SCOPE
```

HMAC 不再承担身份授权。未来若引入 MAC，其 key 生命周期不能重新成为身份
凭证。

### R4S4-P2-05 WDAC / Code Integrity

```text
FINAL: NOT VERIFIED
```

R4-S5 只定义了目标，没有证明 WDAC 策略、签名、依赖加载和替换窗口。

### R4S4-P2-06 Helper DB Credential

```text
FINAL: DESIGN CLOSED / PROVISIONING NOT VERIFIED
```

集成 Windows/DB login 或 service-SID-scoped secret 的设计方向可接受，但
实际 PostgreSQL login、角色映射、轮换和撤销未实现。

### R4S4-P2-07 NTFS durability / Delete Pending / memory map

```text
FINAL: NOT VERIFIED
```

仍不能用 ACL/名称/数据库状态证明物理回收；必须在实机 NTFS 上验证。

### R4S4-P2-08 v1/v2 Drain

```text
FINAL: NOT VERIFIED
```

没有 ACL、进程退出、旧 Session/Helper drain 的实际证据。

## 14. 20 条攻击路径重新推演

| # | 攻击前提与步骤 | 防御机制 | 官方/架构依据 | TCB 依赖 | 失败状态 | Windows 实机 | 结论 |
|---:|---|---|---|---|---|---|---|
| 1 | B 复制 A 的 RPC Binding Handle，尝试调用 | 每 call 查询 ClientPID + Session tuple | RPC V2 ClientPID；callback 非逐调用保证 | RPC runtime | SESSION_STALE | 必须 | **OPEN**，检查点未固定 |
| 2 | B 复制 A 的 Process Handle | 复制 handle 不能改变 ClientPID；B 的新调用仍映射 B | `DuplicateHandle` 只复制对象 handle | OS kernel | DENIED | 必须 | 设计可阻断身份冒用 |
| 3 | B 获得 A 的客户端凭证 | 同 SID 仍需当前 process handle/creation time | Access Tokens/OpenProcess | OS | DENIED | 必须 | 可阻断跨进程委托 |
| 4 | B 使用复制的 Binding Handle 发 RPC | 每次 manager wrapper 重新取当前 ClientPID | RPC call attrs | RPC runtime | SESSION_STALE | 必须 | **OPEN**，wrapper 未强制 |
| 5 | B 伪造 ClientPID/A payload | payload PID 不读取；只用 RPC runtime ClientPID | V2 文档 | RPC runtime | DENIED | 必须 | 设计方向可接受 |
| 6 | A 退出后 B 继续持旧 handle | held process handle signaled；Session revoke | process handle 生命周期 | Windows kernel | REVOKED | 必须 | 设计可阻断，需实测 |
| 7 | PID 重用给 B | 比对 creation time 与 held handle | GetProcessTimes | OS | DENIED | 必须 | 设计可阻断 |
| 8 | Creation time 不匹配 | 拒绝并撤销 Session | GetProcessTimes | OS | SESSION_STALE | 必须 | 设计可阻断 |
| 9 | Token/SID 与 RPC Principal 不匹配 | 必须绑定同一 allowlisted process/principal class | Access Tokens/RPC auth | RPC/OS | DENIED | 必须 | **P2 OPEN**，一致性规则未写死 |
| 10 | 错误使用 impersonation token | finally revert；不把 thread token 带到 DB/Storage | RpcImpersonate/Revert/OpenThreadToken | server thread | DENIED/UNKNOWN | 必须 | **P2 OPEN**，生命周期不完整 |
| 11 | Supervisor 重启后旧 Session 重放 | epoch 变化；新 endpoint/session；旧 grant revoke | R4-S5 lifecycle | Supervisor/DB | AUTHORITY_STALE | 必须 | 设计可阻断 |
| 12 | Helper 暂停，DB lease 过期 | Job kill/terminate；Grant revoke；UNKNOWN | Job/DB | Supervisor/OS/DB | UNKNOWN | 必须 | **P1 OPEN**，Job handle 未闭合 |
| 13 | Helper 终止但其他进程持文件句柄 | 退出证明，SEALED 需无外部写 handle | Windows handle semantics | Supervisor/OS | UNKNOWN/FAILED_RETAINED | 必须 | 设计尝试 fail-closed，但没有可靠枚举证明 |
| 14 | Release/依赖替换 | WDAC + signed manifest + fixed path + release digest | WDAC/R4-S3 | Trust Root/OS | RELEASE_REJECTED | 必须 | 设计保持，运行时 NOT VERIFIED |
| 15 | Grant 重复消费 | unique active Grant + CAS + consumed state | PostgreSQL/Schema design | DB | GRANT_REJECTED | 必须 | 设计可阻断，DB 未实现 |
| 16 | Helper 访问其他 storageKey | DB target + parent/object identity + ACL | Grant/FS | DB/FS | FAILED_RETAINED | 必须 | 设计可阻断 |
| 17 | Supervisor 直接操作 Storage | Supervisor ACL 只读；Helper-only write | Windows ACL | OS ACL | ACCESS_DENIED | 必须 | **P1 OPEN**，owner/ancestor implicit WRITE_DAC 未解决 |
| 18 | Publisher/Sealer 生命周期交叠 | Publisher exit proof before Sealer Grant | process handle/DB state | Supervisor/DB | PUBLISHER_ACTIVE | 必须 | 设计方向可阻断，Job 缺口影响退出证明 |
| 19 | Cleanup 与新一代对象竞争 | generation/target/parent identity/DB CAS | lifecycle/Grant | DB/FS | AUTHORITY_STALE | 必须 | 设计可阻断 |
| 20 | Helper/ Supervisor Evidence 不匹配 | dual evidence + terminal transaction | Evidence design | DB/Supervisor | EVIDENCE_MISMATCH | 必须 | 设计可阻断，Schema 未实现 |

### 14.1 额外攻击路径

#### X1. Owner Rights DACL rewrite

```text
Canonical Guardian owner
  -> modify DACL
  -> grant itself write access
  -> modify sealed canonical
```

官方 `Owner of a New Object` 明确 owner 隐式 `WRITE_DAC`。R4-S5 未加入
Owner Rights deny；结论：**P1 OPEN**。

#### X2. Named Job squatting

```text
Attacker knows epoch/type
  -> pre-creates named Job
  -> Supervisor CreateJobObject returns existing object / ERROR_ALREADY_EXISTS
  -> unexpected limits/DACL or DoS
```

官方 `CreateJobObjectW` 说明同名对象会返回既有 handle。结论：**P2 OPEN**。

#### X3. Out-of-Job process creation

```text
Helper or proxy calls Win32_Process.Create
  -> child is not automatically associated with Job
  -> child may survive Helper exit
```

官方 Job Objects 文档明确该路径不默认关联。结论：**P2 OPEN**；如果 Helper
具有任意 WMI/代理执行能力，需重新进入 P1 评估。

#### X4. Interface callback frequency

```text
Server relies on callback for per-call check
  -> callback not guaranteed exactly once per call
  -> later call reaches manager without fresh identity check
```

官方 callback 文档提供依据。结论：**P1-C OPEN**。

## 15. 新发现

### P1

| ID | Finding | 影响 | 最小修复 |
|---|---|---|---|
| `R4S6-P1-01` | 每调用身份检查可被放在不保证逐调用执行的 RPC callback | 后续 `B` 调用可能只复用旧 Session | manager 统一 wrapper 每调用查询 V2 attributes，callback 仅粗过滤 |
| `R4S6-P1-02` | Helper 自持/可重开 Job handle，`KILL_ON_JOB_CLOSE` 不保证 Supervisor crash 终止 | paused Helper 可继续持旧 Grant/文件 handle | launcher 预分配或在 startup 立即关闭全部 Helper Job handles；Supervisor 持唯一 kill handle；实机验证 |
| `R4S6-P1-03` | Canonical Guardian/owner 的隐式 `WRITE_DAC` 未被阻断 | SEALED canonical 可被 owner 重新授权写/删 | Owner Rights SID `S-1-3-4` deny DAC/owner/data/delete + 祖先对账 + 实机验证 |

### P2

| ID | Finding | 当前状态 |
|---|---|---|
| `R4S6-P2-01` | `RpcImpersonateClient`/`RpcRevertToSelf` 的异常安全、线程隔离、token close 未固定 | OPEN / DESIGN |
| `R4S6-P2-02` | RPC Principal、process token SID、ClientPID 必须属于同一 caller class 的规则未写死 | OPEN / DESIGN |
| `R4S6-P2-03` | `ncalrpc` interface/endpoint SecurityDescriptor、process DACL 和 `OpenProcess` 跨 SID rights 未指定或验证 | NOT VERIFIED |
| `R4S6-P2-04` | Named Job 的 `ERROR_ALREADY_EXISTS`、DACL、terminate/close rights 未定义 | OPEN / DESIGN |
| `R4S6-P2-05` | Job 不覆盖 `Win32_Process.Create` 等代理创建路径；`NoChildProcessCreation` 覆盖范围未验证 | NOT VERIFIED |
| `R4S6-P2-06` | DACL 更新不会关闭既有写 handle；设计没有可执行的“无外部 handle”证明或初始 DACL/`PROCESS_DUP_HANDLE` 约束 | OPEN |
| `R4S6-P2-07` | RPC 方法/OpNum 到 WEB/WORKER/四类 Helper 的授权矩阵未明确 | OPEN / DESIGN |
| `R4S6-P2-08` | Helper service 是否使用 own-process，SCM `SERVICE_STATUS_PROCESS` pending 状态和进程 ID 失效规则未固定 | OPEN / VERIFICATION |
| `R4S6-P2-09` | Grant/Evidence/Schema/Trigger/role 未实现，无法证明真实 DB 原子性 | DESIGN / NOT VERIFIED |

### P3

- RPC principal buffer 出现 `ERROR_MORE_DATA` 时应有上限、重试或拒绝策略；
- 所有 token/process/job handle 应在异常路径 RAII/CloseHandle；
- Service status 只能辅助诊断，不能作为 process exit proof；
- Owner/ancestor DACL 的继承顺序和显式 deny 需要 golden access-check 测试。

## 16. TCB 重新评估

| 组件 | 当前信任结论 |
|---|---|
| Windows Kernel/SRM | TCB；kernel/SRM compromise 超出保证 |
| ncalrpc/RPC runtime | 设计依赖其 ClientPID/auth 契约；version/runtime 未验证 |
| Authority Supervisor | TCB 的一部分；可 DoS/伪造 Supervisor Evidence；不得直接写 Storage |
| RPC callback + manager wrapper | callback 不能单独作为 P1-C proof；wrapper 必须逐调用 |
| Helper binary/Release | TCB；WDAC/signature 未验证 |
| Helper OS identity | 独立身份设计存在；ACL/token/service 配置未验证 |
| Job Object/SCM | 只能辅助生命周期；Job handle 和进程创建路径缺口为 P1/P2 |
| Storage Root/NTFS | owner implicit WRITE_DAC 和 DACL/new handle 语义未闭合 |
| DB Grant issuer | 设计 issuer 约束存在；DB Owner 仍是 TCB |
| Evidence persistence | 双证据设计存在；schema/trigger 未实现 |
| Release Trust Root | 未配置/未验证 |
| Recovery Operator | 人工 UNKNOWN/retained 处理仍需独立授权 |

TCB 结论：

```text
DESIGN-LEVEL RPC PRIMITIVE:
PARTIALLY SUPPORTED

CORE OS AUTHORITY:
NOT CLOSED

IMPLEMENTATION:
NOT PRESENT

WINDOWS RUNTIME:
NOT VERIFIED
```

## 17. Windows 实机验证缺口

后续获授权时至少需要：

1. `ncalrpc` ClientPID 在同一 call、并发 call、async call 下的真实结果；
2. RPC callback 调用次数实验，证明 manager wrapper 才是逐调用门禁；
3. `RpcImpersonateClient` 返回 `RPC_S_CANNOT_SUPPORT`/identify level 时的
   fail-closed；
4. process DACL、`OpenProcess`、`OpenProcessToken`、token close；
5. PID reuse、A exit、B binding/handle replay；
6. same SID/different PID、token delegation、RPC principal mismatch；
7. SCM own-process、service status pending、process ID 失效；
8. `CreateJobObject` 同名抢占、Job DACL、helper handle 保留/关闭；
9. Supervisor crash、paused Helper、TerminateJobObject、Job membership；
10. `Win32_Process.Create`/WMI、process mitigation、child process policy；
11. Windows owner implicit WRITE_DAC、Owner Rights SID deny、父目录 delete-child；
12. `DuplicateHandle` 与既有写 handle、`SEALED` DACL 更新后的 handle 行为；
13. WDAC/Release/DLL search/Code Integrity；
14. NTFS Delete Pending、memory-mapped file、directory durability；
15. DB Grant/SECURITY DEFINER/role/Trigger/临时测试库；
16. A4 Web/Worker、A6 Manifest、legacy artifact isolation 回归。

本阶段没有执行上述任何一项。

## 18. Windows-only 平台范围

```text
Windows V1:
ONLY TARGET / DESIGN REVIEWED

Linux:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED

Production topology:
NOT VERIFIED

Linux re-entry:
separate design + implementation + review + real-Linux validation REQUIRED
```

R4-S5 没有把 Linux 作为 Windows 通过条件；本轮保持这一边界。

## 19. 两轮独立复核

### 第一轮：攻击与 TCB

- 独立重建 B/A handle/credential 攻击；
- 确认 ClientPID 来源正确但不能替代逐调用位置；
- 确认 callback 不能作为唯一逐调用门禁；
- 确认 Job 最后 handle 语义；
- 确认 owner 隐式 WRITE_DAC；
- 确认 Grant/Evidence/Release 的既有设计未被无证据回退；
- 确认 P1-C、P1-4、SEALED 均存在未闭合核心问题。

结果：`FAIL`。

### 第二轮：跨章节一致性

- RPC `ClientPID` 与 Session/process tuple 的文档意图一致；
- 但 callback、manager wrapper、impersonation/revert、principal/token class
  关系不一致或不足；
- Job 创建/加入/退出/崩溃/暂停在状态机与实现契约之间不闭合；
- Canonical Guardian owner 与“read-only owner”文字冲突；
- Evidence/SEALED/DELETED 名义语义保持，但 SEALED 的 OS 权限证明失效；
- Linux 范围一致；
- 所有 runtime/DB/ACL 项仍为 NOT VERIFIED。

结果：`INTERNAL CONSISTENCY FAIL / DESIGN BLOCKED`。

## 20. R4 Design Freeze 判断

```text
R4 DESIGN FREEZE:
NOT APPROVED
```

原因：

- P1-C 每请求身份门禁未固定在官方保证的逐调用执行点；
- P1-4 Job handle 导致 Supervisor crash termination 不成立；
- SEALED 的 owner `WRITE_DAC` 隐式权限未处理；
- 新 P1 不能由本轮自行修复；
- Windows/DB/ACL runtime 全部未验证。

即使后续修复上述 P1，也只能重新提交独立审查；本报告不构成 R4-S7 授权。

## 21. 工作树 Before / After

Before：

```text
Tracked modified: 26
Untracked files: 154
Staged: 0
Deleted: 0
```

After（计划仅新增本报告）：

```text
Tracked modified: 26
Untracked files: 155
Staged: 0
Deleted: 0
```

本阶段没有修改：

- R4-S1 至 R4-S5 历史文档
- FZ、ST、DBTP
- Prisma Schema / Migration
- Storage / Worker / Web 源码
- `apps/web/next-env.d.ts`
- `apps/web/tsconfig.tsbuildinfo`
- `.next`、Worker `dist`
- Git index

新增报告 SHA-256 在报告冻结后计算，由最终交付消息提供；报告不能安全写入
自身哈希值。

## 22. 最终审查字段

```text
A7.20-R4-S6:
FAIL

R4S4-P1-C Per-request IPC Authentication:
OPEN

R4S4-P1-4 Helper Process Model:
OPEN

P1-A Operation Grant:
PASS / DESIGN / DB NOT IMPLEMENTED

P1-B Signed Release:
PASS / DESIGN / RUNTIME NOT VERIFIED

P1-2 Evidence:
PASS / DESIGN / IMPLEMENTATION NOT VERIFIED

P1-3 SEALED:
REGRESSION FOUND / OPEN

P1-5 DELETED:
PASS / DESIGN

NEW P1:
3

NEW P2:
9

NEW P3:
4

WINDOWS RUNTIME:
NOT VERIFIED

LINUX:
OUT OF SCOPE / NOT IMPLEMENTED / NOT VERIFIED

R4 DESIGN FREEZE:
NOT APPROVED

R4-S7 / R4-A / R4-B:
NOT AUTHORIZED

SCHEMA V2 / MIGRATION / SQL:
NOT AUTHORIZED

DATABASE / STORAGE / ACL / CLEANUP / RECOVERY:
NOT EXECUTED / NOT AUTHORIZED

GIT WRITE OPERATIONS:
NOT EXECUTED

GIT COMMIT:
NOT AUTHORIZED

DEPLOYMENT:
NOT AUTHORIZED

NEXT PHASE:
NOT AUTHORIZED
```
