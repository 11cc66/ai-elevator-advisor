import { describe, expect, it } from "vitest";
import {
  AuthorityServer,
  MemoryAuthoritySessionStore,
  StrictRpcIdentityProvider,
  type AuthorityBinding,
  type AuthorityRequest,
  type ProcessIdentityEvidence,
  type RpcCallEvidence,
} from "../src/index.js";

const processFor = (
  authority: "STAGING_WRITER" | "PUBLISHER" | "SEALER" | "CLEANUP",
  processId = 4100,
): ProcessIdentityEvidence => {
  const key = authority.toLowerCase().replace("_", "-");
  return {
    processId,
    processHandleKey: `handle-${key}-${processId}`,
    creationTime: `creation-${key}-${processId}`,
    userSid: `S-1-5-21-${key}`,
    principal: `svc_${key}`,
    serviceSid: `S-1-5-80-${key}`,
    restrictedSids: [`S-1-5-32-${key}`],
    integrityLevel: "Medium",
    windowsSessionId: 0,
  };
};

const bindingFor = (
  authority: "STAGING_WRITER" | "PUBLISHER" | "SEALER" | "CLEANUP",
): AuthorityBinding => {
  const suffix = authority.toLowerCase().replace("_", "-");
  return {
    authorityId: `p13.${suffix}` as AuthorityBinding["authorityId"],
    authorityType: authority,
    endpoint: `p13-launch-${suffix}-v1`,
    expectedPrincipal: `svc_${suffix}`,
    expectedServiceSid: `S-1-5-80-${suffix}`,
    expectedRestrictedSid: `S-1-5-32-${suffix}`,
  };
};

const callFor = (
  binding: AuthorityBinding,
  process: ProcessIdentityEvidence,
  overrides: Partial<RpcCallEvidence> = {},
): RpcCallEvidence => ({
  endpoint: binding.endpoint,
  transport: "ncalrpc",
  authenticationService: "WINNT",
  authenticationLevel: "PKT_PRIVACY",
  clientPid: process.processId,
  rpcPrincipal: process.principal,
  nullSession: false,
  kernelModeCaller: false,
  process,
  callbackObserved: false,
  ...overrides,
});

const requestFor = (
  binding: AuthorityBinding,
  requestId: string,
  overrides: Partial<AuthorityRequest> = {},
): AuthorityRequest => ({
  operation: "SESSION_REGISTER",
  requestId,
  authorityId: binding.authorityId,
  ...overrides,
});

const setup = (
  authority: "STAGING_WRITER" | "PUBLISHER" | "SEALER" | "CLEANUP",
) => {
  const binding = bindingFor(authority);
  const process = processFor(authority);
  const store = new MemoryAuthoritySessionStore();
  let effects = 0;
  const server = new AuthorityServer({
    binding,
    identityProvider: new StrictRpcIdentityProvider(),
    sessions: store,
    epoch: 7,
    onAuthorizedEffect: () => {
      effects += 1;
    },
  });
  const call = (overrides: Partial<RpcCallEvidence> = {}) =>
    callFor(binding, process, overrides);
  const register = (requestId = "req-register") =>
    server.invoke(call(), requestFor(binding, requestId));
  return { binding, process, store, server, call, register, effects: () => effects };
};

describe("authority per-call identity and session isolation", () => {
  it("authorizes a valid call even when the callback was not observed", () => {
    const env = setup("PUBLISHER");
    const registered = env.register();
    expect(registered.ok).toBe(true);
    if (!registered.ok) throw new Error("registration failed");

    const result = env.server.invoke(
      env.call({ callbackObserved: false }),
      {
        operation: "ECHO",
        requestId: "req-echo",
        authorityId: env.binding.authorityId,
        sessionId: registered.sessionId,
        epoch: 7,
        payload: { message: "ok" },
      },
    );
    expect(result).toEqual({
      ok: true,
      operation: "ECHO",
      authorityId: "p13.publisher",
      sessionId: registered.sessionId,
      result: "p13.publisher:ok",
    });
  });

  it("rejects an authority endpoint and request-authority mismatch", () => {
    const env = setup("PUBLISHER");
    const wrongEndpoint = env.server.invoke(
      env.call({ endpoint: "p13-launch-sealer-v1" }),
      requestFor(env.binding, "req-wrong-endpoint"),
    );
    expect(wrongEndpoint).toMatchObject({ ok: false, code: "AUTHORITY_MISMATCH" });

    const wrongAuthority = env.server.invoke(
      env.call(),
      {
        ...requestFor(env.binding, "req-wrong-authority"),
        authorityId: "p13.sealer",
      },
    );
    expect(wrongAuthority).toMatchObject({ ok: false, code: "AUTHORITY_MISMATCH" });
  });

  it("rejects null/kernel callers and incomplete process identity", () => {
    const env = setup("STAGING_WRITER");
    expect(
      env.server.invoke(
        env.call({ nullSession: true }),
        requestFor(env.binding, "req-null"),
      ),
    ).toMatchObject({ ok: false, code: "PROCESS_IDENTITY_MISMATCH" });
    expect(
      env.server.invoke(
        env.call({ kernelModeCaller: true }),
        requestFor(env.binding, "req-kernel"),
      ),
    ).toMatchObject({ ok: false, code: "PROCESS_IDENTITY_MISMATCH" });
    expect(
      env.server.invoke(
        env.call({
          process: { ...env.process, restrictedSids: [] },
        }),
        requestFor(env.binding, "req-no-restricted"),
      ),
    ).toMatchObject({ ok: false, code: "PROCESS_IDENTITY_MISMATCH" });
  });

  it("rejects RPC principal and ClientPID impersonation", () => {
    const env = setup("PUBLISHER");
    expect(
      env.server.invoke(
        env.call({ rpcPrincipal: "svc_sealer" }),
        requestFor(env.binding, "req-principal"),
      ),
    ).toMatchObject({ ok: false, code: "PROCESS_IDENTITY_MISMATCH" });
    expect(
      env.server.invoke(
        env.call({ clientPid: 99999 }),
        requestFor(env.binding, "req-pid"),
      ),
    ).toMatchObject({ ok: false, code: "PROCESS_IDENTITY_MISMATCH" });
  });

  it("rejects a valid process token from another Authority binding", () => {
    const env = setup("PUBLISHER");
    const foreignProcess = processFor("SEALER");
    const result = env.server.invoke(
      env.call({ process: foreignProcess, rpcPrincipal: foreignProcess.principal }),
      requestFor(env.binding, "req-foreign-token"),
    );
    expect(result).toMatchObject({ ok: false, code: "PROCESS_IDENTITY_MISMATCH" });
  });

  it("binds a session to the original process creation time, not PID alone", () => {
    const env = setup("SEALER");
    const registered = env.register();
    if (!registered.ok) throw new Error("registration failed");

    const reusedPid = {
      ...env.process,
      processHandleKey: "new-handle",
      creationTime: "new-creation-time",
    };
    const result = env.server.invoke(
      env.call({ process: reusedPid }),
      {
        operation: "ECHO",
        requestId: "req-reused-pid",
        authorityId: env.binding.authorityId,
        sessionId: registered.sessionId,
        epoch: 7,
      },
    );
    expect(result).toMatchObject({ ok: false, code: "SESSION_PROCESS_MISMATCH" });
  });

  it("rejects missing, closed and revoked sessions", () => {
    const env = setup("CLEANUP");
    expect(
      env.server.invoke(env.call(), {
        operation: "ECHO",
        requestId: "req-missing",
        authorityId: env.binding.authorityId,
        sessionId: "missing",
        epoch: 7,
      }),
    ).toMatchObject({ ok: false, code: "SESSION_NOT_FOUND" });

    const registered = env.register();
    if (!registered.ok) throw new Error("registration failed");
    expect(
      env.server.invoke(env.call(), {
        operation: "SESSION_CLOSE",
        requestId: "req-close",
        authorityId: env.binding.authorityId,
        sessionId: registered.sessionId,
        epoch: 7,
      }).ok,
    ).toBe(true);
    expect(
      env.server.invoke(env.call(), {
        operation: "ECHO",
        requestId: "req-after-close",
        authorityId: env.binding.authorityId,
        sessionId: registered.sessionId,
        epoch: 7,
      }),
    ).toMatchObject({ ok: false, code: "SESSION_CLOSED" });
  });

  it("rejects stale epochs and request replay/conflict", () => {
    const env = setup("PUBLISHER");
    const registered = env.register("req-session");
    if (!registered.ok) throw new Error("registration failed");

    expect(
      env.server.invoke(env.call(), {
        operation: "ECHO",
        requestId: "req-epoch",
        authorityId: env.binding.authorityId,
        sessionId: registered.sessionId,
        epoch: 6,
      }),
    ).toMatchObject({ ok: false, code: "EPOCH_MISMATCH" });

    const request = {
      operation: "ECHO" as const,
      requestId: "req-replay",
      authorityId: env.binding.authorityId,
      sessionId: registered.sessionId,
      epoch: 7,
    };
    expect(env.server.invoke(env.call(), request).ok).toBe(true);
    expect(env.server.invoke(env.call(), request)).toMatchObject({
      ok: false,
      code: "REQUEST_REPLAY",
    });
    expect(
      env.server.invoke(env.call(), { ...request, operation: "SESSION_CLOSE" }),
    ).toMatchObject({ ok: false, code: "REQUEST_CONFLICT" });
  });

  it("does not run effects on authorization failure", () => {
    const env = setup("STAGING_WRITER");
    const result = env.server.invoke(
      env.call({ rpcPrincipal: "svc_cleanup" }),
      requestFor(env.binding, "req-no-effect"),
    );
    expect(result.ok).toBe(false);
    expect(env.effects()).toBe(0);
  });

  it("keeps four authority sessions distinct", () => {
    const authorities = ["STAGING_WRITER", "PUBLISHER", "SEALER", "CLEANUP"] as const;
    const store = new MemoryAuthoritySessionStore();
    const processes = authorities.map((authority) => processFor(authority));
    const servers = authorities.map((authority, index) => {
      const binding = bindingFor(authority);
      return {
        binding,
        process: processes[index]!,
        server: new AuthorityServer({
          binding,
          identityProvider: new StrictRpcIdentityProvider(),
          sessions: store,
          epoch: 11,
        }),
      };
    });

    const sessions = servers.map((entry, index) => {
      const result = entry.server.invoke(
        callFor(entry.binding, entry.process),
        requestFor(entry.binding, `register-${index}`),
      );
      if (!result.ok) throw new Error(`registration failed for ${index}`);
      return result.sessionId;
    });

    for (const [index, entry] of servers.entries()) {
      const result = entry.server.invoke(
        callFor(entry.binding, entry.process),
        {
          operation: "ECHO",
          requestId: `cross-${index}`,
          authorityId: entry.binding.authorityId,
          sessionId: sessions[(index + 1) % sessions.length]!,
          epoch: 11,
        },
      );
      expect(result).toMatchObject({
        ok: false,
        code: "SESSION_AUTHORITY_MISMATCH",
      });
    }
  });

  it("handles concurrent request IDs independently", async () => {
    const env = setup("PUBLISHER");
    const registered = env.register("concurrent-session");
    if (!registered.ok) throw new Error("registration failed");
    const calls = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        Promise.resolve(
          env.server.invoke(env.call(), {
            operation: "ECHO",
            requestId: `concurrent-${index}`,
            authorityId: env.binding.authorityId,
            sessionId: registered.sessionId,
            epoch: 7,
            payload: { message: String(index) },
          }),
        ),
      ),
    );
    expect(calls.every((result) => result.ok)).toBe(true);
  });
});
