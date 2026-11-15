import {
  createInstallationUnitSchema,
  type CreateInstallationUnitInput,
} from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { createInstallationUnit } from "@/modules/projects/service";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ projectId: string; buildingId: string }>;
  },
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const { projectId, buildingId } = await context.params;
    if (!projectId || !buildingId) {
      throw new AppError(
        "RESOURCE_ID_REQUIRED",
        "缺少项目或建筑编号。",
        400,
      );
    }

    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.PROJECT_MANAGE,
    );
    const input: CreateInstallationUnitInput = await parseJsonBody(
      request,
      createInstallationUnitSchema,
    );
    const unit = await createInstallationUnit(
      actor.userId,
      requestId,
      projectId,
      buildingId,
      input,
    );

    return NextResponse.json(
      { unit },
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
