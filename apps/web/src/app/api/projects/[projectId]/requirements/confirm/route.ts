import { requirementConfirmSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { confirmRequirement } from "@/modules/mvp/store";
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
    requireProjectPermission(actor, projectId, PERMISSIONS.ADVISOR_USE);
    const input = await parseJsonBody(request, requirementConfirmSchema);
    const requirement = await confirmRequirement({
      projectId,
      expectedVersion: input.expectedVersion,
      actorUserId: actor.userId,
    });
    return NextResponse.json(
      { requirement },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
