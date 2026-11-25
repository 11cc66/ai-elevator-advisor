import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { getAdvisorConversation } from "@/modules/advisor/service";
import { requireApiActor } from "@/modules/auth/api-session";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; conversationId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { projectId, conversationId } = await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(actor, projectId, PERMISSIONS.ADVISOR_USE);
    return NextResponse.json(
      await getAdvisorConversation({ projectId, conversationId }),
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
