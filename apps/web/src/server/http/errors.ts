import type { ApiError } from "@elevator/contracts";
import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toApiError(
  error: unknown,
  requestId: string,
): ApiError {
  const timestamp = new Date().toISOString();

  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        timestamp,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "服务器暂时无法处理该请求，请稍后重试。",
      requestId,
      timestamp,
    },
  };
}

export function getErrorStatus(error: unknown): number {
  return error instanceof AppError ? error.status : 500;
}

export function errorResponse(
  error: unknown,
  requestId: string,
): NextResponse<ApiError> {
  return NextResponse.json(toApiError(error, requestId), {
    status: getErrorStatus(error),
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
