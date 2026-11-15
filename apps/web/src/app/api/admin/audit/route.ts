import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";
import { prisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    const { actor } = await requireApiActor(request);
    requireGlobalPermission(actor, PERMISSIONS.AUDIT_READ);
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        objectType: true,
        objectId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { auditLogs },
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
