export type AuthorityType =
  | "STAGING_WRITER"
  | "PUBLISHER"
  | "SEALER"
  | "CLEANUP";

export type AuthorityId =
  | "p13.staging-writer"
  | "p13.publisher"
  | "p13.sealer"
  | "p13.cleanup";

export type AuthorityOperation =
  | "SESSION_REGISTER"
  | "SESSION_CLOSE"
  | "SESSION_REVOKE"
  | "ECHO";

export type AuthoritySessionState = "ACTIVE" | "CLOSED" | "REVOKED";

export type CallerClass = "AUTHORITY" | "CLIENT";

export interface ProcessIdentityEvidence {
  readonly processId: number;
  readonly processHandleKey: string;
  readonly creationTime: string;
  readonly userSid: string;
  readonly principal: string;
  readonly serviceSid: string;
  readonly restrictedSids: readonly string[];
  readonly integrityLevel: string;
  readonly windowsSessionId: number;
}

export interface RpcCallEvidence {
  readonly endpoint: string;
  readonly transport: "ncalrpc";
  readonly authenticationService: "WINNT";
  readonly authenticationLevel: "PKT_PRIVACY";
  readonly clientPid: number;
  readonly rpcPrincipal: string;
  readonly nullSession: boolean;
  readonly kernelModeCaller: boolean;
  readonly process: ProcessIdentityEvidence;
  readonly callbackObserved: boolean;
}

export interface AuthorityBinding {
  readonly authorityId: AuthorityId;
  readonly authorityType: AuthorityType;
  readonly endpoint: string;
  readonly expectedPrincipal: string;
  readonly expectedServiceSid: string;
  readonly expectedRestrictedSid: string;
}

export interface AuthoritySession {
  readonly sessionId: string;
  readonly authorityId: AuthorityId;
  readonly authorityType: AuthorityType;
  readonly epoch: number;
  readonly process: ProcessIdentityEvidence;
  readonly state: AuthoritySessionState;
}

export interface AuthorityRequest {
  readonly operation: AuthorityOperation;
  readonly requestId: string;
  readonly authorityId: AuthorityId;
  readonly sessionId?: string;
  readonly epoch?: number;
  readonly payload?: Readonly<Record<string, string>>;
}

export interface AuthorityResponse {
  readonly ok: true;
  readonly operation: AuthorityOperation;
  readonly authorityId: AuthorityId;
  readonly sessionId?: string;
  readonly result?: string;
}

export type AuthorityErrorCode =
  | "INVALID_CALL"
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORITY_MISMATCH"
  | "PROCESS_IDENTITY_MISMATCH"
  | "RPC_PRINCIPAL_MISMATCH"
  | "SESSION_REQUIRED"
  | "SESSION_NOT_FOUND"
  | "SESSION_CLOSED"
  | "SESSION_REVOKED"
  | "SESSION_AUTHORITY_MISMATCH"
  | "SESSION_PROCESS_MISMATCH"
  | "EPOCH_MISMATCH"
  | "REQUEST_REPLAY"
  | "REQUEST_CONFLICT"
  | "OPERATION_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export interface AuthorityFailure {
  readonly ok: false;
  readonly code: AuthorityErrorCode;
  readonly message: string;
}

export type AuthorityResult = AuthorityResponse | AuthorityFailure;

export interface AuthorityIdentityProvider {
  inspect(call: RpcCallEvidence): ProcessIdentityEvidence | AuthorityFailure;
}

export interface AuthorityServerOptions {
  readonly binding: AuthorityBinding;
  readonly identityProvider: AuthorityIdentityProvider;
  readonly sessions: AuthoritySessionStore;
  readonly epoch: number;
  readonly onAuthorizedEffect?: (
    request: AuthorityRequest,
    session: AuthoritySession | undefined,
  ) => void;
}

export interface AuthoritySessionStore {
  create(
    authority: AuthorityBinding,
    process: ProcessIdentityEvidence,
    epoch: number,
  ): AuthoritySession;
  find(sessionId: string): AuthoritySession | undefined;
  close(sessionId: string, state: "CLOSED" | "REVOKED"): boolean;
}
