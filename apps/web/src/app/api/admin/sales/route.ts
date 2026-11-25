import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { hasGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { listSalesHandoffs } from "@/modules/mvp/store";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    const hasScopedSalesAccess = [...actor.projectPermissions.values()].some(
      (permissions) => permissions.has(PERMISSIONS.SALES_MANAGE),
    );
    if (
      !hasGlobalPermission(actor, PERMISSIONS.SALES_MANAGE) &&
      !hasScopedSalesAccess
    ) {
      throw new AppError("SALES_ACCESS_DENIED", "没有销售跟进权限。", 403);
    }
    const handoffs = await listSalesHandoffs();
    const visible = hasGlobalPermission(actor, PERMISSIONS.SALES_MANAGE)
      ? handoffs
      : handoffs.filter((handoff) =>
          actor.projectPermissions
            .get(handoff.projectId)
            ?.has(PERMISSIONS.SALES_MANAGE),
        );
    return NextResponse.json(
      { handoffs: visible },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
