import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { getProjectFileDetails } from "@/modules/files/file-query-service";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";
import { prisma } from "@/server/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ projectId: string; fileId: string }>;
  },
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const { projectId, fileId } = await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.FILE_READ,
    );
    const file = await getProjectFileDetails(projectId, fileId);

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        action: "file.viewed",
        objectType: "File",
        objectId: file.id,
        requestId,
        newValue: {
          projectId,
          currentVersionId: file.currentVersionId,
        },
      },
    });

    return NextResponse.json(
      { file },
      {
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
