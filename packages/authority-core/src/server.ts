import type {
  AuthorityBinding,
  AuthorityErrorCode,
  AuthorityFailure,
  AuthorityOperation,
  AuthorityRequest,
  AuthorityResponse,
  AuthorityResult,
  AuthoritySession,
  AuthorityServerOptions,
  ProcessIdentityEvidence,
  RpcCallEvidence,
} from "./types.js";

const fail = (code: AuthorityErrorCode, message: string): AuthorityFailure => ({
  ok: false,
  code,
  message,
});

const isFailure = (
  value: ReturnType<AuthorityServerOptions["identityProvider"]["inspect"]>,
): value is AuthorityFailure => "ok" in value && value.ok === false;

const sameProcess = (
  left: Readonly<{
    processId: number;
    processHandleKey: string;
    creationTime: string;
    userSid: string;
    principal: string;
    serviceSid: string;
    restrictedSids: readonly string[];
    integrityLevel: string;
    windowsSessionId: number;
  }>,
  right: Readonly<{
    processId: number;
    processHandleKey: string;
    creationTime: string;
    userSid: string;
    principal: string;
    serviceSid: string;
    restrictedSids: readonly string[];
    integrityLevel: string;
    windowsSessionId: number;
  }>,
): boolean =>
  left.processId === right.processId &&
  left.processHandleKey === right.processHandleKey &&
  left.creationTime === right.creationTime &&
  left.userSid === right.userSid &&
  left.principal === right.principal &&
  left.serviceSid === right.serviceSid &&
  left.integrityLevel === right.integrityLevel &&
  left.windowsSessionId === right.windowsSessionId &&
  left.restrictedSids.length === right.restrictedSids.length &&
  left.restrictedSids.every((sid, index) => sid === right.restrictedSids[index]);

const allowedOperations: readonly AuthorityOperation[] = [
  "SESSION_REGISTER",
  "SESSION_CLOSE",
  "SESSION_REVOKE",
  "ECHO",
];

export class AuthorityServer {
  private readonly binding: AuthorityBinding;
  private readonly identityProvider: AuthorityServerOptions["identityProvider"];
  private readonly sessions: AuthorityServerOptions["sessions"];
  private readonly epoch: number;
  private readonly onAuthorizedEffect?: AuthorityServerOptions["onAuthorizedEffect"];
  private readonly requestJournal = new Map<string, string>();

  constructor(options: AuthorityServerOptions) {
    if (options.epoch <= 0) {
      throw new Error("authority epoch must be positive");
    }
    this.binding = options.binding;
    this.identityProvider = options.identityProvider;
    this.sessions = options.sessions;
    this.epoch = options.epoch;
    this.onAuthorizedEffect = options.onAuthorizedEffect;
  }

  /**
   * This is the only public RPC-facing method. It intentionally performs the
   * authorization gate before the private dispatcher.
   */
  invoke(
    call: RpcCallEvidence,
    request: AuthorityRequest,
  ): AuthorityResult {
    const authorized = this.#authorizeCurrentCall(call, request);
    if (authorized.ok === false) {
      return authorized;
    }
    return this.#dispatch(authorized, request);
  }

  #authorizeCurrentCall(
    call: RpcCallEvidence,
    request: AuthorityRequest,
  ): {
    ok: true;
    identity: ProcessIdentityEvidence;
    session?: AuthoritySession;
  } | AuthorityFailure {
    if (call.endpoint !== this.binding.endpoint) {
      return fail("AUTHORITY_MISMATCH", "RPC endpoint does not match authority");
    }
    if (request.authorityId !== this.binding.authorityId) {
      return fail("AUTHORITY_MISMATCH", "requested authority does not match RPC authority");
    }
    if (!allowedOperations.includes(request.operation)) {
      return fail("OPERATION_NOT_ALLOWED", "operation is not registered");
    }
    if (request.requestId.length === 0) {
      return fail("INVALID_CALL", "request id is required");
    }
    const identity = this.identityProvider.inspect(call);
    if (isFailure(identity)) {
      return identity;
    }
    if (
      identity.principal !== this.binding.expectedPrincipal ||
      identity.serviceSid !== this.binding.expectedServiceSid ||
      !identity.restrictedSids.includes(this.binding.expectedRestrictedSid)
    ) {
      return fail(
        "PROCESS_IDENTITY_MISMATCH",
        "process token does not belong to the authority binding",
      );
    }
    if (request.operation === "SESSION_REGISTER") {
      return { ok: true, identity };
    }
    if (!request.sessionId) {
      return fail("SESSION_REQUIRED", "session id is required");
    }
    const session = this.sessions.find(request.sessionId);
    if (!session) {
      return fail("SESSION_NOT_FOUND", "session does not exist");
    }
    if (session.state !== "ACTIVE") {
      return fail(
        session.state === "REVOKED" ? "SESSION_REVOKED" : "SESSION_CLOSED",
        "session is not active",
      );
    }
    if (session.authorityId !== this.binding.authorityId) {
      return fail("SESSION_AUTHORITY_MISMATCH", "session belongs to another authority");
    }
    if (request.epoch !== undefined && request.epoch !== session.epoch) {
      return fail("EPOCH_MISMATCH", "session epoch is stale");
    }
    if (request.epoch !== undefined && request.epoch !== this.epoch) {
      return fail("EPOCH_MISMATCH", "authority epoch is stale");
    }
    if (!sameProcess(identity, session.process)) {
      return fail("SESSION_PROCESS_MISMATCH", "caller process differs from session");
    }
    return { ok: true, identity, session };
  }

  #dispatch(
    authorized: Readonly<{
      identity: ProcessIdentityEvidence;
      session?: AuthoritySession;
    }>,
    request: AuthorityRequest,
  ): AuthorityResult {
    const replayKey = `${request.authorityId}:${request.requestId}`;
    const requestKey = `${request.operation}:${request.sessionId ?? ""}:${JSON.stringify(
      request.payload ?? {},
    )}`;
    const previous = this.requestJournal.get(replayKey);
    if (previous !== undefined) {
      return fail(
        previous === requestKey ? "REQUEST_REPLAY" : "REQUEST_CONFLICT",
        "request id was already used",
      );
    }
    this.requestJournal.set(replayKey, requestKey);
    if (request.operation === "SESSION_REGISTER") {
      const session = this.sessions.create(this.binding, authorized.identity, this.epoch);
      this.onAuthorizedEffect?.(request, session);
      return {
        ok: true,
        operation: request.operation,
        authorityId: this.binding.authorityId,
        sessionId: session.sessionId,
      } satisfies AuthorityResponse;
    }
    const session = authorized.session;
    if (!session) {
      return fail("SESSION_REQUIRED", "session was not authorized");
    }
    this.onAuthorizedEffect?.(request, session);
    if (request.operation === "ECHO") {
      return {
        ok: true,
        operation: request.operation,
        authorityId: this.binding.authorityId,
        ...(session ? { sessionId: session.sessionId } : {}),
        result: `${this.binding.authorityId}:${request.payload?.message ?? ""}`,
      } satisfies AuthorityResponse;
    }
    if (request.operation === "SESSION_CLOSE" || request.operation === "SESSION_REVOKE") {
      if (!session) {
        return fail("SESSION_REQUIRED", "session is required");
      }
      const state = request.operation === "SESSION_REVOKE" ? "REVOKED" : "CLOSED";
      if (!this.sessions.close(session.sessionId, state)) {
        return fail("SESSION_CLOSED", "session is already terminal");
      }
      return {
        ok: true,
        operation: request.operation,
        authorityId: this.binding.authorityId,
        sessionId: session.sessionId,
      } satisfies AuthorityResponse;
    }
    return fail("OPERATION_NOT_ALLOWED", "operation is not allowed");
  }
}
