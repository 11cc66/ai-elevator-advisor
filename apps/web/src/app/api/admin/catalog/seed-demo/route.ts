import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { seedDemoCatalog } from "@/modules/mvp/store";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    requireGlobalPermission(actor, PERMISSIONS.CATALOG_MANAGE);
    const count = await seedDemoCatalog({
      actorUserId: actor.userId,
      requestId,
    });
    return NextResponse.json(
      { seededProducts: count },
      { status: 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
