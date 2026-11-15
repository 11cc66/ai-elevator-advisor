import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { getExtractionDetails } from "@/modules/files/file-query-service";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";
import { prisma } from "@/server/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
      fileId: string;
      versionId: string;
      extractionId: string;
    }>;
  },
): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const { projectId, fileId, versionId, extractionId } =
      await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.FILE_READ,
    );
    const extraction = await getExtractionDetails(
      projectId,
      fileId,
      versionId,
      extractionId,
    );

    await prisma.auditLog.create({
      data: {
        actorUserId: actor.userId,
        action: "file.extraction.viewed",
        objectType: "FileExtraction",
        objectId: extraction.id,
        requestId,
        newValue: {
          projectId,
          fileId,
          versionId,
        },
      },
    });

    return NextResponse.json(
      { extraction },
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
