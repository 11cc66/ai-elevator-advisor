import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { completeUpload } from "@/modules/files/upload-service";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";
import { getPrivateStorage } from "@/server/files/storage";
import { assertSameOrigin } from "@/server/http/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ projectId: string; intentId: string }>;
  },
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const { projectId, intentId } = await context.params;
    if (!projectId || !intentId) {
      throw new AppError(
        "UPLOAD_TARGET_REQUIRED",
        "缺少项目或上传意图编号。",
        400,
      );
    }

    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.FILE_UPLOAD,
    );
    assertSameOrigin(request);

    if (!request.body) {
      throw new AppError(
        "UPLOAD_BODY_REQUIRED",
        "上传请求缺少文件内容。",
        400,
      );
    }

    const rawContentLength = request.headers.get("content-length");
    const contentLength =
      rawContentLength && /^\d+$/.test(rawContentLength)
        ? Number(rawContentLength)
        : null;
    const requestMimeType =
      request.headers.get("content-type")?.split(";", 1)[0]?.trim() ??
      null;
    const completed = await completeUpload({
      actor,
      projectId,
      intentId,
      requestContentLength: contentLength,
      requestMimeType,
      source: Readable.fromWeb(
        request.body as unknown as NodeWebReadableStream<Uint8Array>,
      ),
      requestId,
      storage: getPrivateStorage(),
    });
    const { version } = completed;

    return NextResponse.json(
      {
        extractionId: completed.extractionId,
        fileVersion: {
          id: version.id,
          fileId: version.fileId,
          versionNumber: version.versionNumber,
          detectedMimeType: version.detectedMimeType,
          sizeBytes: version.sizeBytes.toString(),
          checksumSha256: version.checksumSha256,
          uploadStatus: version.uploadStatus,
          validationStatus: version.validationStatus,
          malwareScanStatus: version.malwareScanStatus,
          integrityStatus: version.integrityStatus,
          recognitionStatus: version.recognitionStatus,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
