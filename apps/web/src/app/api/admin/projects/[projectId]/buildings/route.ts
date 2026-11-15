import {
  createBuildingSchema,
  type CreateBuildingInput,
} from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { createBuilding } from "@/modules/projects/service";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

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
      PERMISSIONS.PROJECT_MANAGE,
    );
    const input: CreateBuildingInput = await parseJsonBody(
      request,
      createBuildingSchema,
    );
    const building = await createBuilding(
      actor.userId,
      requestId,
      projectId,
      input,
    );

    return NextResponse.json(
      { building },
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
