import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { prepareFileDownload } from "@/modules/files/download-service";
import { downloadErrorResponse } from "@/modules/files/download-http";
import { createVerifiedDownloadStream } from "@/modules/files/download-response-stream";
import { AppError } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";
import { getPrivateStorage } from "@/server/files/storage";
import { readWebEnv } from "@/server/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeContentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="download"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
      fileId: string;
      versionId: string;
    }>;
  },
): Promise<Response> {
  const requestId = getRequestId(request);

  try {
    const { projectId, fileId, versionId } = await context.params;
    if (!projectId || !fileId || !versionId) {
      throw new AppError(
        "FILE_RESOURCE_ID_REQUIRED",
        "缺少文件资源编号。",
        400,
      );
    }

    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.FILE_READ,
    );
    const download = await prepareFileDownload({
      actor,
      projectId,
      fileId,
      versionId,
      requestId,
      env: readWebEnv(),
      storage: getPrivateStorage(),
    });
    let responseBody: ReadableStream<Uint8Array> | undefined;

    try {
      responseBody = createVerifiedDownloadStream(
        download.body,
        download.release,
        {
          timeoutMs: download.responseTimeoutMs,
          signal: request.signal,
          onInterrupted: download.reportInterruption,
        },
      );

      return new Response(
        responseBody,
        {
          status: 200,
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Disposition": encodeContentDisposition(
              download.fileName,
            ),
            "Content-Length": download.body.byteLength.toString(),
            "Content-Security-Policy": "sandbox",
            "Content-Type": download.mimeType,
            "X-Content-Type-Options": "nosniff",
            "X-Request-Id": requestId,
          },
        },
      );
    } catch (error) {
      download.reportInterruption("RESPONSE_STREAM_ERROR");
      download.release();
      void responseBody?.cancel(error).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return downloadErrorResponse(error, requestId);
  }
}
