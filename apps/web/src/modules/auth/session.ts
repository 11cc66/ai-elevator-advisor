import { headers } from "next/headers";

import { auth } from "./auth";
import { isSessionExpired } from "./session-time";

export type AuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

export async function getCurrentSession(
  requestHeaders?: Headers,
): Promise<AuthSession | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });

  if (!session || isSessionExpired(session.session.expiresAt)) {
    return null;
  }

  return session;
}
