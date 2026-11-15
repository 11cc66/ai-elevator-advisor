import { AppError } from "@/server/http/errors";

import { loadActor, type Actor } from "../access/actor";
import { getCurrentSession } from "./session";

export interface ApiActorContext {
  actor: Actor;
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;
}

export async function requireApiActor(
  request: Request,
): Promise<ApiActorContext> {
  const session = await getCurrentSession(request.headers);

  if (!session) {
    throw new AppError(
      "AUTH_REQUIRED",
      "请先登录后再访问该资源。",
      401,
    );
  }

  return {
    actor: await loadActor(session.user.id),
    session,
  };
}
