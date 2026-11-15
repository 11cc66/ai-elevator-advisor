import {
  fieldReviewInputSchema,
  type FieldReviewInput,
} from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { submitCustomerFieldReview } from "@/modules/files/field-review-service";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/origin";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
      fileId: string;
      versionId: string;
      extractionId: string;
      fieldId: string;
    }>;
  },
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const {
      projectId,
      fileId,
      versionId,
      extractionId,
      fieldId,
    } = await context.params;
    if (
      !projectId ||
      !fileId ||
      !versionId ||
      !extractionId ||
      !fieldId
    ) {
      throw new AppError(
        "FIELD_REVIEW_TARGET_REQUIRED",
        "缺少字段确认所需的资源编号。",
        400,
      );
    }

    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.FILE_READ,
    );
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.FILE_CONFIRM,
    );
    assertSameOrigin(request);
    const review: FieldReviewInput = await parseJsonBody(
      request,
      fieldReviewInputSchema,
    );
    const result = await submitCustomerFieldReview({
      actor,
      projectId,
      fileId,
      versionId,
      extractionId,
      fieldId,
      review,
      requestId,
    });

    return NextResponse.json(
      { fieldReview: result },
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
