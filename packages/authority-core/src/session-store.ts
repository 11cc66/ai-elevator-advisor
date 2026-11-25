import { randomUUID } from "node:crypto";
import type {
  AuthorityBinding,
  AuthoritySession,
  AuthoritySessionStore,
  ProcessIdentityEvidence,
} from "./types.js";

export class MemoryAuthoritySessionStore implements AuthoritySessionStore {
  private readonly sessions = new Map<string, AuthoritySession>();

  create(
    authority: AuthorityBinding,
    process: ProcessIdentityEvidence,
    epoch: number,
  ): AuthoritySession {
    const session: AuthoritySession = {
      sessionId: randomUUID(),
      authorityId: authority.authorityId,
      authorityType: authority.authorityType,
      epoch,
      process,
      state: "ACTIVE",
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  find(sessionId: string): AuthoritySession | undefined {
    return this.sessions.get(sessionId);
  }

  close(sessionId: string, state: "CLOSED" | "REVOKED"): boolean {
    const current = this.sessions.get(sessionId);
    if (!current || current.state !== "ACTIVE") {
      return false;
    }
    this.sessions.set(sessionId, { ...current, state });
    return true;
  }
}
