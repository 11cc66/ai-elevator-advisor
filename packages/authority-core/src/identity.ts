import type {
  AuthorityFailure,
  AuthorityIdentityProvider,
  ProcessIdentityEvidence,
  RpcCallEvidence,
} from "./types.js";

const failure = (message: string): AuthorityFailure => ({
  ok: false,
  code: "PROCESS_IDENTITY_MISMATCH",
  message,
});

export class StrictRpcIdentityProvider implements AuthorityIdentityProvider {
  inspect(call: RpcCallEvidence): ProcessIdentityEvidence | AuthorityFailure {
    if (call.nullSession) {
      return failure("null RPC session is not allowed");
    }
    if (call.kernelModeCaller) {
      return failure("kernel-mode RPC caller is not allowed");
    }
    if (call.transport !== "ncalrpc") {
      return failure("only ncalrpc is allowed");
    }
    if (
      call.authenticationService !== "WINNT" ||
      call.authenticationLevel !== "PKT_PRIVACY"
    ) {
      return failure("RPC authentication is insufficient");
    }
    if (
      !Number.isSafeInteger(call.clientPid) ||
      call.clientPid <= 0 ||
      call.process.processId !== call.clientPid
    ) {
      return failure("RPC ClientPID and process evidence disagree");
    }
    if (
      call.rpcPrincipal.length === 0 ||
      call.rpcPrincipal !== call.process.principal
    ) {
      return failure("RPC principal and process principal disagree");
    }
    if (
      call.process.processHandleKey.length === 0 ||
      call.process.creationTime.length === 0 ||
      call.process.userSid.length === 0 ||
      call.process.serviceSid.length === 0
    ) {
      return failure("process identity evidence is incomplete");
    }
    if (call.process.restrictedSids.length === 0) {
      return failure("restricted SID evidence is missing");
    }
    return call.process;
  }
}

export interface ProcessIdentityFixture {
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
