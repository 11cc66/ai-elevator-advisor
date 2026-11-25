# P1-3 C-6.2-L8-A7.20-R4-A1 Authority / RPC Identity Implementation Design

## 0. Status

```text
Stage: C-6.2-L8-A7.20-R4-A1
Mode: IMPLEMENTATION + ISOLATED VALIDATION
Windows native ncalrpc: BLOCKED
Logical authority identity core: IMPLEMENTED / TESTED
Restricted Token / ACL / Job / Storage / DB: NOT AUTHORIZED
```

This stage implements a transport-neutral Authority identity/session core and
its deterministic tests. It does not create a native RPC server or claim that
the mock evidence was produced by `ncalrpc`.

## 1. Scope

Implemented package:

```text
packages/authority-core/
  package.json
  tsconfig.json
  tsconfig.build.json
  src/types.ts
  src/identity.ts
  src/session-store.ts
  src/server.ts
  src/index.ts
  tests/authority-identity.test.ts
```

Not implemented:

- Windows native RPC server/client.
- MIDL IDL and generated stubs.
- `RpcServerInqCallAttributes` adapter.
- Real Windows process handle/token evidence provider.
- Windows Service, Job Object, Restricted Token, ACL, Helper, Storage, DB.

## 2. Authority Identity Model

The logical model contains four authorities:

| Authority | Authority ID | Endpoint |
|---|---|---|
| Staging Writer | `p13.staging-writer` | `p13-launch-staging-writer-v1` |
| Publisher | `p13.publisher` | `p13-launch-publisher-v1` |
| Sealer | `p13.sealer` | `p13-launch-sealer-v1` |
| Cleanup | `p13.cleanup` | `p13-launch-cleanup-v1` |

An `AuthorityBinding` contains:

- authority ID and type;
- RPC endpoint;
- expected Authority principal;
- expected service SID;
- expected restricting SID.

The server rejects a call when the trusted process evidence does not contain
the expected principal/service/restricting SID, even if the endpoint matches.

## 3. Trusted Call Evidence

`RpcCallEvidence` is a transport-facing evidence contract, not a client
payload. It contains:

```text
endpoint
transport = ncalrpc
authenticationService = WINNT
authenticationLevel = PKT_PRIVACY
clientPid
rpcPrincipal
process:
  processId
  processHandleKey
  creationTime
  userSid
  principal
  serviceSid
  restrictedSids
  integrityLevel
  windowsSessionId
```

Current `processHandleKey` is a logical test identifier. It is **not** a Windows
kernel handle. A future native adapter must replace/qualify it with a
server-owned process handle identity and must keep the handle for the session
lifetime.

Client request data cannot provide authoritative PID, SID, token, handle or
creation time. The request only declares operation, request ID, authority ID,
session ID, epoch and payload.

## 4. Single Public Gateway

`AuthorityServer.invoke` is the only public gateway:

```text
invoke
  -> #authorizeCurrentCall
  -> #dispatch
```

The authorization method and dispatcher are ECMAScript private methods.
`Authorization Before Dispatch` is unconditional for every call.

The dispatcher only executes after:

- endpoint matches the server binding;
- declared authority matches the server binding;
- operation is in the allowlist;
- trusted call evidence passes the identity provider;
- process principal/service/restricting SID matches the authority binding;
- Session exists and is active for non-registration operations;
- Session authority, process identity and epoch match;
- request is not replayed.

Failure returns an error before the authorized-effect callback.

## 5. Operations

Implemented logical operations:

```text
SESSION_REGISTER
SESSION_CLOSE
SESSION_REVOKE
ECHO
```

They intentionally have no Storage, DB, Helper, Job, Publication or Cleanup
side effects. `ECHO` is a no-side-effect validation operation.

## 6. Identity Checks

`StrictRpcIdentityProvider` rejects:

- null RPC session;
- kernel-mode caller;
- non-`ncalrpc` transport;
- missing/incorrect WINNT + `PKT_PRIVACY`;
- missing client PID/process evidence;
- PID mismatch between RPC evidence and process evidence;
- RPC principal and process principal mismatch;
- missing process handle key/creation time/user/service SID;
- missing restricted SID evidence.

`AuthorityServer` adds expected authority principal, service SID and restricting
SID checks.

## 7. Sessions / Epoch / Replay

`MemoryAuthoritySessionStore` provides deterministic test semantics:

- session binds authority, process evidence and epoch;
- closed/revoked sessions cannot be reactivated;
- sessions are authority-specific;
- process creation/handle key changes cause session rejection;
- epoch mismatch fails;
- per-authority request journal detects replay and conflicting reuse.

This store is in-memory only. It does not represent crash persistence or
database atomicity.

## 8. Test Design

The suite covers 11 cases:

1. valid call with callback absent;
2. endpoint/authority mismatch;
3. null/kernel callers;
4. incomplete process identity;
5. RPC principal/ClientPID mismatch;
6. foreign Authority token binding;
7. process handle/creation-time mismatch after PID reuse;
8. missing/closed sessions;
9. stale epoch;
10. replay/conflict;
11. no authorized effect on failure;
12. four-authority session isolation;
13. concurrent distinct requests.

These are unit/integration logical tests, not Windows ncalrpc runtime evidence.

## 9. Native Adapter Contract for a Later Phase

A future native adapter must not expose `RpcCallEvidence` to ordinary
application code. It must:

1. own the native RPC binding;
2. obtain call attributes per call;
3. open the current Process Handle and read creation time;
4. read process Token User/Groups/Integrity/Session;
5. validate RPC principal against the process principal;
6. keep a server-owned process handle for the session;
7. pass an opaque verified context to the server;
8. reject if any API result is incomplete or stale;
9. never accept client-supplied identity fields.

The TypeScript `RpcCallEvidence` object must be treated as the trusted adapter's
output only. It is not a public application API.

## 10. Runtime Status

```text
TypeScript logical core: PASS
Logical identity/session tests: 11 PASS
Native ncalrpc server/client: NOT IMPLEMENTED
Native RPC ClientPID/token runtime: BLOCKED
Windows process handle lifecycle: NOT IMPLEMENTED
Restricted Token / ACL / Job / Storage / DB: NOT AUTHORIZED
```

## 11. Final R4-A1 Status

```text
R4-A1:
BLOCKED

R4-A1 logical core:
PASS

R4-A1 native ncalrpc runtime:
BLOCKED / NOT VERIFIED

R4-A2:
NOT ELIGIBLE
```

The source package is a useful transport-neutral starting point, but not a
production Authority implementation.
