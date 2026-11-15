import type { z } from "zod";

import { AppError } from "./errors";

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      "请求必须使用 application/json。",
      415,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new AppError("INVALID_JSON", "请求内容不是有效的 JSON。", 400);
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "提交的数据格式不正确。",
      400,
    );
  }

  return result.data;
}
