import { salesHandoffCreateSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { createSalesHandoff } from "@/modules/mvp/store";
import { parseJsonBody } from "@/server/http/body";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { projectId } = await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(
      actor,
      projectId,
      PERMISSIONS.SALES_HANDOFF_CREATE,
    );
    const input = await parseJsonBody(request, salesHandoffCreateSchema);
    const handoffId = await createSalesHandoff({
      projectId,
      createdById: actor.userId,
      summary: input.summary,
      budgetConcern: input.budgetConcern,
    });
    return NextResponse.json(
      { handoffId },
      { status: 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
