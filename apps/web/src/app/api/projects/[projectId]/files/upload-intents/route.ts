import {
  uploadIntentSchema,
  type UploadIntentInput,
} from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { createUploadIntent } from "@/modules/files/upload-service";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";
import { getPrivateStorage } from "@/server/files/storage";
import { assertSameOrigin } from "@/server/http/origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,100}$/;

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const { projectId } = await context.params;
    if (!projectId) {
      throw new AppError("PROJECT_ID_REQUIRED", "缺少项目编号。", 400);
    }

    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.FILE_UPLOAD,
    );
    assertSameOrigin(request);

    const requestKey = request.headers.get("idempotency-key") ?? "";
    if (!IDEMPOTENCY_KEY_PATTERN.test(requestKey)) {
      throw new AppError(
        "IDEMPOTENCY_KEY_INVALID",
        "必须提供 16 至 100 个安全字符的 Idempotency-Key。",
        400,
      );
    }

    const input: UploadIntentInput = await parseJsonBody(
      request,
      uploadIntentSchema,
    );
    const intent = await createUploadIntent(
      actor,
      projectId,
      requestKey,
      input,
      getPrivateStorage(),
    );

    return NextResponse.json(
      {
        uploadIntent: {
          id: intent.id,
          status: intent.status,
          expiresAt: intent.expiresAt.toISOString(),
          declaredSizeBytes: intent.declaredSizeBytes.toString(),
          uploadPath: `/api/projects/${projectId}/files/upload-intents/${intent.id}/content`,
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
