import { salesFollowUpSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { hasGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import {
  addSalesFollowUp,
  getSalesHandoffProjectId,
} from "@/modules/mvp/store";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ handoffId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { handoffId } = await context.params;
    const { actor } = await requireApiActor(request);
    const projectId = await getSalesHandoffProjectId(handoffId);
    const scopedSalesAccess =
      projectId !== null &&
      (actor.projectPermissions
        .get(projectId)
        ?.has(PERMISSIONS.SALES_MANAGE) ??
        false);
    if (
      !hasGlobalPermission(actor, PERMISSIONS.SALES_MANAGE) &&
      !scopedSalesAccess
    ) {
      throw new AppError("SALES_ACCESS_DENIED", "没有销售跟进权限。", 403);
    }
    const input = await parseJsonBody(request, salesFollowUpSchema);
    await addSalesFollowUp({
      handoffId,
      authorUserId: actor.userId,
      data: input,
    });
    return NextResponse.json(
      { saved: true },
      { status: 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
