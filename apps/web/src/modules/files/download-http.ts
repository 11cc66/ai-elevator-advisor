import { AppError, errorResponse } from "@/server/http/errors";

export function downloadErrorResponse(
  error: unknown,
  requestId: string,
) {
  const response = errorResponse(error, requestId);
  if (
    error instanceof AppError &&
    error.code === "DOWNLOAD_RESOURCE_BUSY"
  ) {
    response.headers.set("Retry-After", "1");
  }
  return response;
}
