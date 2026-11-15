import { AppError } from "./errors";
import { readWebEnv } from "@/server/env";

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(readWebEnv().BETTER_AUTH_URL).origin;

  if (!origin || origin !== expectedOrigin) {
    throw new AppError(
      "CSRF_ORIGIN_REJECTED",
      "请求来源校验失败。",
      403,
    );
  }
}
